import { createWorkersAI } from "workers-ai-provider";
import { type Schedule } from "agents";
import { getSchedulePrompt, scheduleSchema } from "agents/schedule";
import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import { streamText, convertToModelMessages, tool, stepCountIs } from "ai";
import { z } from "zod";
import type {
    Warehouse,
    WarehouseState,
    WarehouseStatus,
} from "../types/graph";
import { WORLD_MAP } from "../config/topology";
import { getWarehouseStateTool } from "./tools/getWarehouseState";
import { transferStockTool } from "./tools/transferStock";
import { planTransferRouteTool } from "./tools/planTransferRoute";
import { updateWarehouseStatusTool } from "./tools/updateWarehouseStatus";

export class SupplyChain extends AIChatAgent<Env> {
    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);

        ctx.blockConcurrencyWhile(async () => {
            this.ctx.storage.sql.exec(
                `CREATE TABLE IF NOT EXISTS warehouses (
                    city TEXT PRIMARY KEY,
                    status TEXT NOT NULL,
                    reason TEXT, 
                    inventory_level INTEGER NOT NULL
                );`,
            );

            for (const cityName of Object.keys(WORLD_MAP)) {
                this.ctx.storage.sql.exec(
                    `INSERT OR IGNORE INTO warehouses (city, status, reason, inventory_level) VALUES (?, ?, ?, ?)`,
                    cityName,
                    "operational",
                    null,
                    100,
                );
            }
        });
    }

    async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
        const workersai = createWorkersAI({ binding: this.env.AI });

        const result = streamText({
            model: workersai("@cf/zai-org/glm-4.7-flash"),
            system: `You are a helpful supply chain assistant to manage a global supply chain. 
            You can get the state of a warehouse, update the state of a warehouse, transfer stock from one warehouse to another one and schedule tasks.
            IMPORTANT: When a user requests a stock transfer, you must first use the planTransferRoute tool to calculate the route. 
            then, use the transferStock tool and pass the full OptimalRouteResult object to it to execute the transfer. Explain the journey and time (converted to days or hours) to the user.
            
${getSchedulePrompt({ date: new Date() })}

If the user asks to schedule a task, use the schedule tool to schedule the task.`,
            messages: await convertToModelMessages(this.messages),
            tools: {
                // Server-side supply chain tools
                getWarehouseState: getWarehouseStateTool(this),
                planTransferRoute: planTransferRouteTool(this),
                transferStock: transferStockTool(this),
                updateWarehouseStatus: updateWarehouseStatusTool(this),

                // Client-side tool: no execute function — the browser handles it
                getUserTimezone: tool({
                    description:
                        "Get the user's timezone from their browser. Use this when you need to know the user's local time.",
                    inputSchema: z.object({}),
                }),

                scheduleTask: tool({
                    description:
                        "Schedule a task to be executed at a later time. Use this when the user asks to be reminded or wants something done later.",
                    inputSchema: scheduleSchema,
                    execute: async ({ when, description }) => {
                        if (when.type === "no-schedule") {
                            return "Not a valid schedule input";
                        }
                        const input =
                            when.type === "scheduled"
                                ? when.date
                                : when.type === "delayed"
                                  ? when.delayInSeconds
                                  : when.type === "cron"
                                    ? when.cron
                                    : null;
                        if (!input) return "Invalid schedule type";
                        try {
                            this.schedule(input, "executeTask", description);
                            return `Task scheduled: "${description}" (${when.type}: ${input})`;
                        } catch (error) {
                            return `Error scheduling task: ${error}`;
                        }
                    },
                }),

                getScheduledTasks: tool({
                    description: "List all tasks that have been scheduled",
                    inputSchema: z.object({}),
                    execute: async () => {
                        const tasks = this.getSchedules();
                        return tasks.length > 0
                            ? tasks
                            : "No scheduled tasks found.";
                    },
                }),

                cancelScheduledTask: tool({
                    description: "Cancel a scheduled task by its ID",
                    inputSchema: z.object({
                        taskId: z
                            .string()
                            .describe("The ID of the task to cancel"),
                    }),
                    execute: async ({ taskId }) => {
                        try {
                            this.cancelSchedule(taskId);
                            return `Task ${taskId} cancelled.`;
                        } catch (error) {
                            return `Error cancelling task: ${error}`;
                        }
                    },
                }),
            },
            stopWhen: stepCountIs(5),
            abortSignal: options?.abortSignal,
        });

        return result.toUIMessageStreamResponse();
    }

    async executeTask(description: string, _task: Schedule<string>) {
        console.log(`Executing scheduled task: ${description}`);

        this.broadcast(
            JSON.stringify({
                type: "scheduled-task",
                description,
                timestamp: new Date().toISOString(),
            }),
        );
    }

    async completeTransfer(
        payload: { destination: string; amount: number },
        _task: Schedule<{ destination: string; amount: number }>,
    ) {
        const updatedState = this.updateInventory(
            payload.destination,
            payload.amount,
        );

        this.broadcast(
            JSON.stringify({
                type: "stock-arrival",
                destination: payload.destination,
                amount: payload.amount,
                inventoryLevel: updatedState.inventoryLevel,
                timestamp: new Date().toISOString(),
            }),
        );
    }

    getWarehouseState(city: string): WarehouseState {
        const row = this.ctx.storage.sql
            .exec<any>(
                `SELECT status, reason, inventory_level as inventoryLevel FROM warehouses WHERE city = ?`,
                city,
            )
            .one();

        if (!row) {
            throw new Error(`Unknown city: ${city}`);
        }

        return {
            status: row.status,
            inventoryLevel: row.inventoryLevel,
            reason: row.reason ?? undefined,
        };
    }

    getWarehouses(city: string): Warehouse[] {
        const rows = this.ctx.storage.sql.exec<any>(
            `SELECT city as location, status, reason, inventory_level as inventoryLevel FROM warehouses`,
        );

        return rows.toArray().map((row) => ({
            location: row.location,
            state: {
                status: row.status,
                reason: row.reason ?? undefined,
                inventoryLevel: row.inventoryLevel,
            },
        }));
    }

    getDisruptedWarehouses(): string[] {
        const rows = this.ctx.storage.sql
            .exec<{
                city: string;
            }>(`SELECT city FROM warehouses WHERE status = 'disrupted'`)
            .toArray();
        return rows.map((r) => r.city);
    }

    setWarehouseStatus(
        city: string,
        status: WarehouseStatus,
        reason?: string,
    ): void {
        this.ctx.storage.sql.exec(
            `UPDATE warehouses SET status = ?, reason = ? WHERE city = ?`,
            status,
            reason,
            city,
        );

        const exists = this.ctx.storage.sql
            .exec<{
                city: string;
            }>(`SELECT city FROM warehouses WHERE city = ?`, city)
            .one();

        if (!exists) {
            throw new Error(`Unknown city: ${city}`);
        }
    }

    updateInventory(city: string, delta: number): WarehouseState {
        const updated = this.ctx.storage.sql
            .exec<any>(
                `UPDATE warehouses
                SET inventory_level = inventory_level + ?
                WHERE city = ? AND inventory_level + ? >= 0
                RETURNING status, reason, inventory_level as inventoryLevel`,
                delta,
                city,
                delta,
            )
            .one();

        if (!updated) {
            throw new Error("Unknown city or insufficient inventory");
        }

        return updated;
    }
}

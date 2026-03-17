import { tool } from "ai";
import { z } from "zod";
import type { SupplyChain } from "../SupplyChain";

export function updateWarehouseStatusTool(agent: SupplyChain) {
    return tool({
        description:
            "Update the operational status of a warehouse. Use this when the user declares a warehouse as disrupted (e.g. natural disaster) or restores it to operational.",
        inputSchema: z.object({
            city: z.string().describe("The city name of the warehouse"),
            status: z
                .enum(["operational", "disrupted"])
                .describe("The new status of the warehouse"),
            reason: z
                .string()
                .optional()
                .describe("Optional reason for the status change"),
        }),
        needsApproval: true,
        execute: async ({ city, status, reason }) => {
            agent.setWarehouseStatus(city, status, reason);
            return `Warehouse in ${city} has been marked as ${status}${reason ? `: ${reason}` : ""}.`;
        },
    });
}

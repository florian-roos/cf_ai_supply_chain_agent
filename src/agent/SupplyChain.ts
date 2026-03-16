import { AIChatAgent } from "@cloudflare/ai-chat";
import type {
    Warehouse,
    WarehouseState,
    WarehouseStatus,
} from "../types/graph";
import { WORLD_MAP } from "../config/topology";

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

    getOfflineNodes(): string[] {
        const rows = this.ctx.storage.sql
            .exec<{
                city: string;
            }>(`SELECT city FROM warehouses WHERE status = 'disturbed'`)
            .toArray();
        return rows.map((r) => r.city);
    }

    setWarehouseStatus(city: string, status: WarehouseStatus): void {
        this.ctx.storage.sql.exec(
            `UPDATE warehouses SET status = ? WHERE city = ?`,
            status,
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

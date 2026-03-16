import { DurableObject } from "cloudflare:workers";
import type {
    Warehouse,
    WarehouseState,
    WarehouseStatus,
} from "../types/graph";
import { WORLD_MAP } from "../config/topology";

export class SupplyChain extends DurableObject<Env> {
    private sql: SqlStorage;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.sql = ctx.storage.sql;

        ctx.blockConcurrencyWhile(async () => {
            this.sql.exec(
                `CREATE TABLE IF NOT EXISTS warehouses (
                    city TEXT PRIMARY KEY,
                    status TEXT NOT NULL,
                    reason TEXT 
                    inventory_level INTEGER NOT NULL
                );`,
            );

            for (const cityName of Object.keys(WORLD_MAP)) {
                this.sql.exec(
                    `INSERT OR IGNORE INTO warehouses (city, status, reason, inventory_level) VALUES (?, ?, ?)`,
                    cityName,
                    "operational",
                    null,
                    100,
                );
            }
        });
    }

    async getWarehouseState(city: string): Promise<WarehouseState> {
        const row = await this.sql
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

    async getWarehouses(city: string): Promise<Warehouse[]> {
        const rows = await this.sql.exec<any>(
            `SELECT city, status, reason, inventory_level as inventoryLevel FROM warehouses`,
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

    async setWarehouseStatus(
        city: string,
        status: WarehouseStatus,
    ): Promise<void> {
        this.sql.exec(
            `UPDATE warehouses SET status = '?' WHERE city = ?`,
            status,
            city,
        );

        const exists = this.sql
            .exec<{
                city: string;
            }>(`SELECT city FROM nodes WHERE city = ?`, city)
            .one();

        if (!exists) {
            throw new Error(`Unknown city: ${city}`);
        }
    }

    async updateInventory(
        city: string,
        delta: number,
    ): Promise<WarehouseState> {
        const updated = this.sql
            .exec<any>(
                `UPDATE warehouses
                SET inventory_level = inventory_level + ?
                WHERE city = ? AND inventory + ? >= 0
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

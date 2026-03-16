import { DurableObject } from "cloudflare:workers";;
import type {WarehouseState} from "../types/graph";
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
                );`
            );

            for (const cityName of Object.keys(WORLD_MAP)) {
                this.sql.exec(
                    `INSERT OR IGNORE INTO warehouses (city, status, reason, inventory_level) VALUES (?, ?, ?)`,
                    cityName,
                    "operational",
                    null,
                    100
                )
            }

        })
    }
}
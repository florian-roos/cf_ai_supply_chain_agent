import { tool } from "ai";
import { z } from "zod";
import type { SupplyChain } from "../SupplyChain";

export function getWarehouseStateTool(agent: SupplyChain) {
    return tool({
        description: "Get the current state of a warehouse by city name.",
        inputSchema: z.object({
            city: z.string().describe("The city name of the warehouse"),
        }),
        execute: async ({ city }) => {
            return agent.getWarehouseState(city);
        },
    });
}

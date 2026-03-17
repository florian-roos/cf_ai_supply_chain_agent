import { tool } from "ai";
import { z } from "zod";
import type { SupplyChain } from "../SupplyChain";
import { calculateOptimalRoute } from "../../algorithms/calculateOptimalRoute";
import { WORLD_MAP } from "../../config/topology";

export function planTransferRouteTool(agent: SupplyChain) {
    return tool({
        description:
            "Calculates the optimal path and transit time for a transfer. Use this FIRST when a user requests a stock transfer.",
        inputSchema: z.object({
            source: z.string().describe("The city name of the source warehouse"),
            destination: z.string().describe("The city name of the destination warehouse"),
        }),
        execute: async ({ source, destination }) => {
            const disruptedNodes = agent.getDisruptedWarehouses();
            const route = calculateOptimalRoute(
                WORLD_MAP,
                source,
                destination,
                disruptedNodes,
            );

            if (!route.exists) {
                return route;
            }

            return route;
        },
    });
}

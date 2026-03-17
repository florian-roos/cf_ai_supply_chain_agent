import { tool } from "ai";
import { z } from "zod";
import type { SupplyChain } from "../SupplyChain";
import { calculateOptimalRoute } from "../../algorithms/calculateOptimalRoute";
import { WORLD_MAP } from "../../config/topology";

export function transferStockTool(agent: SupplyChain) {
    return tool({
        description:
            "Transfer stock units from a source warehouse to a destination warehouse. The system will calculate the optimal route, deduct inventory immediately, and schedule the arrival after the transit time.",
        inputSchema: z.object({
            source: z
                .string()
                .describe("The city name of the source warehouse"),
            destination: z
                .string()
                .describe("The city name of the destination warehouse"),
            amount: z
                .number()
                .int()
                .positive()
                .describe("Number of stock units to transfer"),
        }),
        needsApproval: true,
        execute: async ({ source, destination, amount }) => {
            const sourceState = agent.getWarehouseState(source);
            if (sourceState.inventoryLevel < amount) {
                return `Insufficient inventory at ${source}: ${sourceState.inventoryLevel} units available, ${amount} requested.`;
            }

            const disruptedNodes = agent.getDisruptedWarehouses();
            const route = calculateOptimalRoute(
                WORLD_MAP,
                source,
                destination,
                disruptedNodes,
            );

            if (!route.exists) {
                return `No available route from ${source} to ${destination}. All paths are blocked by disrupted warehouses.`;
            }

            agent.updateInventory(source, -amount);

            agent.schedule(route.transitTime * 3600, "completeTransfer", {
                destination,
                amount,
            });

            return `Transfer initiated: ${amount} units from ${source} to ${destination} via ${route.path.join(" → ")}. Transit time: ${route.transitTime}h. Inventory will arrive automatically.`;
        },
    });
}

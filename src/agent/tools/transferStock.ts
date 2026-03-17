import { tool } from "ai";
import { z } from "zod";
import type { SupplyChain } from "../SupplyChain";

export function transferStockTool(agent: SupplyChain) {
  return tool({
    description:
      "Transfer stock units from a source warehouse to a destination warehouse. The system will deduct inventory immediately, and schedule the arrival after the transit time. You must provide the fully calculated route result given to you by planTransferRoute.",
    inputSchema: z.object({
      source: z.string().describe("The city name of the source warehouse"),
      destination: z
        .string()
        .describe("The city name of the destination warehouse"),
      amount: z
        .number()
        .int()
        .positive()
        .describe("Number of stock units to transfer"),
      route: z
        .object({
          path: z.array(z.string()).describe("The planned route path"),
          transitTime: z.number().describe("The transit time in hours"),
          exists: z.boolean().describe("Whether a route exists")
        })
        .describe(
          "The OptimalRouteResult object returned from planTransferRoute"
        )
    }),
    needsApproval: true,
    execute: async ({ source, destination, amount, route }) => {
      const sourceState = agent.getWarehouseState(source);
      if (sourceState.inventoryLevel < amount) {
        return `Insufficient inventory at ${source}: ${sourceState.inventoryLevel} units available, ${amount} requested.`;
      }

      if (!route.exists) {
        return `No available route from ${source} to ${destination}. All paths are blocked by disrupted warehouses.`;
      }

      agent.updateInventory(source, -amount);

      agent.schedule(route.transitTime * 3600, "completeTransfer", {
        destination,
        amount
      });

      return `Transfer initiated: ${amount} units from ${source} to ${destination} via ${route.path.join(" → ")}. Transit time: ${route.transitTime}h. Inventory will arrive automatically.`;
    }
  });
}

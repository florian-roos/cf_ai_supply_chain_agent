# AI prompts used for this project

In topology.ts, export a WORLD_MAP const that is a graph including 7 cities (San Fransisco, New York, Lisbon, London, Paris, Singapore and Sydney) according to the GraphTopology. Assign realistic bidirectional transit times for mershandises (through containers and trucks) as weights of the edges. The graph must not be fully connected

put ' ' on every city name

Write a function calculateOptimalRoute. It takes the network graph, a start node, an end node, and an array of disruptedNodes. Implement a Dijkstra's algorithm to find the shortest path that ignore any node that is in the disruptedNodes array. Return an object: { path: string[], transitTime: number, exists: bool }.

I won't let the possibility for the user to connect a MCP server so remove everything related to that

Create a file src/agent/tools/getWarehouseState.ts. Export a function getWarehouseStateTool(agent: SupplyChain) that returns a Vercel AI tool(). The input schema requires a city string. The execute function should just call agent.getWarehouseState(city) and return the result.

Create src/agent/tools/updateWarehouseStatus.ts. Export updateWarehouseStatusTool(agent: SupplyChain). The tool takes a city, status ('operational' or 'disrupted') and optionaly a reason. Set needsApproval: true. Inside execute, call agent.setWarehouseStatus(city, status) and return a success message.

Create src/agent/tools/transferStock.ts. Export transferStockTool(agent: SupplyChain). Input schema: source, destination, amount. Set needsApproval: true. Inside execute, first verify the source has enough inventory using agent.getWarehouseState. Then, calculate the route using calculateOptimalRoute from algorithms, ensuring you pass the disrupted warehouses from agent.getDisruptedWarehouses(). If a route exists, deduct inventory from source using agent.updateInventory, schedule the arrival using agent.schedule(transitTime, 'completeTransfer', { destination, amount }), and return a summary of the action.

Modify the app.tsx file to transform the design of the agent into a professional supply chain tool. Show to the user the list of the different warehouses (San Fransisco, New York, Lisbon, London, Paris, Singapore, Sydney).

Center the title and the set of warehouses

I want the border style of the Global Warehouse Network container to be the same as the one around the conversational window. For now it is darker or with a strange shadow

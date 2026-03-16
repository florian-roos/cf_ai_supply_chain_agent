// This file defines the types related to the graph structure used in the application.
export type GraphTopology = Record<string, Record<string, number>>;

export interface Warehouse {
  location: string;
  state: WarehouseState;
}

export interface WarehouseState {
  status: "operational" | "disrupted";
  reason?: string;
  inventoryLevel: number;
}

export interface OptimalRouteResult {
  path: string[];
  transitTime: number;
  exists: boolean;
}

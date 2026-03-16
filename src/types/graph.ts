// This file defines the types related to the graph structure used in the application.
export type GraphTopology = Record<string, Record<string, number>>;

interface Warehouse {
    location: string;
    state: WarehouseState;
}

interface WarehouseState{
    status: 'operational' | 'disrupted';
    reason?: string;
    inventoryLevel: number;
}
import type { GraphTopology } from "../types/graph";

// Transit times are in hours.
export const WORLD_MAP: GraphTopology = {
  "San Francisco": {
    "New York": 96,
    Singapore: 300,
    Sydney: 360
  },
  "New York": {
    "San Francisco": 96,
    Lisbon: 168,
    London: 180
  },
  Lisbon: {
    "New York": 168,
    London: 36,
    Paris: 30
  },
  London: {
    "New York": 180,
    Lisbon: 36,
    Paris: 12,
    Singapore: 312
  },
  Paris: {
    Lisbon: 30,
    London: 12,
    Singapore: 288
  },
  Singapore: {
    "San Francisco": 300,
    London: 312,
    Paris: 288,
    Sydney: 192
  },
  Sydney: {
    "San Francisco": 360,
    Singapore: 192
  }
};

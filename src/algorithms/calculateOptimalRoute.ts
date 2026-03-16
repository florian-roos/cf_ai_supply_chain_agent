import type { GraphTopology, OptimalRouteResult } from "../types/graph";

export function calculateOptimalRoute(
  graph: GraphTopology,
  startNode: string,
  endNode: string,
  disruptedNodes: string[]
): OptimalRouteResult {
  const blocked = new Set(disruptedNodes);

  if (!graph[startNode] || !graph[endNode]) {
    return { path: [], transitTime: Infinity, exists: false };
  }

  if (blocked.has(startNode) || blocked.has(endNode)) {
    return { path: [], transitTime: Infinity, exists: false };
  }

  const nodes = Object.keys(graph).filter((node) => !blocked.has(node));
  const distances: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  const visited = new Set<string>();

  for (const node of nodes) {
    distances[node] = Infinity;
    previous[node] = null;
  }
  distances[startNode] = 0;

  while (visited.size < nodes.length) {
    let current: string | null = null;
    let bestDistance = Infinity;

    for (const node of nodes) {
      if (visited.has(node)) continue;
      if (distances[node] < bestDistance) {
        bestDistance = distances[node];
        current = node;
      }
    }

    if (!current || bestDistance === Infinity) break;
    if (current === endNode) break;

    visited.add(current);

    for (const [neighbor, weight] of Object.entries(graph[current])) {
      if (blocked.has(neighbor) || visited.has(neighbor)) continue;
      if (!(neighbor in distances)) continue;

      const candidateDistance = distances[current] + weight;
      if (candidateDistance < distances[neighbor]) {
        distances[neighbor] = candidateDistance;
        previous[neighbor] = current;
      }
    }
  }

  if (distances[endNode] === Infinity) {
    return { path: [], transitTime: Infinity, exists: false };
  }

  const path: string[] = [];
  let cursor: string | null = endNode;
  while (cursor) {
    path.unshift(cursor);
    cursor = previous[cursor];
  }

  return {
    path,
    transitTime: distances[endNode],
    exists: true
  };
}

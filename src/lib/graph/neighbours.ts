import type { EntityId, GraphEdge, GraphIndex } from '../model/types.js';

export interface Neighbour {
  id: EntityId;
  edge: GraphEdge;
  direction: 'out' | 'in';
}

/** All direct (1-hop) neighbours of `id`, outgoing then incoming, sorted (A3). */
export function neighbours1(index: GraphIndex, id: EntityId): Neighbour[] {
  const out = (index.outgoing.get(id) ?? []).map((edge) => ({ id: edge.to, edge, direction: 'out' as const }));
  const inn = (index.incoming.get(id) ?? []).map((edge) => ({ id: edge.from, edge, direction: 'in' as const }));
  return [...out, ...inn];
}

/** Neighbours within `depth` hops (BFS), excluding the origin. Deterministic order (A3). */
export function neighbours(index: GraphIndex, id: EntityId, depth: number): Neighbour[] {
  const visited = new Set<EntityId>([id]);
  const result: Neighbour[] = [];
  let frontier: EntityId[] = [id];
  for (let hop = 0; hop < depth && frontier.length > 0; hop++) {
    const nextFrontier: EntityId[] = [];
    for (const current of frontier) {
      for (const n of neighbours1(index, current)) {
        if (visited.has(n.id)) continue;
        visited.add(n.id);
        result.push(n);
        nextFrontier.push(n.id);
      }
    }
    frontier = nextFrontier;
  }
  return result;
}

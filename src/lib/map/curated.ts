// `/map2`'s only real difference from `/map`: it renders a fixed, curated
// entity-id subset instead of the whole corpus. Pure, so the edge-dropping
// rule (an edge is kept only when BOTH endpoints survive the cut) is
// unit-testable independent of the page/Cytoscape wiring.
interface RelRef {
  id: string;
}
interface CuratedNode {
  id: string;
  outgoing: RelRef[];
  incoming: RelRef[];
  degree: { in: number; out: number };
  noRelations: boolean;
}
interface CuratedEdge {
  from: string;
  to: string;
}

export function filterToEntitySet<N extends CuratedNode, E extends CuratedEdge>(
  nodes: readonly N[],
  edges: readonly E[],
  ids: readonly string[],
): { nodes: N[]; edges: E[] } {
  const idSet = new Set(ids);
  const nodesInSet = nodes.filter((n) => idSet.has(n.id));
  const filteredNodes = nodesInSet.map((n) => {
    const outgoing = n.outgoing.filter((r) => idSet.has(r.id));
    const incoming = n.incoming.filter((r) => idSet.has(r.id));
    const degree = { in: incoming.length, out: outgoing.length };
    return { ...n, outgoing, incoming, degree, noRelations: degree.in === 0 && degree.out === 0 };
  });
  const filteredEdges = edges.filter((e) => idSet.has(e.from) && idSet.has(e.to));
  return { nodes: filteredNodes, edges: filteredEdges };
}

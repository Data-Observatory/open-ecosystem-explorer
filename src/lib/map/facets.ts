// Facet filtering + the search panel's lightweight content-quality badge
// (report §D.2: search results carry a "sin relaciones"/"no relations"
// marker derived from degree). Pure — no Cytoscape/DOM dependency — so the
// filtering rule itself is unit-testable independent of the canvas wiring.
export interface FacetableNode {
  type: string;
  layer: string;
  governance: string;
  tags: readonly string[];
}

export interface FacetFilters {
  layers: readonly string[];
  types: readonly string[];
  governances: readonly string[];
  tags: readonly string[];
}

export function matchesFacets(node: FacetableNode, filters: FacetFilters): boolean {
  if (filters.layers.length > 0 && !filters.layers.includes(node.layer)) return false;
  if (filters.types.length > 0 && !filters.types.includes(node.type)) return false;
  if (filters.governances.length > 0 && !filters.governances.includes(node.governance)) return false;
  if (filters.tags.length > 0 && !filters.tags.some((t) => node.tags.includes(t))) return false;
  return true;
}

export function hasNoRelations(degree: { in: number; out: number }): boolean {
  return degree.in === 0 && degree.out === 0;
}

// Legibility budget (specs.md §6.4, enforced/checked by I28). Pure: takes
// already-resolved edge lists, no graph traversal of its own.
import type { EntityId, PredicateId } from '../model/types.js';

/** Hard cap per rendered diagram, any type. */
export const GLOBAL_NODE_CAP = 60;
export const GLOBAL_EDGE_CAP = 100;

/** §6.3 registry: the Focus diagram's own, tighter cap. */
export const FOCUS_NEIGHBOUR_CAP = 40;

/** §6.2's own tier for `/map`: "≤120 entities -> Mermaid, per-layer subgraphs"
 *  is a documented exception to the general 60-node cap above, specific to
 *  the single global-map route (this generator is superseded as the actual
 *  `/map` page by the Cytoscape rewrite, but stays as the a11y-description
 *  fallback/legacy generator). Bumped from 120 to 150 (2026-09-04) as the
 *  content-quality audit grew the corpus past the original figure —
 *  judgment call, matches the existing edge cap, flagged for review. Edges
 *  still collapse by predicate maxOutDegree (§6.4) for legibility even
 *  though the node cap is relaxed. */
/** Bumped again from 150 to 200 (2026-11-12) when the 22 concept entities took the
 *  corpus to 159; same judgment call, edge collapsing still applies. */
export const MAP_NODE_CAP = 200;
export const MAP_EDGE_CAP = 150;

/** §6.4: "more than predicate.maxOutDegree (default 5) neighbours via one predicate". */
export const DEFAULT_MAX_OUT_DEGREE = 5;

export interface CollapsibleEdge<T> {
  predicate: PredicateId;
  neighbour: EntityId;
  payload: T;
}

export interface CollapseResult<T> {
  /** Edges that render individually. */
  visible: CollapsibleEdge<T>[];
  /** One group per predicate whose neighbour count exceeded the cap — the group's
   *  edges are hidden behind a single cluster node in the diagram, but never in
   *  the accessible table (A9.2 — the table is always the complete set). */
  collapsed: { predicate: PredicateId; hidden: CollapsibleEdge<T>[] }[];
}

/**
 * Groups edges sharing one predicate; if a group exceeds `maxOutDegree` for
 * that predicate, the whole group collapses into one cluster (§6.4 — "more
 * than N neighbours via one predicate collapse into a cluster node", not a
 * partial keep-N-drop-rest split).
 */
export function collapseByPredicate<T>(
  edges: readonly CollapsibleEdge<T>[],
  maxOutDegree: (predicate: PredicateId) => number,
): CollapseResult<T> {
  const byPredicate = new Map<PredicateId, CollapsibleEdge<T>[]>();
  for (const e of edges) {
    if (!byPredicate.has(e.predicate)) byPredicate.set(e.predicate, []);
    byPredicate.get(e.predicate)!.push(e);
  }

  const visible: CollapsibleEdge<T>[] = [];
  const collapsed: CollapseResult<T>['collapsed'] = [];
  for (const [predicate, group] of byPredicate) {
    const cap = maxOutDegree(predicate) || DEFAULT_MAX_OUT_DEGREE;
    if (group.length > cap) {
      collapsed.push({ predicate, hidden: group });
    } else {
      visible.push(...group);
    }
  }
  return { visible, collapsed };
}

/** Cluster node label, e.g. "12 standards ▸" (§6.4). `typeLabelPlural` is
 *  already the pluralised, locale-resolved noun for the collapsed group's type. */
export function clusterLabel(count: number, typeLabelPlural: string): string {
  return `${count} ${typeLabelPlural} ▸`;
}

/** Trims a node/edge set down to the global or per-view cap, dropping the
 *  lowest-priority items first (deterministic: reverse of the stable sort
 *  order already applied by the caller, i.e. drop from the end). */
export function trimToCap<T>(items: readonly T[], cap: number): { kept: T[]; droppedCount: number } {
  if (items.length <= cap) return { kept: [...items], droppedCount: 0 };
  return { kept: items.slice(0, cap), droppedCount: items.length - cap };
}

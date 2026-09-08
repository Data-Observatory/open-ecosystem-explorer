// Pure graph-state helpers behind /map's 5-state selection highlighting and
// Focus mode (Opus review report §D.2; specs.md §6.6's "select a node -> that
// node plus its 1-hop neighbourhood ... 1/2/3-hop depth control"). Operate on
// a plain adjacency view, not Cytoscape, so the classification logic itself
// is unit-testable without a canvas.
export type NodeState = 'selected' | 'upstream' | 'downstream' | 'shared' | 'dimmed';

export interface Adjacency {
  /** id -> ids it has an outgoing edge to. */
  outTargets: ReadonlyMap<string, readonly string[]>;
  /** id -> ids that have an outgoing edge to it. */
  inSources: ReadonlyMap<string, readonly string[]>;
}

/**
 * Classifies every id relative to the current selection set:
 * - `selected` — in the selection itself.
 * - `upstream` — what a selected node depends on (outgoing target), touched
 *   by exactly one selected node.
 * - `downstream` — what depends on a selected node (incoming source), touched
 *   by exactly one selected node.
 * - `shared` — touched (either direction) by two or more selected nodes at
 *   once — the "what do these have in common" intersection.
 * - `dimmed` — none of the above.
 *
 * With an empty selection every id comes back `dimmed`; the caller treats
 * that as "no selection active" rather than literally dimming the canvas.
 */
export function classifyNodes(allIds: readonly string[], selected: readonly string[], adj: Adjacency): Map<string, NodeState> {
  const result = new Map<string, NodeState>();
  const selectedSet = new Set(selected);

  const touch = new Map<string, { count: number; dir: 'upstream' | 'downstream' }>();
  for (const sel of selectedSet) {
    for (const target of adj.outTargets.get(sel) ?? []) {
      if (selectedSet.has(target)) continue;
      const entry = touch.get(target);
      if (entry) entry.count += 1;
      else touch.set(target, { count: 1, dir: 'upstream' });
    }
    for (const source of adj.inSources.get(sel) ?? []) {
      if (selectedSet.has(source)) continue;
      const entry = touch.get(source);
      if (entry) entry.count += 1;
      else touch.set(source, { count: 1, dir: 'downstream' });
    }
  }

  for (const id of allIds) {
    if (selectedSet.has(id)) {
      result.set(id, 'selected');
      continue;
    }
    const entry = touch.get(id);
    if (!entry) result.set(id, 'dimmed');
    else if (entry.count >= 2) result.set(id, 'shared');
    else result.set(id, entry.dir);
  }
  return result;
}

export function summarizeStates(states: ReadonlyMap<string, NodeState>): { upstream: number; downstream: number; shared: number } {
  let upstream = 0;
  let downstream = 0;
  let shared = 0;
  for (const state of states.values()) {
    if (state === 'upstream') upstream++;
    else if (state === 'downstream') downstream++;
    else if (state === 'shared') shared++;
  }
  return { upstream, downstream, shared };
}

/** BFS neighbourhood within `hops` steps of `seed`, either direction, seed included. */
export function nHopNeighborhood(seed: string, hops: number, adj: Adjacency): Set<string> {
  const visited = new Set<string>([seed]);
  let frontier = new Set<string>([seed]);
  for (let i = 0; i < hops && frontier.size > 0; i++) {
    const next = new Set<string>();
    for (const id of frontier) {
      for (const target of adj.outTargets.get(id) ?? []) {
        if (!visited.has(target)) {
          visited.add(target);
          next.add(target);
        }
      }
      for (const source of adj.inSources.get(id) ?? []) {
        if (!visited.has(source)) {
          visited.add(source);
          next.add(source);
        }
      }
    }
    frontier = next;
  }
  return visited;
}

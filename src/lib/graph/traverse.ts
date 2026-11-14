import type { EntityId, GraphEdge } from '../model/types.js';

/**
 * Detects a cycle in a directed edge set using DFS with a recursion stack.
 * Returns the cycle path (entity ids, closing on the repeated id) or null if
 * the subgraph is a DAG. Used by invariant I10 against the edges of a single
 * acyclic predicate (or a `sameTypeOnly` predicate's own subgraph).
 */
export function findCycle(edges: readonly GraphEdge[]): EntityId[] | null {
	const adjacency = new Map<EntityId, EntityId[]>();
	for (const edge of edges) {
		if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
		adjacency.get(edge.from)!.push(edge.to);
	}

	const WHITE = 0;
	const GRAY = 1;
	const BLACK = 2;
	const color = new Map<EntityId, number>();
	const stack: EntityId[] = [];

	function visit(node: EntityId): EntityId[] | null {
		color.set(node, GRAY);
		stack.push(node);
		for (const next of adjacency.get(node) ?? []) {
			const state = color.get(next) ?? WHITE;
			if (state === GRAY) {
				const cycleStart = stack.indexOf(next);
				return [...stack.slice(cycleStart), next];
			}
			if (state === WHITE) {
				const found = visit(next);
				if (found) return found;
			}
		}
		stack.pop();
		color.set(node, BLACK);
		return null;
	}

	const nodes = new Set<EntityId>();
	for (const edge of edges) {
		nodes.add(edge.from);
		nodes.add(edge.to);
	}
	for (const node of nodes) {
		if ((color.get(node) ?? WHITE) === WHITE) {
			const found = visit(node);
			if (found) return found;
		}
	}
	return null;
}

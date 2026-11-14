// Build-time graph layout for the minimal map (`/{loc}/map3`). Pure and
// deterministic (specs.md A3): no Math.random, no Date, fixed iteration
// order (ids sorted), integer output. Same nodes + edges => same positions,
// so the committed `src/generated/graph-layout.json` only changes when the
// graph does, and the browser never runs a simulation.
//
// Two stages:
//  1. The anchors (the default view) are placed on their own by stress
//     minimisation: every pair wants to sit at a distance proportional to
//     its hop distance in the FULL graph, so related anchors end up close
//     and the 14-node default view is evenly spread.
//  2. Every other node is seeded next to its already-placed neighbours and
//     relaxed with a small force simulation (springs + repulsion + weak
//     gravity) while the anchors stay pinned. A final pass separates label
//     boxes so no two nodes' labels overlap at 1:1 zoom; if that local push
//     stalls, a deterministic spiral fallback relocates the stragglers, so the
//     no-overlap guarantee does not depend on the particular graph.

export interface LayoutNode {
	id: string;
	anchor: boolean;
}
export interface LayoutEdge {
	from: string;
	to: string;
}
export type LayoutPositions = Record<string, [number, number]>;

/** Label footprint (model px) reserved around each node by the overlap pass. */
const BOX = { anchor: { w: 168, h: 84 }, node: { w: 128, h: 62 } } as const;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

interface P {
	x: number;
	y: number;
}

/**
 * Label-footprint collision. Each node is an ellipse (its label box's
 * inscribing ellipse); overlapping pairs are pushed apart along the line
 * between their centres, which — unlike an axis-aligned box push — lets a
 * node squeezed between two pinned anchors slide out sideways and converge.
 */
function separateBoxes(pos: P[], anchor: boolean[], pinned: boolean[], passes: number): void {
	const n = pos.length;
	for (let pass = 0; pass < passes; pass++) {
		let moved = false;
		for (let i = 0; i < n; i++) {
			for (let j = i + 1; j < n; j++) {
				const pi = pinned[i]!;
				const pj = pinned[j]!;
				if (pi && pj) continue;
				const a = pos[i]!;
				const b = pos[j]!;
				const bi = anchor[i] ? BOX.anchor : BOX.node;
				const bj = anchor[j] ? BOX.anchor : BOX.node;
				// Work in a space where the combined footprint is a unit circle.
				const sx = (bi.w + bj.w) / 2;
				const sy = (bi.h + bj.h) / 2;
				let ux = (b.x - a.x) / sx;
				let uy = (b.y - a.y) / sy;
				let d = Math.sqrt(ux * ux + uy * uy);
				if (d >= 1) continue;
				if (d < 1e-6) {
					// Coincident: split along a direction fixed by the pair's indices.
					const angle = (i * 31 + j) * GOLDEN_ANGLE;
					ux = Math.cos(angle);
					uy = Math.sin(angle);
					d = 1e-6;
				} else {
					ux /= d;
					uy /= d;
				}
				moved = true;
				const push = 1 - d + 0.01;
				const shareI = pi ? 0 : pj ? 1 : 0.5;
				a.x -= ux * push * sx * shareI;
				a.y -= uy * push * sy * shareI;
				b.x += ux * push * sx * (1 - shareI);
				b.y += uy * push * sy * (1 - shareI);
			}
		}
		if (!moved) break;
	}
}

/** True when two nodes' combined label footprints overlap (same metric as `separateBoxes`). */
function overlaps(a: P, b: P, anchorA: boolean, anchorB: boolean, margin: number): boolean {
	const ba = anchorA ? BOX.anchor : BOX.node;
	const bb = anchorB ? BOX.anchor : BOX.node;
	const ux = (b.x - a.x) / ((ba.w + bb.w) / 2);
	const uy = (b.y - a.y) / ((ba.h + bb.h) / 2);
	return ux * ux + uy * uy < margin * margin;
}

/**
 * Deterministic last resort. `separateBoxes` is a local push-apart and can stall
 * in a crowded pocket between pinned anchors (a push resolves one pair and
 * creates another), so it cannot guarantee convergence. Any non-pinned node
 * still overlapping another node is moved to the nearest free spot on a
 * golden-angle spiral around where it is. Nodes are visited in sorted-id order
 * and each move leaves the moved node overlap-free without touching any other,
 * so the overlap count strictly falls and the loop terminates (the spiral
 * eventually leaves any finite cluster). Does nothing when the pass converged.
 */
function resolveResidual(pos: P[], anchor: boolean[], pinned: boolean[]): void {
	const n = pos.length;
	const clashes = (i: number, at: P, margin: number): boolean => {
		for (let j = 0; j < n; j++) {
			if (j !== i && overlaps(at, pos[j]!, anchor[i]!, anchor[j]!, margin)) return true;
		}
		return false;
	};
	for (let round = 0; round < n; round++) {
		let moved = false;
		for (let i = 0; i < n; i++) {
			if (pinned[i] || !clashes(i, pos[i]!, 1)) continue;
			const home = pos[i]!;
			for (let k = 1; ; k++) {
				const t = Math.sqrt(k) * 24;
				const angle = (k + i) * GOLDEN_ANGLE;
				const cand: P = { x: home.x + t * Math.cos(angle) * 2, y: home.y + t * Math.sin(angle) };
				if (!clashes(i, cand, 1.02)) {
					pos[i] = cand;
					moved = true;
					break;
				}
			}
		}
		if (!moved) break;
	}
}

export function computeLayout(
	nodes: readonly LayoutNode[],
	edges: readonly LayoutEdge[]
): LayoutPositions {
	const sorted = [...nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	const n = sorted.length;
	const indexOf = new Map(sorted.map((node, i) => [node.id, i]));
	const anchor = sorted.map((node) => node.anchor);

	// Undirected, de-duplicated adjacency; neighbour lists sorted by index.
	const adjacency: Set<number>[] = sorted.map(() => new Set<number>());
	for (const e of edges) {
		const a = indexOf.get(e.from);
		const b = indexOf.get(e.to);
		if (a === undefined || b === undefined || a === b) continue;
		adjacency[a]!.add(b);
		adjacency[b]!.add(a);
	}
	const adj = adjacency.map((s) => [...s].sort((x, y) => x - y));
	const links: [number, number][] = [];
	for (let a = 0; a < n; a++) for (const b of adj[a]!) if (a < b) links.push([a, b]);

	const pos: P[] = sorted.map(() => ({ x: 0, y: 0 }));
	const placed = sorted.map(() => false);

	// ---- Stage 1: anchors by stress minimisation ----
	const anchors = sorted.map((_, i) => i).filter((i) => anchor[i]);
	const m = anchors.length;
	const hops = (from: number): number[] => {
		const dist = new Array<number>(n).fill(Infinity);
		dist[from] = 0;
		const queue = [from];
		for (let head = 0; head < queue.length; head++) {
			const cur = queue[head]!;
			for (const next of adj[cur]!) {
				if (dist[next] === Infinity) {
					dist[next] = dist[cur]! + 1;
					queue.push(next);
				}
			}
		}
		return dist;
	};
	const want: number[][] = anchors.map((a) => {
		const dist = hops(a);
		return anchors.map((b) => 300 + 85 * (Math.min(dist[b]!, 5) - 1));
	});
	anchors.forEach((a, k) => {
		const angle = (2 * Math.PI * k) / Math.max(m, 1);
		pos[a] = { x: 500 * Math.cos(angle), y: 500 * Math.sin(angle) };
		placed[a] = true;
	});
	for (let iter = 0; iter < 400; iter++) {
		const eta = 0.5 * (1 - iter / 400) + 0.02;
		for (let i = 0; i < m; i++) {
			for (let j = i + 1; j < m; j++) {
				const a = pos[anchors[i]!]!;
				const b = pos[anchors[j]!]!;
				const dx = a.x - b.x;
				const dy = a.y - b.y;
				const d = Math.sqrt(dx * dx + dy * dy) || 1;
				const target = want[i]![j]!;
				const step = (eta * (d - target)) / 2 / d;
				a.x -= dx * step;
				a.y -= dy * step;
				b.x += dx * step;
				b.y += dy * step;
			}
		}
	}
	// Landscape canvas: stretch the anchor constellation horizontally.
	for (const a of anchors) pos[a]!.x *= 1.35;
	const anchorFlags = sorted.map(() => true);
	separateBoxes(
		anchors.map((a) => pos[a]!),
		anchorFlags,
		sorted.map(() => false),
		200
	);

	// ---- Stage 2: everything else, anchors pinned ----
	// Seed in BFS order from the anchors, next to already-placed neighbours.
	const order: number[] = [...anchors];
	const seen = sorted.map((_, i) => anchor[i]!);
	for (let head = 0; head < order.length; head++) {
		for (const next of adj[order[head]!]!) {
			if (!seen[next]) {
				seen[next] = true;
				order.push(next);
			}
		}
	}
	for (let i = 0; i < n; i++) if (!seen[i]) order.push(i); // disconnected leftovers
	order.forEach((i, k) => {
		if (placed[i]) return;
		const around = adj[i]!.filter((j) => placed[j]);
		let cx = 0;
		let cy = 0;
		for (const j of around) {
			cx += pos[j]!.x;
			cy += pos[j]!.y;
		}
		if (around.length > 0) {
			cx /= around.length;
			cy /= around.length;
		}
		const angle = k * GOLDEN_ANGLE;
		pos[i] = { x: cx + 70 * Math.cos(angle), y: cy + 70 * Math.sin(angle) };
		placed[i] = true;
	});

	const vx = new Array<number>(n).fill(0);
	const vy = new Array<number>(n).fill(0);
	const ITER = 500;
	for (let iter = 0; iter < ITER; iter++) {
		const alpha = 1 - iter / ITER;
		// Repulsion (all pairs; n is ~150, so O(n^2) is trivial).
		for (let i = 0; i < n; i++) {
			for (let j = i + 1; j < n; j++) {
				const dx = pos[i]!.x - pos[j]!.x;
				const dy = pos[i]!.y - pos[j]!.y;
				const d2 = Math.max(dx * dx + dy * dy, 100);
				if (d2 > 700 * 700) continue;
				const f = (40000 * alpha) / d2;
				const d = Math.sqrt(d2);
				vx[i]! += (dx / d) * f;
				vy[i]! += (dy / d) * f;
				vx[j]! -= (dx / d) * f;
				vy[j]! -= (dy / d) * f;
			}
		}
		// Springs, weaker on hubs so a 12-neighbour node is not crushed.
		for (const [a, b] of links) {
			const dx = pos[b]!.x - pos[a]!.x;
			const dy = pos[b]!.y - pos[a]!.y;
			const d = Math.sqrt(dx * dx + dy * dy) || 1;
			const strength = 0.22 / Math.min(adj[a]!.length, adj[b]!.length);
			const f = (d - 150) * strength * alpha;
			vx[a]! += (dx / d) * f;
			vy[a]! += (dy / d) * f;
			vx[b]! -= (dx / d) * f;
			vy[b]! -= (dy / d) * f;
		}
		for (let i = 0; i < n; i++) {
			if (anchor[i]) continue;
			vx[i] = (vx[i]! - pos[i]!.x * 0.002 * alpha) * 0.6;
			vy[i] = (vy[i]! - pos[i]!.y * 0.004 * alpha) * 0.6;
			pos[i]!.x += vx[i]!;
			pos[i]!.y += vy[i]!;
		}
		// Keep label boxes apart while the simulation cools, so the final pass
		// only has residual overlaps to resolve.
		if (iter > ITER / 3) separateBoxes(pos, anchor, anchor, 1);
	}
	separateBoxes(pos, anchor, anchor, 2000);
	resolveResidual(pos, anchor, anchor);

	const out: LayoutPositions = {};
	sorted.forEach((node, i) => {
		out[node.id] = [Math.round(pos[i]!.x), Math.round(pos[i]!.y)];
	});
	return out;
}

/** Canonical file body: one node per line, ids sorted, trailing newline. */
export function serializeLayout(positions: LayoutPositions): string {
	const ids = Object.keys(positions).sort();
	const lines = ids.map(
		(id) => `    ${JSON.stringify(id)}: [${positions[id]![0]}, ${positions[id]![1]}]`
	);
	return `{\n  "version": 1,\n  "positions": {\n${lines.join(',\n')}\n  }\n}\n`;
}

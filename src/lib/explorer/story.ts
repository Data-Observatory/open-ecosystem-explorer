/**
 * Guided stories on the map (map-ideas report, idea 1): where a story's nodes sit, and what is
 * on screen at each step. A story never moves a node between steps: the whole path is laid out
 * once, steps only reveal more of it and move the camera.
 */
import { pairKey } from './graph.js';
import type { LabelSide, MapStory, Point } from './types.js';

export interface StoryPlacement extends Point {
	side: LabelSide;
}

export function clampStep(story: MapStory, step: number): number {
	return Math.min(Math.max(0, Math.trunc(step) || 0), story.steps.length - 1);
}

export interface StoryFrame {
	focus: string;
	/** Every node revealed so far, in order of appearance. */
	visible: string[];
	/** Nodes this step is about: its focus, what it reveals, and the ends of its edges. */
	current: string[];
	/** Node pairs highlighted in this step. */
	currentPairs: string[];
	/** Node pairs highlighted in earlier steps (they stay, quietly). */
	pastPairs: string[];
}

/** What step `step` (0-based, clamped) of the story shows. */
export function storyFrame(story: MapStory, step: number): StoryFrame {
	const at = clampStep(story, step);
	const visible: string[] = [];
	const see = (id: string) => {
		if (!visible.includes(id)) visible.push(id);
	};
	const past = new Set<string>();
	let current: string[] = [];
	let currentPairs: string[] = [];
	story.steps.slice(0, at + 1).forEach((s, i) => {
		const ids = [
			s.focus,
			...s.reveal,
			...s.edges.flatMap(([source, , target]) => [source, target])
		];
		ids.forEach(see);
		const pairs = [...new Set(s.edges.map(([source, , target]) => pairKey(source, target)))];
		if (i === at) {
			current = [...new Set(ids)];
			currentPairs = pairs;
		} else {
			pairs.forEach((p) => past.add(p));
		}
	});
	return {
		focus: story.steps[at]?.focus ?? '',
		visible,
		current,
		currentPairs,
		pastPairs: [...past].filter((p) => !currentPairs.includes(p))
	};
}

const sideFor = (cos: number, sin: number): LabelSide =>
	Math.abs(cos) > 0.38 ? (cos > 0 ? 'right' : 'left') : sin > 0 ? 'below' : 'above';

/**
 * Lays a story out as a radial tree. The first focus is the root; every later node hangs from
 * the node it is introduced through: the other end of one of its step's edges if already
 * placed, else any placed node it has a relation with (the latest focus first), else the
 * previous focus. A root's children go around it; deeper children fan out away from the
 * grandparent. A final pass pushes apart nodes whose label footprints overlap.
 *
 * Deterministic: depends only on the story and on `linked`.
 */
export function layoutStory(
	story: MapStory,
	linked: (a: string, b: string) => boolean,
	radius = 190
): Record<string, StoryPlacement> {
	const order: string[] = [];
	const parent = new Map<string, string>();
	const focuses: string[] = [];

	for (const step of story.steps) {
		const introduce = (id: string) => {
			if (order.includes(id)) return;
			if (order.length > 0) {
				const viaStepEdge = step.edges
					.map(([source, , target]) => (source === id ? target : target === id ? source : ''))
					.find((other) => other !== '' && order.includes(other));
				const recentFocuses = [...focuses].reverse();
				const viaRelation =
					recentFocuses.find((f) => f !== id && linked(f, id)) ??
					[...order].reverse().find((o) => linked(o, id));
				parent.set(id, viaStepEdge ?? viaRelation ?? recentFocuses[0] ?? order[0] ?? id);
			}
			order.push(id);
		};
		introduce(step.focus);
		if (!focuses.includes(step.focus)) focuses.push(step.focus);
		step.edges.forEach(([source, , target]) => {
			introduce(source);
			introduce(target);
		});
		step.reveal.forEach(introduce);
	}

	const children = new Map<string, string[]>();
	for (const id of order) {
		const p = parent.get(id);
		if (p) children.set(p, [...(children.get(p) ?? []), id]);
	}

	const out: Record<string, StoryPlacement> = {};
	const root = order[0];
	if (!root) return out;
	out[root] = { x: 0, y: 0, side: 'below' };

	const place = (id: string, heading: number | null, depth: number) => {
		const kids = children.get(id) ?? [];
		const at = out[id];
		if (!at) return;
		kids.forEach((kid, j) => {
			let angle: number;
			if (heading === null) {
				angle = kids.length === 1 ? 0 : -Math.PI / 2 + ((j + 0.5) * 2 * Math.PI) / kids.length;
			} else {
				const spread = Math.min(Math.PI / 3.2, (Math.PI * 1.1) / kids.length);
				angle = heading + (j - (kids.length - 1) / 2) * spread;
			}
			const r = radius * (depth === 0 ? 1 : 0.82);
			const cos = Math.cos(angle);
			const sin = Math.sin(angle);
			// A slightly flattened circle: the canvas is wider than tall.
			out[kid] = { x: at.x + r * cos * 1.2, y: at.y + r * sin, side: sideFor(cos, sin) };
			place(kid, angle, depth + 1);
		});
	};
	place(root, null, 0);

	separate(order, out);
	for (const id of order) {
		const at = out[id];
		if (at) out[id] = { x: Math.round(at.x), y: Math.round(at.y), side: at.side };
	}
	return out;
}

/** Label footprint (model px) each story node keeps clear. */
const FOOTPRINT = { w: 150, h: 64 };

function separate(order: readonly string[], out: Record<string, StoryPlacement>): void {
	for (let pass = 0; pass < 120; pass++) {
		let moved = false;
		for (let i = 0; i < order.length; i++) {
			for (let j = i + 1; j < order.length; j++) {
				const a = out[order[i] ?? ''];
				const b = out[order[j] ?? ''];
				if (!a || !b) continue;
				let ux = (b.x - a.x) / FOOTPRINT.w;
				let uy = (b.y - a.y) / FOOTPRINT.h;
				let d = Math.hypot(ux, uy);
				if (d >= 1) continue;
				if (d < 1e-6) {
					ux = Math.cos(i * 2.4 + j);
					uy = Math.sin(i * 2.4 + j);
					d = 1e-6;
				} else {
					ux /= d;
					uy /= d;
				}
				moved = true;
				const push = 1 - d + 0.02;
				// The root (index 0) stays at the origin; otherwise both nodes share the push.
				const shareA = i === 0 ? 0 : 0.5;
				a.x -= ux * push * FOOTPRINT.w * shareA;
				a.y -= uy * push * FOOTPRINT.h * shareA;
				b.x += ux * push * FOOTPRINT.w * (1 - shareA);
				b.y += uy * push * FOOTPRINT.h * (1 - shareA);
			}
		}
		if (!moved) break;
	}
}

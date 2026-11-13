/**
 * What the canvas shows for a given state ("scene"), and how one scene turns into the next.
 *
 * Four scenes, one renderer:
 *  - start:  the composed anchors (compose.ts);
 *  - focus:  a selected node with its neighbours on a ring (default mode);
 *  - story:  the path revealed so far (story.ts);
 *  - expert: the whole corpus at its build-time positions, filtered.
 *
 * `buildScene` is pure. The renderer tweens between scenes with `interpolateGeometry`: positions
 * and opacities are numbers, so a transition is one interpolation, never a physics simulation.
 */
import { composition, tierOf, type Tier } from './compose.js';
import {
	fitCamera,
	freeArea,
	ringExtent,
	ringRadius,
	ringSlots,
	FULL_RING_MAX
} from './geometry.js';
import { chooseRing, pairKey, type MapIndex } from './graph.js';
import { layoutStory, storyFrame } from './story.js';
import type { Camera, LabelSide, MapStory, MapThemeId, Point, Viewport } from './types.js';

export type NodeTone = 'focus' | 'normal' | 'muted';
export type EdgeTone = 'quiet' | 'strong' | 'accent' | 'faint';

export interface SceneNode extends Point {
	id: string;
	tier: Tier;
	side: LabelSide;
	/** Whether the label is drawn (expert mode hides most labels until zoomed in). */
	label: boolean;
	tone: NodeTone;
}

export interface SceneEdge {
	/** Pair key: one line per pair of nodes. */
	key: string;
	s: string;
	t: string;
	tone: EdgeTone;
}

export interface SceneCaption extends Point {
	id: MapThemeId;
}

export interface Scene {
	kind: 'start' | 'focus' | 'story' | 'expert';
	nodes: SceneNode[];
	edges: SceneEdge[];
	captions: SceneCaption[];
	cam: Camera;
	/** Where nodes entering this scene grow from. */
	origin: Point;
	/** Neighbours of the selected node left off the ring ("show N more"). */
	hidden: number;
}

export interface SceneInput {
	index: MapIndex;
	vp: Viewport;
	/** Phone layout: the canvas is a short strip, labels are fewer and shorter. */
	compact: boolean;
	locale: string;
	expert: boolean;
	selected: string | null;
	expanded: boolean;
	/** Where the selected node sits (default mode): its place in the scene it was picked from. */
	focusAt: Point;
	story: { story: MapStory; step: number } | null;
	type: string;
	family: string;
	/** Expert mode camera after the reader panned or zoomed; null = fit everything. */
	userCam: Camera | null;
}

/** How many neighbours the ring shows before "show N more". */
export const ringCapacity = (compact: boolean): number => (compact ? 6 : 8);

/** Screen space kept free around a fitted scene for labels. */
const padFor = (compact: boolean) => (compact ? { x: 44, y: 30 } : { x: 120, y: 30 });

export function buildScene(input: SceneInput): Scene {
	if (input.story) return storyScene(input, input.story.story, input.story.step);
	if (input.expert) return expertScene(input);
	if (input.selected && input.index.byId.has(input.selected)) return focusScene(input);
	return startScene(input);
}

function startScene({ index, vp, compact }: SceneInput): Scene {
	const composed = composition(compact);
	const ids = Object.keys(composed.nodes).filter((id) => index.byId.has(id));
	const nodes: SceneNode[] = ids.map((id) => {
		const c = composed.nodes[id]!;
		return { id, x: c.x, y: c.y, tier: c.tier, side: c.side, label: true, tone: 'normal' };
	});
	const shown = new Set(ids);
	const seen = new Set<string>();
	const edges: SceneEdge[] = [];
	for (const edge of index.graph.edges) {
		const key = pairKey(edge.s, edge.t);
		if (!shown.has(edge.s) || !shown.has(edge.t) || seen.has(key)) continue;
		seen.add(key);
		edges.push({ key, s: edge.s, t: edge.t, tone: 'quiet' });
	}
	const captions = Object.entries(composed.themes).map(([id, at]) => ({
		id: id as MapThemeId,
		x: at.x,
		y: at.y
	}));
	const cam = fitCamera([...nodes, ...captions], vp, padFor(compact), compact ? 1.15 : 1.25);
	return { kind: 'start', nodes, edges, captions, cam, origin: { x: 0, y: 0 }, hidden: 0 };
}

function focusScene(input: SceneInput): Scene {
	const { index, vp, compact, locale, focusAt } = input;
	const id = input.selected!;
	const choice = chooseRing(index, id, ringCapacity(compact), input.expanded, locale);
	const radius = ringRadius(
		vp,
		compact ? { x: 84, y: 34 } : { x: 150, y: 46 },
		compact ? { min: 78, max: 120 } : { min: 130, max: 210 }
	);
	const slots = ringSlots(choice.shown.length, radius);
	const nodes: SceneNode[] = [
		{
			id,
			x: focusAt.x,
			y: focusAt.y,
			tier: 1,
			// With neighbours all around, the label sits where the ring leaves a gap.
			side: choice.shown.length > 0 && choice.shown.length <= FULL_RING_MAX ? 'above' : 'below',
			label: true,
			tone: 'focus'
		},
		...choice.shown.map((n, i): SceneNode => {
			const slot = slots[i]!;
			return {
				id: n,
				x: focusAt.x + slot.x,
				y: focusAt.y + slot.y,
				tier: tierOf(n) === 3 ? 3 : 2,
				side: slot.side,
				label: true,
				tone: 'normal'
			};
		})
	];
	const edges = choice.shown.map((n): SceneEdge => ({
		key: pairKey(id, n),
		s: id,
		t: n,
		tone: 'strong'
	}));
	// Zoom out only when an expanded ring is larger than the free area.
	const extent = ringExtent(choice.shown.length, radius);
	const free = freeArea(vp);
	const label = compact ? { x: 60, y: 24 } : { x: 130, y: 40 };
	const k = Math.min(
		1,
		extent > 0 ? (free.w / 2 - label.x) / extent : 1,
		extent > 0 ? (free.h / 2 - label.y) / extent : 1
	);
	return {
		kind: 'focus',
		nodes,
		edges,
		captions: [],
		cam: { x: focusAt.x, y: focusAt.y, k: Math.max(0.35, k) },
		origin: focusAt,
		hidden: choice.hidden
	};
}

function storyScene(input: SceneInput, story: MapStory, step: number): Scene {
	const { index, vp, compact } = input;
	const placed = layoutStory(story, index.linked, compact ? 150 : 190);
	const frame = storyFrame(story, step);
	const current = new Set(frame.current);
	const nodes: SceneNode[] = frame.visible
		.filter((id) => index.byId.has(id) && placed[id])
		.map((id) => {
			const at = placed[id]!;
			return {
				id,
				x: at.x,
				y: at.y,
				tier: id === frame.focus ? 1 : tierOf(id) === 3 ? 3 : 2,
				side: at.side,
				label: true,
				tone: id === frame.focus ? 'focus' : current.has(id) ? 'normal' : 'muted'
			};
		});
	const edge = (key: string, tone: EdgeTone): SceneEdge => {
		const [s = '', t = ''] = key.split('|');
		return { key, s, t, tone };
	};
	const edges = [
		...frame.pastPairs.map((key) => edge(key, 'quiet')),
		...frame.currentPairs.map((key) => edge(key, 'accent'))
	];
	const inFrame = nodes.filter((n) => current.has(n.id));
	const cam = fitCamera(inFrame, vp, compact ? { x: 70, y: 40 } : { x: 170, y: 80 }, 1);
	const focus = placed[frame.focus] ?? { x: 0, y: 0 };
	return {
		kind: 'story',
		nodes,
		edges,
		captions: [],
		cam: { ...cam, k: Math.max(0.4, cam.k) },
		origin: { x: focus.x, y: focus.y },
		hidden: 0
	};
}

/** Expert mode: the lowest degree whose label is drawn at zoom `k` (anchors always are). */
export function labelDegreeAt(k: number): number {
	if (k < 0.55) return Infinity;
	if (k < 0.8) return 9;
	if (k < 1.1) return 5;
	if (k < 1.5) return 3;
	return 0;
}

function expertScene(input: SceneInput): Scene {
	const { index, vp, selected, type, family } = input;
	const familyEdges = family
		? index.graph.edges.filter((edge) => edge.f === family)
		: index.graph.edges;
	const touched = new Set(familyEdges.flatMap((edge) => [edge.s, edge.t]));
	const shown = index.graph.nodes.filter(
		(node) => (!type || node.type === type) && (!family || touched.has(node.id))
	);
	const ids = new Set(shown.map((node) => node.id));
	const near = new Set(selected ? (index.neighbours.get(selected) ?? []) : []);
	const hasFocus = selected !== null && ids.has(selected);

	// Fit everything, but never so small that the picture is a blot: below 0.4 the reader pans.
	const fit = fitCamera(shown, vp, { x: 60, y: 40 }, 1);
	const cam = input.userCam ?? { ...fit, k: Math.max(0.4, fit.k) };
	const minDegree = labelDegreeAt(cam.k);
	const nodes: SceneNode[] = shown.map((node) => {
		const tone: NodeTone = !hasFocus
			? 'normal'
			: node.id === selected
				? 'focus'
				: near.has(node.id)
					? 'normal'
					: 'muted';
		return {
			id: node.id,
			x: node.x,
			y: node.y,
			tier: node.id === selected ? 1 : tierOf(node.id),
			side: 'below',
			label: hasFocus ? tone !== 'muted' : node.anchor || node.degree >= minDegree,
			tone
		};
	});
	const seen = new Set<string>();
	const edges: SceneEdge[] = [];
	for (const edge of familyEdges) {
		const key = pairKey(edge.s, edge.t);
		if (!ids.has(edge.s) || !ids.has(edge.t) || seen.has(key)) continue;
		seen.add(key);
		const incident = hasFocus && (edge.s === selected || edge.t === selected);
		edges.push({
			key,
			s: edge.s,
			t: edge.t,
			tone: incident ? 'strong' : hasFocus ? 'faint' : 'quiet'
		});
	}
	const at = selected ? index.byId.get(selected) : undefined;
	return {
		kind: 'expert',
		nodes,
		edges,
		captions: [],
		cam,
		origin: at ? { x: at.x, y: at.y } : { x: cam.x, y: cam.y },
		hidden: 0
	};
}

// ---------------------------------------------------------------------------------------------
// Transitions

/** The numbers a transition interpolates: the camera and each node's [x, y, opacity]. */
export interface Geometry {
	cam: Camera;
	nodes: Record<string, [number, number, number]>;
	/** Start point of nodes that are not in the scene being left. */
	origin: Point;
}

export function geometryOf(scene: Scene): Geometry {
	const nodes: Geometry['nodes'] = {};
	for (const node of scene.nodes) nodes[node.id] = [node.x, node.y, 1];
	return { cam: scene.cam, nodes, origin: scene.origin };
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Interpolator from geometry `a` to `b` (the signature svelte/motion's Tween expects). Nodes in
 * both glide; nodes only in `b` grow out of `b.origin` while fading in; nodes only in `a` fade
 * out where they are and are gone at t = 1. The camera zoom is interpolated geometrically.
 */
export function interpolateGeometry(a: Geometry, b: Geometry): (t: number) => Geometry {
	const leaving = Object.keys(a.nodes).filter((id) => !(id in b.nodes));
	return (t) => {
		if (t >= 1) return b;
		if (t <= 0) return a;
		const nodes: Geometry['nodes'] = {};
		for (const [id, to] of Object.entries(b.nodes)) {
			const from = a.nodes[id] ?? [b.origin.x, b.origin.y, 0];
			nodes[id] = [lerp(from[0], to[0], t), lerp(from[1], to[1], t), lerp(from[2], to[2], t)];
		}
		for (const id of leaving) {
			const from = a.nodes[id]!;
			nodes[id] = [from[0], from[1], from[2] * (1 - Math.min(1, t * 2))];
		}
		return {
			cam: {
				x: lerp(a.cam.x, b.cam.x, t),
				y: lerp(a.cam.y, b.cam.y, t),
				k: a.cam.k * Math.pow(b.cam.k / a.cam.k, t)
			},
			nodes,
			origin: b.origin
		};
	};
}

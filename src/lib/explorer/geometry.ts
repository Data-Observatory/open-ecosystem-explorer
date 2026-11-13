/**
 * Pure geometry for the map: the camera (with its offset for overlays), the ring a selected
 * node's neighbours sit on, label wrapping and arrow-key movement. No DOM, no Svelte.
 */
import type { Camera, LabelSide, Point, Viewport } from './types.js';

// ---------------------------------------------------------------------------------------------
// Camera

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** The part of the canvas no overlay covers, in screen pixels. */
export function freeArea(vp: Viewport): Rect {
	const w = Math.max(1, vp.w - vp.inset.left - vp.inset.right);
	const h = Math.max(1, vp.h - vp.inset.top - vp.inset.bottom);
	return { x: vp.inset.left, y: vp.inset.top, w, h };
}

/**
 * Model point -> screen pixel. The camera's point lands in the centre of the FREE area, not of
 * the canvas: that offset is what keeps a selected node clear of the card.
 */
export function project(point: Point, cam: Camera, vp: Viewport): Point {
	const free = freeArea(vp);
	return {
		x: free.x + free.w / 2 + (point.x - cam.x) * cam.k,
		y: free.y + free.h / 2 + (point.y - cam.y) * cam.k
	};
}

export function unproject(screen: Point, cam: Camera, vp: Viewport): Point {
	const free = freeArea(vp);
	return {
		x: cam.x + (screen.x - free.x - free.w / 2) / cam.k,
		y: cam.y + (screen.y - free.y - free.h / 2) / cam.k
	};
}

export function boundsOf(points: readonly Point[]): Rect {
	if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const p of points) {
		minX = Math.min(minX, p.x);
		minY = Math.min(minY, p.y);
		maxX = Math.max(maxX, p.x);
		maxY = Math.max(maxY, p.y);
	}
	return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Camera that shows all `points` inside the free area with `pad` screen pixels to spare on each
 * side (room for labels), never zooming in past `maxK`.
 */
export function fitCamera(
	points: readonly Point[],
	vp: Viewport,
	pad: { x: number; y: number },
	maxK = 1
): Camera {
	const b = boundsOf(points);
	const free = freeArea(vp);
	const kx = b.w > 0 ? Math.max(1, free.w - 2 * pad.x) / b.w : Infinity;
	const ky = b.h > 0 ? Math.max(1, free.h - 2 * pad.y) / b.h : Infinity;
	const k = Math.min(maxK, kx, ky);
	return { x: b.x + b.w / 2, y: b.y + b.h / 2, k: Number.isFinite(k) ? k : maxK };
}

/** Zoom by `factor` keeping the model point under `screen` where it is. */
export function zoomAt(
	cam: Camera,
	factor: number,
	screen: Point,
	vp: Viewport,
	limits: { min: number; max: number }
): Camera {
	const k = Math.min(limits.max, Math.max(limits.min, cam.k * factor));
	const anchor = unproject(screen, cam, vp);
	const free = freeArea(vp);
	return {
		x: anchor.x - (screen.x - free.x - free.w / 2) / k,
		y: anchor.y - (screen.y - free.y - free.h / 2) / k,
		k
	};
}

// ---------------------------------------------------------------------------------------------
// Ring placement (map-ideas report, idea 5)

export interface RingSlot extends Point {
	side: LabelSide;
}

/** Up to this many neighbours sit on a full circle; more are laid out on two side arcs. */
export const FULL_RING_MAX = 10;
const ARC_HALF_ANGLE = Math.PI / 3;

const sideFor = (cos: number, sin: number): LabelSide =>
	Math.abs(cos) > 0.38 ? (cos > 0 ? 'right' : 'left') : sin > 0 ? 'below' : 'above';

/**
 * Positions for `n` neighbours around a node at the origin, clockwise from the top.
 *
 * - Up to FULL_RING_MAX: evenly on a circle of `radius`. Labels go outside the ring: left- or
 *   right-aligned on the sides, centred above or below near the poles.
 * - More than that: two arcs (right, then left) within 60 degrees of the horizontal, rows at
 *   least `rowGap` apart, so every label is left- or right-aligned and none can overlap. The
 *   radius grows as needed.
 *
 * Deterministic and fixed-radius: every edge from the selected node has the same length.
 */
export function ringSlots(n: number, radius: number, rowGap = 38): RingSlot[] {
	if (n <= 0) return [];
	if (n === 1) return [{ x: radius, y: 0, side: 'right' }];
	if (n <= FULL_RING_MAX) {
		return Array.from({ length: n }, (_, i) => {
			const angle = -Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / n;
			const cos = Math.cos(angle);
			const sin = Math.sin(angle);
			return { x: radius * cos, y: radius * sin, side: sideFor(cos, sin) };
		});
	}
	const right = Math.ceil(n / 2);
	const left = n - right;
	const r = Math.max(radius, ((right - 1) * rowGap) / (2 * Math.sin(ARC_HALF_ANGLE)));
	const half = r * Math.sin(ARC_HALF_ANGLE);
	const column = (count: number, sign: 1 | -1): RingSlot[] =>
		Array.from({ length: count }, (_, j) => {
			const t = count === 1 ? 0.5 : j / (count - 1);
			// Right arc runs top to bottom, left arc bottom to top: clockwise overall.
			const y = sign === 1 ? -half + t * 2 * half : half - t * 2 * half;
			return { x: sign * Math.sqrt(r * r - y * y), y, side: sign === 1 ? 'right' : 'left' };
		});
	return [...column(right, 1), ...column(left, -1)];
}

/** Largest distance from the centre used by `ringSlots(n, radius)`. */
export function ringExtent(n: number, radius: number, rowGap = 38): number {
	return ringSlots(n, radius, rowGap).reduce((max, s) => Math.max(max, Math.hypot(s.x, s.y)), 0);
}

/**
 * Ring radius that fits the free area: as large as the space allows between `min` and `max`,
 * leaving `label` pixels outside the ring for the labels.
 */
export function ringRadius(
	vp: Viewport,
	label: { x: number; y: number },
	limits: { min: number; max: number }
): number {
	const free = freeArea(vp);
	const fit = Math.min(free.w / 2 - label.x, free.h / 2 - label.y);
	return Math.round(Math.min(limits.max, Math.max(limits.min, fit)));
}

// ---------------------------------------------------------------------------------------------
// Labels

/** Greedy word wrap at about `max` characters per line, at most `maxLines` lines. */
export function wrapLabel(text: string, max = 16, maxLines = 3): string[] {
	const lines: string[] = [];
	for (const word of text.trim().split(/\s+/)) {
		const last = lines.at(-1);
		if (last !== undefined && (last.length + 1 + word.length <= max || lines.length === maxLines)) {
			lines[lines.length - 1] = `${last} ${word}`;
		} else {
			lines.push(word);
		}
	}
	return lines;
}

// ---------------------------------------------------------------------------------------------
// Keyboard

export type Direction = 'left' | 'right' | 'up' | 'down';

const VECTOR: Record<Direction, Point> = {
	left: { x: -1, y: 0 },
	right: { x: 1, y: 0 },
	up: { x: 0, y: -1 },
	down: { x: 0, y: 1 }
};

/**
 * The node an arrow key moves to: the nearest one inside a 120-degree cone in that direction,
 * with sideways distance counted double so the move feels straight. Undefined at the edge.
 */
export function nearestInDirection<T extends Point & { id: string }>(
	from: Point,
	direction: Direction,
	candidates: readonly T[]
): T | undefined {
	const v = VECTOR[direction];
	let best: T | undefined;
	let bestCost = Infinity;
	for (const c of candidates) {
		const dx = c.x - from.x;
		const dy = c.y - from.y;
		const along = dx * v.x + dy * v.y;
		const across = Math.abs(dx * v.y - dy * v.x);
		if (along <= 0.5 || across > along * 1.75) continue;
		const cost = along + across * 2;
		if (cost < bestCost || (cost === bestCost && best && c.id < best.id)) {
			best = c;
			bestCost = cost;
		}
	}
	return best;
}

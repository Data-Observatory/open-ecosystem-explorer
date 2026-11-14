import { describe, expect, it } from 'vitest';
import {
	FULL_RING_MAX,
	fitCamera,
	freeArea,
	nearestInDirection,
	project,
	ringRadius,
	ringSlots,
	unproject,
	wrapLabel,
	zoomAt
} from '../../../src/lib/explorer/geometry.js';
import type { Viewport } from '../../../src/lib/explorer/types.js';

const vp = (w: number, h: number, right = 0, bottom = 0): Viewport => ({
	w,
	h,
	inset: { top: 0, right, bottom, left: 0 }
});

describe('camera', () => {
	it('puts the camera point in the centre of the free area, clear of the card', () => {
		const withCard = vp(1100, 600, 392);
		const at = project({ x: 10, y: 20 }, { x: 10, y: 20, k: 1 }, withCard);
		expect(at).toEqual({ x: (1100 - 392) / 2, y: 300 });
		// The card covers x >= 708: the focus is left of it with room for a ring.
		expect(at.x).toBeLessThan(1100 - 392);
	});

	it('offsets vertically for a bottom overlay (story caption)', () => {
		const at = project({ x: 0, y: 0 }, { x: 0, y: 0, k: 1 }, vp(1000, 600, 0, 200));
		expect(at).toEqual({ x: 500, y: 200 });
	});

	it('project and unproject are inverse', () => {
		const view = vp(900, 500, 300, 40);
		const cam = { x: 120, y: -60, k: 0.7 };
		const back = unproject(project({ x: 33, y: 44 }, cam, view), cam, view);
		expect(back.x).toBeCloseTo(33);
		expect(back.y).toBeCloseTo(44);
	});

	it('fits points inside the free area with padding and never zooms past maxK', () => {
		const view = vp(1000, 600, 400);
		const points = [
			{ x: -500, y: -100 },
			{ x: 500, y: 100 }
		];
		const cam = fitCamera(points, view, { x: 50, y: 20 }, 1);
		expect(cam.x).toBe(0);
		expect(cam.k).toBeCloseTo(0.5);
		const free = freeArea(view);
		for (const p of points) {
			const s = project(p, cam, view);
			expect(s.x).toBeGreaterThanOrEqual(free.x + 50 - 1e-6);
			expect(s.x).toBeLessThanOrEqual(free.x + free.w - 50 + 1e-6);
		}
		expect(fitCamera([{ x: 0, y: 0 }], view, { x: 0, y: 0 }, 1).k).toBe(1);
	});

	it('zooms around a fixed screen point and clamps', () => {
		const view = vp(800, 600);
		const cam = { x: 0, y: 0, k: 1 };
		const screen = { x: 600, y: 100 };
		const before = unproject(screen, cam, view);
		const zoomed = zoomAt(cam, 2, screen, view, { min: 0.25, max: 2.5 });
		const after = unproject(screen, zoomed, view);
		expect(zoomed.k).toBe(2);
		expect(after.x).toBeCloseTo(before.x);
		expect(after.y).toBeCloseTo(before.y);
		expect(zoomAt(cam, 100, screen, view, { min: 0.25, max: 2.5 }).k).toBe(2.5);
	});
});

describe('ring placement', () => {
	it('places up to FULL_RING_MAX neighbours on a circle of the given radius', () => {
		for (let n = 2; n <= FULL_RING_MAX; n++) {
			const slots = ringSlots(n, 180);
			expect(slots).toHaveLength(n);
			for (const s of slots) expect(Math.hypot(s.x, s.y)).toBeCloseTo(180);
		}
		expect(ringSlots(0, 180)).toEqual([]);
		expect(ringSlots(1, 180)).toEqual([{ x: 180, y: 0, side: 'right' }]);
	});

	it('is deterministic and keeps neighbours apart', () => {
		expect(ringSlots(7, 190)).toEqual(ringSlots(7, 190));
		const slots = ringSlots(FULL_RING_MAX, 190);
		for (let i = 0; i < slots.length; i++)
			for (let j = i + 1; j < slots.length; j++)
				expect(Math.hypot(slots[i]!.x - slots[j]!.x, slots[i]!.y - slots[j]!.y)).toBeGreaterThan(
					100
				);
	});

	it('puts labels outside the ring: sideways on the sides, above and below at the poles', () => {
		for (const s of ringSlots(8, 190)) {
			if (s.side === 'right') expect(s.x).toBeGreaterThan(0);
			if (s.side === 'left') expect(s.x).toBeLessThan(0);
			if (s.side === 'above') expect(s.y).toBeLessThan(0);
			if (s.side === 'below') expect(s.y).toBeGreaterThan(0);
		}
		// Never a node straight above the centre: that is where the centre's own label goes.
		for (let n = 2; n <= FULL_RING_MAX; n++)
			expect(ringSlots(n, 190).some((s) => Math.abs(s.x) < 1 && s.y < 0)).toBe(false);
	});

	it('lays many neighbours out on two side arcs with rows that cannot collide', () => {
		const slots = ringSlots(31, 190, 38);
		expect(slots).toHaveLength(31);
		expect(slots.every((s) => s.side === 'left' || s.side === 'right')).toBe(true);
		for (const side of ['left', 'right'] as const) {
			const ys = slots
				.filter((s) => s.side === side)
				.map((s) => s.y)
				.sort((a, b) => a - b);
			for (let i = 1; i < ys.length; i++)
				expect(ys[i]! - ys[i - 1]!).toBeGreaterThanOrEqual(38 - 1e-6);
		}
		const radii = slots.map((s) => Math.hypot(s.x, s.y));
		expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(1e-6);
	});

	it('sizes the ring to the free area within limits', () => {
		const limits = { min: 130, max: 210 };
		expect(ringRadius(vp(1100, 600, 392), { x: 150, y: 64 }, limits)).toBe(204);
		expect(ringRadius(vp(2000, 1200), { x: 150, y: 64 }, limits)).toBe(210);
		expect(ringRadius(vp(300, 200), { x: 150, y: 64 }, limits)).toBe(130);
	});
});

describe('labels and keyboard', () => {
	it('wraps labels greedily and caps the number of lines', () => {
		expect(wrapLabel('DOI')).toEqual(['DOI']);
		expect(wrapLabel('Gestión de datos de investigación', 16)).toEqual([
			'Gestión de datos',
			'de investigación'
		]);
		expect(wrapLabel('a b c d e f', 1, 2)).toEqual(['a', 'b c d e f']);
	});

	it('moves to the nearest node in the arrow direction', () => {
		const nodes = [
			{ id: 'right-near', x: 100, y: 10 },
			{ id: 'right-far', x: 300, y: 0 },
			{ id: 'up', x: 0, y: -80 },
			{ id: 'diagonal', x: 60, y: -200 }
		];
		const from = { x: 0, y: 0 };
		expect(nearestInDirection(from, 'right', nodes)?.id).toBe('right-near');
		expect(nearestInDirection(from, 'up', nodes)?.id).toBe('up');
		expect(nearestInDirection(from, 'left', nodes)).toBeUndefined();
		expect(nearestInDirection(from, 'down', nodes)).toBeUndefined();
	});
});

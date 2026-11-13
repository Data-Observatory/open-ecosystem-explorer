import { describe, expect, it } from 'vitest';
import {
	EMPTY_URL_STATE,
	nextTrail,
	parseMapUrl,
	serializeMapUrl
} from '../../../src/lib/explorer/url.js';

describe('map URL state', () => {
	it('parses the empty query as the starting view', () => {
		expect(parseMapUrl('')).toEqual(EMPTY_URL_STATE);
		expect(serializeMapUrl(EMPTY_URL_STATE)).toBe('');
	});

	it('round-trips every kind of state', () => {
		for (const query of [
			'?n=doi',
			'?historia=what-is-a-doi&paso=3',
			'?modo=experto',
			'?n=crossref&modo=experto&vista=lista&tipo=agency&rel=behind'
		]) {
			expect(serializeMapUrl(parseMapUrl(query))).toBe(query);
		}
	});

	it('reads story steps as 1-based and tolerates junk', () => {
		expect(parseMapUrl('?historia=what-is-fair').step).toBe(0);
		expect(parseMapUrl('?historia=what-is-fair&paso=4').step).toBe(3);
		expect(parseMapUrl('?historia=what-is-fair&paso=abc').step).toBe(0);
		expect(parseMapUrl('?historia=what-is-fair&paso=-2').step).toBe(0);
		expect(parseMapUrl('?n=<script>').selected).toBeNull();
		expect(parseMapUrl('?historia=Not_An_Id').story).toBeNull();
	});

	it('lets a story own the canvas and ignores expert-only params outside expert mode', () => {
		expect(parseMapUrl('?historia=what-is-fair&n=doi').selected).toBeNull();
		const plain = parseMapUrl('?vista=lista&tipo=agency&rel=behind');
		expect(plain.view).toBe('map');
		expect(plain.type).toBe('');
		expect(plain.family).toBe('');
	});
});

describe('trail', () => {
	it('appends new nodes and keeps the last five', () => {
		let trail: string[] = [];
		for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) trail = nextTrail(trail, id);
		expect(trail).toEqual(['b', 'c', 'd', 'e', 'f']);
	});

	it('steps back when a node already on the trail is visited, and clears on the start view', () => {
		expect(nextTrail(['a', 'b', 'c'], 'a')).toEqual(['a']);
		expect(nextTrail(['a', 'b', 'c'], 'c')).toEqual(['a', 'b', 'c']);
		expect(nextTrail(['a', 'b'], null)).toEqual([]);
	});
});

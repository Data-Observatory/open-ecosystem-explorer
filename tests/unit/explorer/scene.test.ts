import { describe, expect, it } from 'vitest';
import { composition } from '../../../src/lib/explorer/compose.js';
import { project } from '../../../src/lib/explorer/geometry.js';
import { chooseRing, groupSentences, indexGraph, searchScore, sentencesOf, fold } from '../../../src/lib/explorer/graph.js';
import { FAMILY_COLOR } from '../../../src/lib/explorer/palette.js';
import {
	buildScene,
	geometryOf,
	interpolateGeometry,
	labelDegreeAt,
	ringCapacity,
	type SceneInput
} from '../../../src/lib/explorer/scene.js';
import { clampStep, layoutStory, storyFrame } from '../../../src/lib/explorer/story.js';
import type { Viewport } from '../../../src/lib/explorer/types.js';
import { CENTRE_ANCHOR_ID, DEFAULT_ANCHOR_IDS, NODE_FAMILIES } from '../../../src/lib/map/anchors.js';
import { hexToRgb } from '../../../src/lib/map/color-distance.js';
import { mapGraph, miniGraph } from '../../../src/lib/server/map.js';

// The pure map logic, exercised against the real corpus: the same payload the home page ships.
const graph = await mapGraph('es');
const index = indexGraph(graph);
const desktop: Viewport = { w: 1104, h: 520, inset: { top: 20, right: 0, bottom: 32, left: 0 } };
const withCard: Viewport = { ...desktop, inset: { ...desktop.inset, top: 56, right: 392 } };
const phone: Viewport = { w: 358, h: 320, inset: { top: 0, right: 0, bottom: 0, left: 0 } };

const input = (over: Partial<SceneInput> = {}): SceneInput => ({
	index,
	vp: desktop,
	compact: false,
	locale: 'es',
	expert: false,
	selected: null,
	expanded: false,
	focusAt: { x: 0, y: 0 },
	story: null,
	type: '',
	family: '',
	userCam: null,
	...over
});

describe('payload', () => {
	it('ships every entity with a position, and labels use the short name when there is one', () => {
		expect(graph.nodes.length).toBeGreaterThan(140);
		expect(graph.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
		expect(index.byId.get('cris')?.label).toBe('CRIS');
		expect(index.byId.get('doi')?.label).toBe(index.byId.get('doi')?.name);
		const members = graph.themes.flatMap((t) => t.members).sort();
		expect(members).toEqual([...DEFAULT_ANCHOR_IDS].sort());
	});
});

describe('composition (starting view)', () => {
	for (const portrait of [false, true]) {
		const composed = composition(portrait);
		it(`${portrait ? 'portrait' : 'landscape'}: places exactly the anchors, centre at the origin`, () => {
			expect(Object.keys(composed.nodes).sort()).toEqual([...DEFAULT_ANCHOR_IDS].sort());
			expect(composed.nodes[CENTRE_ANCHOR_ID]).toMatchObject({ x: 0, y: 0, tier: 1 });
			expect(Object.values(composed.nodes).filter((n) => n.tier === 1)).toHaveLength(1);
		});
		it(`${portrait ? 'portrait' : 'landscape'}: no two nodes sit on top of each other`, () => {
			const nodes = Object.values(composed.nodes);
			const min = portrait ? 40 : 90;
			for (let i = 0; i < nodes.length; i++)
				for (let j = i + 1; j < nodes.length; j++)
					expect(Math.hypot(nodes[i]!.x - nodes[j]!.x, nodes[i]!.y - nodes[j]!.y)).toBeGreaterThan(min);
		});
	}

	it('the start scene shows every anchor, connected (no isolated dots), inside the canvas', () => {
		const scene = buildScene(input());
		expect(scene.kind).toBe('start');
		expect(scene.nodes.map((n) => n.id).sort()).toEqual([...DEFAULT_ANCHOR_IDS].sort());
		const touched = new Set(scene.edges.flatMap((e) => [e.s, e.t]));
		for (const id of DEFAULT_ANCHOR_IDS) expect(touched.has(id), id).toBe(true);
		expect(new Set(scene.nodes.map((n) => n.tier))).toEqual(new Set([1, 2, 3]));
		for (const node of scene.nodes) {
			const s = project(node, scene.cam, desktop);
			expect(s.x).toBeGreaterThan(0);
			expect(s.x).toBeLessThan(desktop.w);
			expect(s.y).toBeGreaterThan(0);
			expect(s.y).toBeLessThan(desktop.h);
		}
		expect(scene.captions.length).toBeGreaterThanOrEqual(4);
	});
});

describe('focus scene (ring)', () => {
	it('ranks neighbours: anchors first, capped until expanded', () => {
		const all = index.neighbours.get('research-repository')!.length;
		const choice = chooseRing(index, 'research-repository', 8, false, 'es');
		expect(choice.shown).toHaveLength(8);
		expect(choice.hidden).toBe(all - 8);
		const anchorNeighbours = index.neighbours
			.get('research-repository')!
			.filter((id) => index.byId.get(id)!.anchor);
		for (const id of anchorNeighbours.slice(0, 8)) expect(choice.shown).toContain(id);
		expect(chooseRing(index, 'research-repository', 8, true, 'es').shown).toHaveLength(all);
	});

	it('orders the ring like the card: by relation family', () => {
		const sentences = sentencesOf(index, 'doi', 'es');
		const order = [...new Set(sentences.map((s) => s.other.id))];
		const choice = chooseRing(index, 'doi', 100, false, 'es');
		expect(choice.shown).toEqual(order);
		expect(groupSentences(index, sentences).map((g) => g.family)[0]).toBe('kind');
	});

	it('puts the neighbours at one radius around the focus and the focus clear of the card', () => {
		const focusAt = { x: -245, y: 5 };
		const scene = buildScene(input({ selected: 'doi', vp: withCard, focusAt }));
		expect(scene.kind).toBe('focus');
		const [focus, ...ring] = scene.nodes;
		expect(focus).toMatchObject({ id: 'doi', tone: 'focus', ...focusAt });
		expect(ring.length).toBe(Math.min(ringCapacity(false), index.neighbours.get('doi')!.length));
		const radii = ring.map((n) => Math.hypot(n.x - focusAt.x, n.y - focusAt.y));
		expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(1e-6);
		expect(scene.edges).toHaveLength(ring.length);
		// Every node lands left of the card.
		for (const node of scene.nodes)
			expect(project(node, scene.cam, withCard).x).toBeLessThan(withCard.w - 392);
		expect(project(focus!, scene.cam, withCard).x).toBeCloseTo((withCard.w - 392) / 2);
	});

	it('zooms out, never in, when an expanded ring outgrows the free area', () => {
		const scene = buildScene(input({ selected: 'research-repository', expanded: true, vp: withCard }));
		expect(scene.hidden).toBe(0);
		expect(scene.cam.k).toBeLessThanOrEqual(1);
		expect(scene.nodes.length).toBe(index.neighbours.get('research-repository')!.length + 1);
	});

	it('uses a smaller ring with fewer neighbours on a phone', () => {
		const scene = buildScene(input({ selected: 'research-repository', vp: phone, compact: true }));
		expect(scene.nodes).toHaveLength(ringCapacity(true) + 1);
		for (const node of scene.nodes) {
			const s = project(node, scene.cam, phone);
			expect(s.x).toBeGreaterThan(0);
			expect(s.x).toBeLessThan(phone.w);
		}
	});
});

describe('stories', () => {
	it('every story lays out all its nodes, deterministically and without overlaps', () => {
		expect(graph.stories.length).toBeGreaterThanOrEqual(5);
		for (const story of graph.stories) {
			const placed = layoutStory(story, index.linked);
			expect(layoutStory(story, index.linked)).toEqual(placed);
			const ids = [...new Set(story.steps.flatMap((s) => [s.focus, ...s.reveal]))];
			for (const id of ids) expect(placed[id], `${story.id}:${id}`).toBeDefined();
			const points = Object.values(placed);
			for (let i = 0; i < points.length; i++)
				for (let j = i + 1; j < points.length; j++)
					expect(
						Math.hypot((points[i]!.x - points[j]!.x) / 150, (points[i]!.y - points[j]!.y) / 64),
						story.id
					).toBeGreaterThan(0.9);
		}
	});

	it('steps reveal cumulatively and highlight only the current edges', () => {
		const story = graph.stories.find((s) => s.id === 'what-is-a-doi')!;
		const first = storyFrame(story, 0);
		expect(first).toMatchObject({ focus: 'doi', visible: ['doi'], currentPairs: [], pastPairs: [] });
		const second = storyFrame(story, 1);
		expect(second.focus).toBe('persistent-identifier');
		expect(second.visible).toEqual(expect.arrayContaining(['doi', 'persistent-identifier', 'orcid', 'ror']));
		expect(second.currentPairs).toHaveLength(3);
		const third = storyFrame(story, 2);
		expect(third.pastPairs).toEqual(expect.arrayContaining(second.currentPairs));
		expect(third.visible.length).toBeGreaterThan(second.visible.length);
		const last = storyFrame(story, 99);
		expect(last.focus).toBe(story.steps.at(-1)!.focus);
	});

	it('clamps the step', () => {
		const story = graph.stories[0]!;
		expect(clampStep(story, -3)).toBe(0);
		expect(clampStep(story, 1000)).toBe(story.steps.length - 1);
		expect(clampStep(story, Number.NaN)).toBe(0);
	});

	it('the story scene keeps nodes in place between steps and frames the current ones', () => {
		const story = graph.stories.find((s) => s.id === 'what-is-a-doi')!;
		const a = buildScene(input({ story: { story, step: 1 } }));
		const b = buildScene(input({ story: { story, step: 4 } }));
		expect(a.kind).toBe('story');
		for (const node of a.nodes) {
			const later = b.nodes.find((n) => n.id === node.id)!;
			expect([later.x, later.y]).toEqual([node.x, node.y]);
		}
		expect(b.nodes.find((n) => n.tone === 'focus')?.id).toBe(story.steps[4]!.focus);
		expect(b.edges.filter((e) => e.tone === 'accent')).toHaveLength(1);
		const focus = b.nodes.find((n) => n.tone === 'focus')!;
		const s = project(focus, b.cam, desktop);
		expect(s.x).toBeGreaterThan(0);
		expect(s.x).toBeLessThan(desktop.w);
	});
});

describe('expert scene', () => {
	it('shows the whole corpus and filters by type and relation family', () => {
		const all = buildScene(input({ expert: true }));
		expect(all.kind).toBe('expert');
		expect(all.nodes).toHaveLength(graph.nodes.length);
		const typed = buildScene(input({ expert: true, type: 'identifier' }));
		expect(typed.nodes.length).toBeGreaterThan(0);
		expect(typed.nodes.every((n) => index.byId.get(n.id)!.type === 'identifier')).toBe(true);
		const behind = buildScene(input({ expert: true, family: 'behind' }));
		expect(behind.edges.length).toBe(
			new Set(graph.edges.filter((e) => e.f === 'behind').map((e) => [e.s, e.t].sort().join('|'))).size
		);
		expect(behind.nodes.length).toBeLessThan(graph.nodes.length);
	});

	it('labels by zoom: anchors always, more as the reader zooms in', () => {
		expect(labelDegreeAt(0.3)).toBe(Infinity);
		expect(labelDegreeAt(2)).toBe(0);
		const far = buildScene(input({ expert: true, userCam: { x: 0, y: 0, k: 0.4 } }));
		const near = buildScene(input({ expert: true, userCam: { x: 0, y: 0, k: 1.6 } }));
		expect(far.nodes.filter((n) => n.label).map((n) => n.id).sort()).toEqual([...DEFAULT_ANCHOR_IDS].sort());
		expect(near.nodes.every((n) => n.label)).toBe(true);
	});

	it('a selection keeps positions and mutes everything but its neighbourhood', () => {
		const scene = buildScene(input({ expert: true, selected: 'crossref' }));
		const near = new Set(index.neighbours.get('crossref'));
		for (const node of scene.nodes) {
			const expected = node.id === 'crossref' ? 'focus' : near.has(node.id) ? 'normal' : 'muted';
			expect(node.tone, node.id).toBe(expected);
		}
		expect(scene.edges.filter((e) => e.tone === 'strong')).toHaveLength(near.size);
	});
});

describe('transitions', () => {
	const a = { cam: { x: 0, y: 0, k: 1 }, origin: { x: 0, y: 0 }, nodes: { stay: [0, 0, 1], leave: [50, 50, 1] } as Record<string, [number, number, number]> };
	const b = { cam: { x: 100, y: 0, k: 0.25 }, origin: { x: 10, y: 10 }, nodes: { stay: [100, 0, 1], enter: [200, 200, 1] } as Record<string, [number, number, number]> };
	const at = interpolateGeometry(a, b);

	it('starts at a, ends exactly at b', () => {
		expect(at(0)).toBe(a);
		expect(at(1)).toBe(b);
	});

	it('glides shared nodes, grows new ones from the origin, fades old ones out in place', () => {
		const mid = at(0.5);
		expect(mid.nodes.stay).toEqual([50, 0, 1]);
		expect(mid.nodes.enter).toEqual([105, 105, 0.5]);
		expect(mid.nodes.leave).toEqual([50, 50, 0]);
		expect(at(0.25).nodes.leave?.[2]).toBeCloseTo(0.5);
		expect(mid.cam.k).toBeCloseTo(0.5);
		expect(mid.cam.x).toBe(50);
	});

	it('geometryOf lists every node fully opaque', () => {
		const scene = buildScene(input());
		const geometry = geometryOf(scene);
		expect(Object.keys(geometry.nodes)).toHaveLength(scene.nodes.length);
		expect(Object.values(geometry.nodes).every((n) => n[2] === 1)).toBe(true);
	});
});

describe('search and palette', () => {
	it('ranks name prefix over name over alias over summary', () => {
		const doi = index.byId.get('doi')!;
		expect(searchScore(doi, fold('DO'))).toBe(3);
		expect(searchScore(doi, fold('zzzz'))).toBe(-1);
		expect(fold('Índice de CITAS')).toBe('indice de citas');
	});

	it('family colours all reach 3:1 on white and are distinct', () => {
		const luminance = (hex: string) => {
			const { r, g, b } = hexToRgb(hex);
			const lin = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
			return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
		};
		for (const family of NODE_FAMILIES)
			expect(1.05 / (luminance(FAMILY_COLOR[family]) + 0.05), family).toBeGreaterThanOrEqual(3);
		expect(new Set(Object.values(FAMILY_COLOR)).size).toBe(NODE_FAMILIES.length);
	});
});

describe('mini-graph (entity page)', () => {
	it('draws the entity with its top neighbours on a ring, wide and narrow', async () => {
		const mini = (await miniGraph('doi', 'es'))!;
		expect(mini.wide.nodes[0]).toMatchObject({ id: 'doi', x: 0, y: 0, tone: 'focus' });
		expect(mini.wide.nodes.length).toBeLessThanOrEqual(9);
		expect(mini.narrow.nodes.length).toBeLessThanOrEqual(7);
		expect(mini.wide.edges).toHaveLength(mini.wide.nodes.length - 1);
		const drawn = new Set(mini.nodes.map((n) => n.id));
		for (const node of [...mini.wide.nodes, ...mini.narrow.nodes]) expect(drawn.has(node.id)).toBe(true);
		expect(await miniGraph('no-such-entity', 'es')).toBeUndefined();
	});
});

import { describe, expect, it } from 'vitest';
import { buildIndex } from '../../../src/lib/graph/build-index.js';
import { neighbours, neighbours1 } from '../../../src/lib/graph/neighbours.js';
import { entities } from '../../fixtures/valid-graph.js';
import { loadRealVocab } from '../../fixtures/load-real-vocab.js';

const vocab = loadRealVocab();
const emptyProse = new Map([
	['es', new Map()],
	['en', new Map()]
]) as never;

describe('neighbours', () => {
	const index = buildIndex(entities, emptyProse, vocab.predicatesVocab, vocab.entityTypesVocab);

	it('neighbours1 returns direct outgoing then incoming', () => {
		const ns = neighbours1(index, 'fx-standard');
		expect(ns.filter((n) => n.direction === 'out').map((n) => n.id)).toEqual(
			expect.arrayContaining(['fx-community', 'fx-standard-old'])
		);
		expect(ns.filter((n) => n.direction === 'in').map((n) => n.id)).toEqual(
			expect.arrayContaining(['fx-repository-a', 'fx-policy'])
		);
	});

	it('neighbours(depth) does a bounded BFS and excludes the origin', () => {
		const ns1 = neighbours(index, 'fx-agency', 1);
		expect(ns1.map((n) => n.id)).not.toContain('fx-agency');
		const idsAtDepth1 = new Set(ns1.map((n) => n.id));

		const ns2 = neighbours(index, 'fx-agency', 2);
		expect(ns2.length).toBeGreaterThanOrEqual(ns1.length);
		for (const n of ns1) expect(ns2.map((x) => x.id)).toContain(n.id);
		// depth 2 reaches at least one node not reachable at depth 1
		expect(ns2.some((n) => !idsAtDepth1.has(n.id))).toBe(true);
	});

	it('neighbours(depth) never revisits a node once queued', () => {
		const ns = neighbours(index, 'fx-repository-a', 3);
		const ids = ns.map((n) => n.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('neighbours with depth 0 or an isolated node returns nothing', () => {
		expect(neighbours(index, 'fx-agency', 0)).toEqual([]);
	});

	it('returns nothing for an id absent from the index (defensive ?? [] fallback)', () => {
		expect(neighbours1(index, 'does-not-exist')).toEqual([]);
		expect(neighbours(index, 'does-not-exist', 2)).toEqual([]);
	});
});

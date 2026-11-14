import { describe, expect, it } from 'vitest';
import { buildIndex } from '../../../src/lib/graph/build-index.js';
import { entities } from '../../fixtures/valid-graph.js';
import { loadRealVocab } from '../../fixtures/load-real-vocab.js';
import type { ResolvedProse } from '../../../src/lib/model/types.js';
import type { LocaleCode } from '../../../src/i18n/locales.js';

const vocab = loadRealVocab();

function emptyProse(): ReadonlyMap<LocaleCode, ReadonlyMap<string, ResolvedProse>> {
	return new Map([
		['es', new Map()],
		['en', new Map()]
	]);
}

describe('buildIndex', () => {
	it('counts every entity by type and derives layer from type', () => {
		const index = buildIndex(entities, emptyProse(), vocab.predicatesVocab, vocab.entityTypesVocab);
		expect(index.byType.get('repository')).toEqual(['fx-repository-a', 'fx-repository-b']);
		expect(index.byLayer.get('institutional-system')).toContain('fx-repository-a');
		expect(index.byLayer.get('institutional-system')).toContain('fx-cris');
		expect(index.byLayer.get('regional')).toContain('fx-aggregator');
		expect(index.byLayer.get('regional')).toContain('fx-publishing-platform');
		expect(index.byLayer.get('cross-cutting')).toContain('fx-standard');
		expect(index.byLayer.get('cross-cutting')).toContain('fx-organization');
	});

	it('produces one canonical edge per authored relation, sorted', () => {
		const index = buildIndex(entities, emptyProse(), vocab.predicatesVocab, vocab.entityTypesVocab);
		expect(index.edges).toHaveLength(19);
		expect(index.stats.edgeCount).toBe(19);
		const sorted = [...index.edges].sort(
			(a, b) =>
				a.from.localeCompare(b.from) ||
				a.predicate.localeCompare(b.predicate) ||
				a.to.localeCompare(b.to)
		);
		expect(index.edges).toEqual(sorted);
	});

	it('builds outgoing/incoming views and adds a derived mirror for symmetric predicates', () => {
		const index = buildIndex(entities, emptyProse(), vocab.predicatesVocab, vocab.entityTypesVocab);
		const aOut = index.outgoing.get('fx-repository-a') ?? [];
		const bOut = index.outgoing.get('fx-repository-b') ?? [];
		expect(
			aOut.some(
				(e) => e.predicate === 'interoperates-with' && e.to === 'fx-repository-b' && !e.derived
			)
		).toBe(true);
		expect(
			bOut.some(
				(e) => e.predicate === 'interoperates-with' && e.to === 'fx-repository-a' && e.derived
			)
		).toBe(true);
		const orgIn = index.incoming.get('fx-organization') ?? [];
		expect(orgIn.map((e) => e.predicate).sort()).toEqual([
			'developed-by',
			'funded-by',
			'operated-by',
			'owned-by'
		]);
	});

	it('computes degree as authored in+out (mirrors do not double count real degree)', () => {
		const index = buildIndex(entities, emptyProse(), vocab.predicatesVocab, vocab.entityTypesVocab);
		const orgDegree = index.degree.get('fx-organization');
		expect(orgDegree).toEqual({ in: 4, out: 0 });
	});

	it('finds every entity in one weakly connected component', () => {
		const index = buildIndex(entities, emptyProse(), vocab.predicatesVocab, vocab.entityTypesVocab);
		expect(index.components).toHaveLength(1);
		expect(index.components[0]).toHaveLength(entities.length);
	});

	it('reports no orphans for the fully-connected fixture', () => {
		const index = buildIndex(entities, emptyProse(), vocab.predicatesVocab, vocab.entityTypesVocab);
		expect(index.stats.orphans).toEqual([]);
	});

	it('flags a genuinely disconnected entity as an orphan and a second component', () => {
		const isolatedEntity = {
			...entities[0]!,
			id: 'fx-isolated',
			relations: []
		};
		const index = buildIndex(
			[...entities, isolatedEntity],
			emptyProse(),
			vocab.predicatesVocab,
			vocab.entityTypesVocab
		);
		expect(index.stats.orphans).toEqual(['fx-isolated']);
		expect(index.components.length).toBeGreaterThan(1);
	});

	it('computes translation coverage per locale from the prose map', () => {
		const prose = new Map([
			['es', new Map([['fx-agency', { summary: 'x'.repeat(40), body: '' }]])],
			['en', new Map()]
		]) as ReadonlyMap<LocaleCode, ReadonlyMap<string, ResolvedProse>>;
		const index = buildIndex(entities, prose, vocab.predicatesVocab, vocab.entityTypesVocab);
		expect(index.stats.translationCoverage.es.present).toBe(1);
		expect(index.stats.translationCoverage.es.missing).not.toContain('fx-agency');
		expect(index.stats.translationCoverage.en.present).toBe(0);
		expect(index.stats.translationCoverage.en.missing).toHaveLength(entities.length);
	});

	it('throws if an entity uses a type absent from the type->layer vocab', () => {
		const bogus = {
			...entities[0]!,
			id: 'fx-bogus',
			type: 'not-a-real-type'
		} as unknown as (typeof entities)[number];
		expect(() =>
			buildIndex([bogus], emptyProse(), vocab.predicatesVocab, vocab.entityTypesVocab)
		).toThrow();
	});

	it('sorts by name within a type, breaking ties by whichever order the sort presents them', () => {
		const base = entities.find((e) => e.type === 'community')!;
		// Deliberately out of name order relative to id order, so the name-sort
		// comparator has to actually swap (exercises the ">" branch), and two
		// trailing entries share a name (exercises the "===" branch).
		const zeta = { ...base, id: 'fx-community-1', name: 'Zeta Community' };
		const alpha1 = { ...base, id: 'fx-community-2', name: 'Alpha Community' };
		const alpha2 = { ...base, id: 'fx-community-3', name: 'Alpha Community' };
		const index = buildIndex(
			[zeta, alpha1, alpha2],
			emptyProse(),
			vocab.predicatesVocab,
			vocab.entityTypesVocab
		);
		expect(index.byType.get('community')).toEqual([
			'fx-community-2',
			'fx-community-3',
			'fx-community-1'
		]);
	});

	it('does not crash on a dangling relation target (I3 reports it elsewhere)', () => {
		const withDangling = {
			...entities.find((e) => e.id === 'fx-agency')!,
			relations: [{ predicate: 'issues' as const, target: 'does-not-exist' }]
		};
		const others = entities.filter((e) => e.id !== 'fx-agency');
		const index = buildIndex(
			[withDangling, ...others],
			emptyProse(),
			vocab.predicatesVocab,
			vocab.entityTypesVocab
		);
		expect(index.incoming.get('does-not-exist')).toBeUndefined();
		expect(index.degree.get('fx-agency')?.out).toBe(1);
	});

	it('sorts edges by predicate, then by target when both from and predicate tie', () => {
		const secondIdentifier = {
			...entities.find((e) => e.id === 'fx-identifier')!,
			id: 'fx-identifier-z'
		};
		const twoEdges = {
			...entities.find((e) => e.id === 'fx-agency')!,
			relations: [
				{ predicate: 'member-of' as const, target: 'fx-coalition' },
				{ predicate: 'issues' as const, target: 'fx-identifier-z' },
				{ predicate: 'issues' as const, target: 'fx-identifier' }
			]
		};
		const others = entities.filter((e) => e.id !== 'fx-agency');
		const index = buildIndex(
			[twoEdges, secondIdentifier, ...others],
			emptyProse(),
			vocab.predicatesVocab,
			vocab.entityTypesVocab
		);
		const fromAgency = index.edges.filter((e) => e.from === 'fx-agency');
		expect(fromAgency.map((e) => `${e.predicate}->${e.to}`)).toEqual([
			'issues->fx-identifier',
			'issues->fx-identifier-z',
			'member-of->fx-coalition'
		]);
	});
});

import { describe, expect, it } from 'vitest';
import { runValidation } from '../../../src/lib/invariants/run.js';
import { freshInput, withEntity } from '../invariants/helpers.js';
import { loadRealVocab } from '../../fixtures/load-real-vocab.js';
import { loadRealEntities } from '../../fixtures/load-real-content.js';

const predicates = loadRealVocab().predicatesVocab as unknown as {
	get(id: string): { domain: string[]; range: string[] } | undefined;
};
const def = (id: string) => predicates.get(id)!;

describe('signatory convention: declarations and initiatives are endorsed-by their signatories', () => {
	it('endorsed-by accepts any type that can sign or support, not only organisations', () => {
		for (const t of [
			'organization',
			'community',
			'coalition',
			'agency',
			'aggregator',
			'index',
			'repository',
			'publishing-platform',
			'cris'
		]) {
			expect(def('endorsed-by').range, t).toContain(t);
		}
	});

	it('a coalition (declaration) endorsed-by an agency type-checks (I8)', () => {
		const input = withEntity(freshInput(), 'fx-coalition', {
			relations: [{ predicate: 'endorsed-by', target: 'fx-agency' }]
		});
		const result = runValidation(input);
		expect(result.messages.filter((m) => m.ruleId === 'I8')).toEqual([]);
	});

	it('no real edge makes an entity a member-of a declaration', () => {
		const entities = loadRealEntities();
		const declarations = new Set(
			entities
				.filter(
					(e) =>
						e.type === 'coalition' &&
						(e as { coalitionKind?: string }).coalitionKind === 'declaration'
				)
				.map((e) => e.id)
		);
		expect(declarations.size).toBeGreaterThan(0);
		const offenders = entities.flatMap((e) =>
			(e.relations ?? [])
				.filter((r) => r.predicate === 'member-of' && declarations.has(r.target))
				.map((r) => `${e.id} member-of ${r.target}`)
		);
		expect(offenders).toEqual([]);
	});

	it('every real edge into a declaration is endorsed-by authored on the declaration', () => {
		const entities = loadRealEntities();
		const declarations = new Set(
			entities
				.filter(
					(e) =>
						e.type === 'coalition' &&
						(e as { coalitionKind?: string }).coalitionKind === 'declaration'
				)
				.map((e) => e.id)
		);
		for (const e of entities) {
			for (const r of e.relations ?? []) {
				if (declarations.has(r.target))
					expect(r.predicate, `${e.id} -> ${r.target}`).not.toBe('member-of');
			}
			if (declarations.has(e.id)) {
				for (const r of e.relations ?? []) {
					if (['endorsed-by', 'member-of'].includes(r.predicate))
						expect(r.predicate).toBe('endorsed-by');
				}
			}
		}
	});
});

describe('member-of range: membership organisations may be agencies or organisations', () => {
	it('range covers community, coalition, aggregator, agency and organization', () => {
		for (const t of ['community', 'coalition', 'aggregator', 'agency', 'organization'])
			expect(def('member-of').range, t).toContain(t);
	});

	it('an agency member-of an agency type-checks (I8), as Crossref in DataCite', () => {
		const input = withEntity(freshInput(), 'fx-community', {
			relations: [{ predicate: 'member-of', target: 'fx-agency' }]
		});
		expect(runValidation(input).messages.filter((m) => m.ruleId === 'I8')).toEqual([]);
	});

	it('real graph: DataCite and the International DOI Foundation have members', () => {
		const entities = loadRealEntities();
		const members = (target: string) =>
			entities
				.filter((e) =>
					(e.relations ?? []).some((r) => r.predicate === 'member-of' && r.target === target)
				)
				.map((e) => e.id);
		expect(members('datacite')).toEqual(expect.arrayContaining(['crossref', 'cern', 'arxiv']));
		expect(members('international-doi-foundation')).toEqual(
			expect.arrayContaining(['crossref', 'datacite', 'medra', 'jalc'])
		);
	});
});

import { describe, it, expect } from 'vitest';
import { buildIndex } from '../../../src/lib/graph/build-index.js';
import { loadRealEntities, loadRealProseMap } from '../../fixtures/load-real-content.js';
import { loadRealVocab } from '../../fixtures/load-real-vocab.js';
import {
	buildGraphExport,
	exportEntity,
	toEntitiesCsv,
	toRelationsCsv
} from '../../../src/lib/export/build-export.js';

const { entityTypesVocab, predicatesVocab } = loadRealVocab();
const index = buildIndex(loadRealEntities(), loadRealProseMap(), predicatesVocab, entityTypesVocab);

describe('buildGraphExport', () => {
	it('exports every entity with all locales present in the prose map, even when a translation is missing', () => {
		const exp = buildGraphExport(index);
		expect(exp.entityCount).toBe(index.entities.size);
		expect(exp.entities.length).toBe(index.entities.size);
		const figshare = exp.entities.find((e) => e.id === 'figshare')!;
		expect(Object.keys(figshare.prose).sort()).toEqual(['en', 'es']);
		expect(figshare.name).toBe('Figshare'); // locale-independent base name, not the (usually absent) prose override
	});

	it('per-entity relations include both authored outgoing and derived-inverse incoming edges', () => {
		const exp = buildGraphExport(index);
		const digitalScience = exp.entities.find((e) => e.id === 'digital-science')!;
		// digital-science itself authors owned-by -> holtzbrinck (outgoing) and
		// has 3 real incoming owned-by edges (dimensions/symplectic-elements/figshare) as derived inverses.
		expect(
			digitalScience.relations.some(
				(r) => !r.derived && r.predicate === 'owned-by' && r.target === 'holtzbrinck'
			)
		).toBe(true);
		const derivedOwners = digitalScience.relations.filter(
			(r) => r.derived && r.predicate === 'owned-by'
		);
		expect(derivedOwners.length).toBeGreaterThanOrEqual(3);
	});
});

describe('exportEntity', () => {
	it('returns undefined for an unknown id', () => {
		expect(exportEntity(index, 'not-a-real-entity')).toBeUndefined();
	});
});

describe('CSV export', () => {
	it('entities.csv has a non-empty base name column for every row', () => {
		const csv = toEntitiesCsv(buildGraphExport(index));
		const lines = csv.split('\n');
		const header = lines[0]!.split(',');
		const nameCol = header.indexOf('name');
		expect(nameCol).toBeGreaterThanOrEqual(0);
		for (const line of lines.slice(1)) {
			const cols = line.split(',');
			expect(cols[nameCol]).not.toBe('');
		}
	});

	it('relations.csv only lists authored (non-derived) edges, once each', () => {
		const csv = toRelationsCsv(buildGraphExport(index));
		const lines = csv.split('\n').slice(1);
		expect(lines.length).toBe(index.edges.filter((e) => !e.derived).length);
	});
});

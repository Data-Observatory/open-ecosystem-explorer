import { describe, it, expect } from 'vitest';
import { buildIndex } from '../../../src/lib/graph/build-index.js';
import { loadRealEntities, loadRealProseMap } from '../../fixtures/load-real-content.js';
import { loadRealVocab } from '../../fixtures/load-real-vocab.js';
import { resolveViewQuery, describeEntitySet, activeOptionalColumns } from '../../../src/lib/views/query.js';

const { entityTypesVocab, predicatesVocab } = loadRealVocab();
const index = buildIndex(loadRealEntities(), loadRealProseMap(), predicatesVocab, entityTypesVocab);

describe('resolveViewQuery', () => {
  it('entities: FL1 (open content, commercial governance) resolves non-empty and includes figshare', () => {
    const result = resolveViewQuery(index, { kind: 'entities', where: [{ outputLicence: 'open', governance: 'commercial' }] }, 'es');
    expect(result.entityIds.length).toBeGreaterThan(0);
    expect(result.entityIds).toContain('figshare');
  });

  it('entities: is sorted (A3 determinism)', () => {
    const result = resolveViewQuery(index, { kind: 'entities', where: [{ governance: 'commercial' }] }, 'es');
    expect(result.entityIds).toEqual([...result.entityIds].sort());
  });

  it('predicate: owned-by groupBy target resolves the three-parent ownership picture', () => {
    const result = resolveViewQuery(index, { kind: 'predicate', predicate: 'owned-by', groupBy: 'target' }, 'es');
    expect(result.entityIds).toContain('elsevier');
    expect(result.entityIds).toContain('clarivate');
    expect(result.entityIds).toContain('digital-science');
    expect(result.edges.length).toBeGreaterThanOrEqual(9); // >=3 products per parent x 3 parents
  });

  it('predicate: edges are sorted deterministically', () => {
    const result = resolveViewQuery(index, { kind: 'predicate', predicate: 'owned-by' }, 'es');
    const sorted = [...result.edges].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
    expect(result.edges).toEqual(sorted);
  });

  it('explicit: returns only ids that exist, sorted', () => {
    const result = resolveViewQuery(index, { kind: 'explicit', entities: ['figshare', 'doi', 'not-a-real-entity'] }, 'es');
    expect(result.entityIds).toEqual(['doi', 'figshare']);
  });

  it('is a pure function: calling twice on the same query yields identical results', () => {
    const q = { kind: 'entities' as const, where: [{ type: 'index' }] };
    const a = resolveViewQuery(index, q, 'es');
    const b = resolveViewQuery(index, q, 'es');
    expect(a).toEqual(b);
  });
});

describe('describeEntitySet / activeOptionalColumns', () => {
  it('surfaces coverage columns only when at least one matched entity has them', () => {
    const ids = resolveViewQuery(index, { kind: 'entities', where: [{ type: 'index' }] }, 'es').entityIds;
    const cols = activeOptionalColumns(index, ids);
    expect(cols).toContain('indexKind');
    const rows = describeEntitySet(index, ids, 'es');
    expect(rows.length).toBe(ids.length);
    expect(rows.every((r) => typeof r.name === 'string' && r.name.length > 0)).toBe(true);
  });

  it('omits a column entirely when no matched entity carries it', () => {
    const ids = resolveViewQuery(index, { kind: 'entities', where: [{ type: 'standard' }] }, 'es').entityIds;
    const cols = activeOptionalColumns(index, ids);
    expect(cols).not.toContain('coverageLanguages');
  });
});

import { describe, expect, it } from 'vitest';
import { computeStats } from '../../../src/lib/graph/stats.js';
import { buildIndex } from '../../../src/lib/graph/build-index.js';
import { entities } from '../../fixtures/valid-graph.js';
import { loadRealVocab } from '../../fixtures/load-real-vocab.js';

const vocab = loadRealVocab();
const emptyProse = new Map([
  ['es', new Map()],
  ['en', new Map()],
]) as never;

describe('computeStats', () => {
  it('is consistent with buildIndex, which delegates to it', () => {
    const index = buildIndex(entities, emptyProse, vocab.predicatesVocab, vocab.entityTypesVocab);
    expect(index.stats.entityCount).toBe(entities.length);
    expect(index.stats.byType.repository).toBe(2);
    expect(index.stats.byPredicate['owned-by']).toBe(1);
    expect(index.stats.maxDegree).toBeGreaterThan(0);
  });

  it('handles an empty graph without throwing', () => {
    const stats = computeStats({
      entityIds: [],
      byType: new Map(),
      byLayer: new Map(),
      edges: [],
      degree: new Map(),
      predicateIds: [...vocab.predicatesVocab.keys()],
      prose: new Map(),
    });
    expect(stats.entityCount).toBe(0);
    expect(stats.maxDegree).toBe(0);
    expect(stats.orphans).toEqual([]);
  });

  it('defaults degree to 0 for an entityId absent from the degree map', () => {
    const stats = computeStats({
      entityIds: ['a', 'b'],
      byType: new Map(),
      byLayer: new Map(),
      edges: [],
      degree: new Map([['a', { in: 1, out: 0 }]]), // 'b' deliberately missing
      predicateIds: [],
      prose: new Map(),
    });
    expect(stats.orphans).toEqual(['b']);
  });

  it('counts an edge whose predicate was not pre-declared in predicateIds', () => {
    const stats = computeStats({
      entityIds: ['a', 'b'],
      byType: new Map(),
      byLayer: new Map(),
      edges: [{ from: 'a', to: 'b', predicate: 'issues', confidence: 'asserted', sources: [], derived: false }],
      degree: new Map([
        ['a', { in: 0, out: 1 }],
        ['b', { in: 1, out: 0 }],
      ]),
      predicateIds: [], // 'issues' not declared
      prose: new Map(),
    });
    expect(stats.byPredicate.issues).toBe(1);
  });

  it('sorts equal ids as a tie (compareIds returns 0)', () => {
    const stats = computeStats({
      entityIds: ['dup', 'dup'],
      byType: new Map(),
      byLayer: new Map(),
      edges: [],
      degree: new Map(),
      predicateIds: [],
      prose: new Map(),
    });
    expect(stats.orphans).toEqual(['dup', 'dup']);
  });

  it('sorts out-of-order ids, exercising the a>b branch of compareIds', () => {
    const stats = computeStats({
      entityIds: ['zebra', 'apple'],
      byType: new Map(),
      byLayer: new Map(),
      edges: [],
      degree: new Map(),
      predicateIds: [],
      prose: new Map([['es', new Map()]]),
    });
    expect(stats.orphans).toEqual(['apple', 'zebra']);
    expect(stats.translationCoverage.es.missing).toEqual(['apple', 'zebra']);
  });
});

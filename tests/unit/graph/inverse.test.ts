import { describe, expect, it } from 'vitest';
import { buildIndex } from '../../../src/lib/graph/build-index.js';
import { inverseLabelFor, labelFor } from '../../../src/lib/graph/inverse.js';
import { entities } from '../../fixtures/valid-graph.js';
import { loadRealVocab } from '../../fixtures/load-real-vocab.js';

const vocab = loadRealVocab();
const emptyProse = new Map([
  ['es', new Map()],
  ['en', new Map()],
]) as never;

describe('inverse labels', () => {
  const index = buildIndex(entities, emptyProse, vocab.predicatesVocab, vocab.entityTypesVocab);
  const edge = index.edges.find((e) => e.predicate === 'owned-by')!;

  it('labelFor draws the active-voice label in the requested locale', () => {
    expect(labelFor(index, edge, 'en')).toBe('owned by');
    expect(labelFor(index, edge, 'es')).toBe('es propiedad de');
  });

  it('inverseLabelFor draws the passive-voice label for the target side', () => {
    expect(inverseLabelFor(index, edge, 'en')).toBe('owns');
  });

  it('falls back to the raw predicate id for an unknown locale', () => {
    expect(labelFor(index, edge, 'fr')).toBe('owned-by');
    expect(inverseLabelFor(index, edge, 'fr')).toBe('owned-by');
  });
});

import { describe, it, expect } from 'vitest';
import { matchesFacets, hasNoRelations, type FacetableNode, type FacetFilters } from '../../../src/lib/map/facets.js';

const NO_FILTERS: FacetFilters = { layers: [], types: [], governances: [], tags: [] };
const NODE: FacetableNode = { type: 'repository', layer: 'institutional-system', governance: 'commercial', tags: ['theme:vertical-integration'] };

describe('matchesFacets', () => {
  it('matches everything when no filters are active', () => {
    expect(matchesFacets(NODE, NO_FILTERS)).toBe(true);
  });

  it('filters by layer', () => {
    expect(matchesFacets(NODE, { ...NO_FILTERS, layers: ['institutional-system'] })).toBe(true);
    expect(matchesFacets(NODE, { ...NO_FILTERS, layers: ['index'] })).toBe(false);
  });

  it('filters by type', () => {
    expect(matchesFacets(NODE, { ...NO_FILTERS, types: ['repository'] })).toBe(true);
    expect(matchesFacets(NODE, { ...NO_FILTERS, types: ['index'] })).toBe(false);
  });

  it('filters by governance', () => {
    expect(matchesFacets(NODE, { ...NO_FILTERS, governances: ['commercial'] })).toBe(true);
    expect(matchesFacets(NODE, { ...NO_FILTERS, governances: ['nonprofit'] })).toBe(false);
  });

  it('filters by tag (any-of)', () => {
    expect(matchesFacets(NODE, { ...NO_FILTERS, tags: ['theme:vertical-integration'] })).toBe(true);
    expect(matchesFacets(NODE, { ...NO_FILTERS, tags: ['theme:other'] })).toBe(false);
  });

  it('requires all active facet dimensions to match (AND across dimensions)', () => {
    expect(matchesFacets(NODE, { layers: ['institutional-system'], types: ['index'], governances: [], tags: [] })).toBe(false);
  });
});

describe('hasNoRelations', () => {
  it('is true only when both directions are zero', () => {
    expect(hasNoRelations({ in: 0, out: 0 })).toBe(true);
    expect(hasNoRelations({ in: 1, out: 0 })).toBe(false);
    expect(hasNoRelations({ in: 0, out: 1 })).toBe(false);
  });
});

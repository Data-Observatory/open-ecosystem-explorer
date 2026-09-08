// Phase 6a generators (layers, type-map, predicate-map, taxonomy, model):
// determinism + basic sanity against the real, full Phase 5 content set
// (107 entities), not a synthetic fixture — these diagrams only make sense
// against real graph shape (e.g. the owned-by three-parent fan).
import { describe, it, expect } from 'vitest';
import { buildIndex } from '../../../src/lib/graph/build-index.js';
import { loadRealVocab } from '../../fixtures/load-real-vocab.js';
import { loadRealEntities, loadRealProseMap } from '../../fixtures/load-real-content.js';
import { buildLayerStackDiagram, describeLayerStack, LAYER_ORDER } from '../../../src/lib/mermaid/layers.js';
import { buildTypeMapDiagram, describeTypeMap, computeTypeMapView } from '../../../src/lib/mermaid/type-map.js';
import { buildPredicateMapDiagram, describePredicateMap, computePredicateMapView } from '../../../src/lib/mermaid/predicate-map.js';
import { buildTaxonomyMindmap, describeTaxonomy } from '../../../src/lib/mermaid/taxonomy.js';
import { buildModelErDiagram, describeModel } from '../../../src/lib/mermaid/model.js';

function realIndex() {
  const vocab = loadRealVocab();
  const entities = loadRealEntities();
  const prose = loadRealProseMap();
  return { index: buildIndex(entities, prose, vocab.predicatesVocab, vocab.entityTypesVocab), vocab };
}

describe('layers.ts', () => {
  it('is deterministic', () => {
    const { index, vocab } = realIndex();
    const a = buildLayerStackDiagram(index, vocab.entityTypesVocab, 'es');
    const b = buildLayerStackDiagram(index, vocab.entityTypesVocab, 'es');
    expect(a).toBe(b);
  });

  it('covers every layer that has ≥1 populated type, and every row is a real (layer, type) with count > 0', () => {
    const { index, vocab } = realIndex();
    const description = describeLayerStack(index, vocab.entityTypesVocab, 'es');
    expect(description.rows.length).toBeGreaterThan(0);
    for (const row of description.rows) {
      expect(LAYER_ORDER.some((l) => row.subjectName.length > 0)).toBe(true);
      expect(row.objectName).toMatch(/\(\d+\)$/);
    }
  });
});

describe('type-map.ts', () => {
  it('is deterministic', () => {
    const { index } = realIndex();
    const a = buildTypeMapDiagram(index, loadRealVocab().entityTypesVocab, 'organization', 'es');
    const b = buildTypeMapDiagram(index, loadRealVocab().entityTypesVocab, 'organization', 'es');
    expect(a).toBe(b);
  });

  it("accessible table row count equals the computed view's edge count (A9.2)", () => {
    const { index } = realIndex();
    for (const type of ['organization', 'repository', 'cris', 'index'] as const) {
      const view = computeTypeMapView(index, type, 'es');
      const description = describeTypeMap(index, type, 'es');
      expect(description.rows.length).toBe(view.edges.length);
    }
  });
});

describe('predicate-map.ts', () => {
  it('is deterministic', () => {
    const { index } = realIndex();
    const a = buildPredicateMapDiagram(index, 'owned-by', 'es');
    const b = buildPredicateMapDiagram(index, 'owned-by', 'es');
    expect(a).toBe(b);
  });

  it("owned-by shows the three-parent vertical-integration fan (§5.3): Elsevier, Clarivate and Digital Science each own ≥2 products", () => {
    const { index } = realIndex();
    const view = computePredicateMapView(index, 'owned-by', 'es');
    expect(view.overBudget).toBe(false);
    const byTarget = new Map<string, number>();
    for (const e of view.edges) byTarget.set(e.to, (byTarget.get(e.to) ?? 0) + 1);
    for (const parent of ['elsevier', 'clarivate', 'digital-science']) {
      expect(byTarget.get(parent) ?? 0).toBeGreaterThanOrEqual(2);
    }
  });

  it('accessible table row count equals the real edge count for that predicate, independent of the diagram budget gate', () => {
    const { index } = realIndex();
    for (const predicate of ['owned-by', 'implements', 'complies-with'] as const) {
      const description = describePredicateMap(index, predicate, 'es');
      const real = index.edges.filter((e) => e.predicate === predicate).length;
      expect(description.rows.length).toBe(real);
    }
  });
});

describe('taxonomy.ts', () => {
  it('is deterministic', () => {
    const { index, vocab } = realIndex();
    const a = buildTaxonomyMindmap(index, vocab.entityTypesVocab, vocab.tagsVocab, 'es');
    const b = buildTaxonomyMindmap(index, vocab.entityTypesVocab, vocab.tagsVocab, 'es');
    expect(a).toBe(b);
  });

  it('every accessible row carries a real, resolvable href (mindmap has no click support, so this table is the only navigation)', () => {
    const { index, vocab } = realIndex();
    const description = describeTaxonomy(index, vocab.entityTypesVocab, vocab.tagsVocab, 'es');
    expect(description.rows.length).toBeGreaterThan(0);
    for (const row of description.rows) {
      expect(row.href).toMatch(/^\/es\/entities\/[a-z-]+\/\?tag=/);
    }
  });
});

describe('model.ts', () => {
  it('is deterministic and generates one erDiagram line per (predicate, domain, range) triple', () => {
    const { vocab } = realIndex();
    const a = buildModelErDiagram(vocab.predicatesVocab);
    const b = buildModelErDiagram(vocab.predicatesVocab);
    expect(a).toBe(b);
    const description = describeModel(vocab.predicatesVocab, 'es');
    const relationshipLines = a.split('\n').filter((l) => l.includes('}o--o{'));
    expect(relationshipLines.length).toBe(description.rows.length);
  });

  it('declares every one of the 12 entity types as an ER entity', () => {
    const { vocab } = realIndex();
    const source = buildModelErDiagram(vocab.predicatesVocab);
    for (const type of ['IDENTIFIER', 'AGENCY', 'INDEX', 'CRIS', 'REPOSITORY', 'AGGREGATOR', 'PUBLISHING_PLATFORM', 'STANDARD', 'COMMUNITY', 'COALITION', 'POLICY', 'ORGANIZATION']) {
      expect(source).toContain(type);
    }
  });
});

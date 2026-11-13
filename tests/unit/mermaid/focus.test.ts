import { describe, it, expect } from 'vitest';
import { buildIndex } from '../../../src/lib/graph/build-index.js';
import { buildFocusDiagram } from '../../../src/lib/mermaid/flowchart.js';
import { describeFocusEntity } from '../../../src/lib/a11y/describe.js';
import { loadRealVocab } from '../../fixtures/load-real-vocab.js';
import { loadRealEntities, loadRealProseMap } from '../../fixtures/load-real-content.js';
import type { Entity } from '../../../src/lib/model/types.js';

function realIndex() {
  const vocab = loadRealVocab();
  const entities = loadRealEntities();
  const prose = loadRealProseMap();
  return buildIndex(entities, prose, vocab.predicatesVocab, vocab.entityTypesVocab);
}

// Appendix B's worked example is a closed 9-entity subgraph, self-contained
// (none of its relations point outside this set). Scoping these two describe
// blocks to just these IDs keeps them a stable regression test of the literal
// Appendix B.2/B.3 example, independent of how many later Phase 5 batches add
// their own entities that happen to share a predicate/target with Figshare
// (e.g. also `implements datacite-metadata-schema`) — that growth is real and
// correct (it's the "sibling" mechanism working as designed), just not what
// this specific test is checking.
const APPENDIX_B_IDS = [
  'doi',
  'figshare',
  'datacite',
  'digital-science',
  'datacite-metadata-schema',
  'dimensions',
  'symplectic-elements',
  'holtzbrinck',
  'handle-system',
] as const;

function appendixBIndex() {
  const vocab = loadRealVocab();
  const entities = loadRealEntities(APPENDIX_B_IDS);
  const prose = loadRealProseMap(APPENDIX_B_IDS);
  return buildIndex(entities, prose, vocab.predicatesVocab, vocab.entityTypesVocab);
}

describe('buildFocusDiagram — Appendix B.2 (real seed content, scoped to the 9-entity worked example)', () => {
  const index = appendixBIndex();

  it('is deterministic: calling twice produces byte-identical Mermaid source', () => {
    const a = buildFocusDiagram(index, 'figshare', 'es');
    const b = buildFocusDiagram(index, 'figshare', 'es');
    expect(a).toBe(b);
  });

  it('renders all five nodes with the exact shapes/classes from Appendix B.2', () => {
    const source = buildFocusDiagram(index, 'figshare', 'es');
    expect(source).toContain('flowchart LR');
    expect(source).toContain('n_figshare["Figshare"]:::repository'); // institutional-system layer -> rect
    expect(source).toContain('n_digital_science{{"Digital Science"}}:::organization'); // cross-cutting -> hexagon
    expect(source).toContain('n_datacite_metadata_schema{{"DataCite Metadata Schema"}}:::standard');
    expect(source).toContain('n_dimensions[("Dimensions")]:::index'); // index -> cylinder
    expect(source).toContain('n_symplectic_elements["Symplectic Elements"]:::cris'); // institutional-system -> rect
  });

  it('draws owned-by thick (solid ==>) and implements solid (-->), per §6.4', () => {
    const source = buildFocusDiagram(index, 'figshare', 'es');
    expect(source).toContain('n_figshare ==>|es propiedad de| n_digital_science');
    expect(source).toContain('n_figshare -->|implementa| n_datacite_metadata_schema');
  });

  it('includes Dimensions and Symplectic Elements as dashed siblings under the shared owner (Appendix B.2\'s "siblings" note)', () => {
    const source = buildFocusDiagram(index, 'figshare', 'es');
    expect(source).toContain('n_dimensions -.->|es propiedad de| n_digital_science');
    expect(source).toContain('n_symplectic_elements -.->|es propiedad de| n_digital_science');
  });

  it('emits one click directive per node, all five present', () => {
    const source = buildFocusDiagram(index, 'figshare', 'es');
    for (const id of ['figshare', 'digital-science', 'datacite-metadata-schema', 'dimensions', 'symplectic-elements']) {
      expect(source).toContain(`click n_${id.replace(/-/g, '_')} href "/es/entity/${id}"`);
    }
  });

  it('emits classDef lines for exactly the five types present, alphabetically (deliberate deviation from Appendix B\'s illustrative ordering — see report)', () => {
    const source = buildFocusDiagram(index, 'figshare', 'es');
    const classDefOrder = [...source.matchAll(/classDef (\w+)/g)].map((m) => m[1]);
    expect(classDefOrder).toEqual(['cris', 'index', 'organization', 'repository', 'standard']);
  });
});

describe('describeFocusEntity — A9.1/A9.2/A9.3 (accessible table parity)', () => {
  const index = appendixBIndex();

  it('produces the 4 rows of Appendix B.3 plus 3 legitimate content-audit additions — figshare and its sibling Dimensions both gained a real operated-by->digital-science edge (Digital Science operates its portfolio brands directly, not just owns them); the Dimensions<->Symplectic Elements interoperates-with edge is real too but sits outside this figshare-focused diagram (neither node is figshare itself, so it is not a "sibling of figshare" edge); figshare also gained an `is-a research-repository` classification edge to the new concept layer — subject/predicate/object matching', () => {
    const { rows } = describeFocusEntity(index, 'figshare', 'es');
    expect(rows).toHaveLength(7);
    const asStrings = rows.map((r) => `${r.subjectName} (${r.subjectType}) | ${r.predicateLabel} | ${r.objectName} (${r.objectType})`);
    expect(asStrings).toContain('Figshare (repository) | es propiedad de | Digital Science (organization)');
    expect(asStrings).toContain('Figshare (repository) | implementa | DataCite Metadata Schema (standard)');
    expect(asStrings).toContain('Figshare (repository) | operado por | Digital Science (organization)');
    expect(asStrings).toContain('Dimensions (index) | es propiedad de | Digital Science (organization)');
    expect(asStrings).toContain('Dimensions (index) | operado por | Digital Science (organization)');
    expect(asStrings).toContain('Symplectic Elements (cris) | es propiedad de | Digital Science (organization)');
  });

  it('A9.1: table row count equals the diagram\'s own edge count, for every entity in the full real content set', () => {
    // Deliberately uses the FULL growing graph (realIndex), not the Appendix-B
    // fixture above — this is a general invariant that must hold at any scale,
    // not a snapshot of one worked example.
    const full = realIndex();
    for (const id of full.entities.keys()) {
      const source = buildFocusDiagram(full, id, 'es');
      const edgeLines = source.split('\n').filter((l) => /-->|==>|-\.->/.test(l));
      // A9.2: a cluster edge stands for every real edge it hides, and the
      // table expands it back into one row per hidden edge.
      let expected = 0;
      for (const line of edgeLines) {
        const cluster = /__cluster__([a-z_]+)/.exec(line);
        if (!cluster) {
          expected += 1;
          continue;
        }
        const predicate = cluster[1]!.replace(/_/g, '-');
        expected += (full.outgoing.get(id) ?? []).filter((e) => e.predicate === predicate).length;
      }
      const { rows } = describeFocusEntity(full, id, 'es');
      expect(rows.length, `entity '${id}'`).toBe(expected);
    }
  });

  it('names every subject/object type in text (A9.6)', () => {
    const { rows } = describeFocusEntity(index, 'figshare', 'es');
    for (const r of rows) {
      expect(r.subjectType).toBeTruthy();
      expect(r.objectType).toBeTruthy();
    }
  });
});

describe('neighbour-collapsing (§6.4) — synthetic case beyond the 9-entity seed set', () => {
  it('collapses more than maxOutDegree same-predicate neighbours into one cluster node, and the accessible table still lists every real edge', () => {
    const vocab = loadRealVocab();
    const src = { url: 'https://example.org', accessed: '2026-09-01' };
    const agency: Entity = {
      id: 'fx-busy-agency',
      type: 'agency',
      name: 'Busy Agency',
      url: 'https://example.org/busy',
      status: 'active',
      governance: 'nonprofit',
      tags: ['function:registration'],
      relations: Array.from({ length: 7 }, (_, i) => ({ predicate: 'issues' as const, target: `fx-id-${i}` })),
      sources: [src],
      lastReviewed: '2026-09-01',
      registers: ['dataset'],
      feeModel: 'membership',
    };
    const identifiers: Entity[] = Array.from({ length: 7 }, (_, i) => ({
      id: `fx-id-${i}`,
      type: 'identifier' as const,
      name: `Fixture Identifier ${i}`,
      url: `https://example.org/fx-id-${i}`,
      status: 'active' as const,
      governance: 'nonprofit' as const,
      tags: ['function:identification'],
      relations: [],
      sources: [src],
      lastReviewed: '2026-09-01',
      identifies: 'object' as const,
    }));
    const entities = [agency, ...identifiers];
    const prose = new Map([
      ['es', new Map(entities.map((e) => [e.id, { summary: `Resumen de ${e.name}.`, body: '…' }]))],
      ['en', new Map()],
    ]);
    const index = buildIndex(entities, prose as never, vocab.predicatesVocab, vocab.entityTypesVocab);

    // 'issues' has maxOutDegree: 5 in the real vocab — 7 targets must collapse.
    const source = buildFocusDiagram(index, 'fx-busy-agency', 'es');
    expect(source).toContain('7 identifier');
    expect(source).not.toContain('n_fx_id_0[');

    const { rows } = describeFocusEntity(index, 'fx-busy-agency', 'es');
    expect(rows).toHaveLength(7); // A9.2: the table is never a lossy subset, even though the diagram shows one cluster node
  });
});

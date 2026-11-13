import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  computeTier,
  computeRanks,
  computeXSlots,
  computeLayout,
  DEFAULT_LAYOUT_OPTIONS,
  LABEL_CLEARANCE,
  CLUSTER_PADDING,
  CLUSTER_LABEL_CLEARANCE,
  MIN_CLUSTER_CELL_WIDTH,
} from '../../../src/lib/map/hierarchy.js';
import { classBoxHeight, CLASS_BOX_WIDTH } from '../../../src/lib/map/node-svg.js';

describe('computeTier', () => {
  it('places policy (a document, not an actor) at the very top (T4)', () => {
    expect(computeTier('policy')).toBe(4);
  });
  it('splits `standard` by standardKind rather than treating every standard alike (Opus evaluation report §A2: FAIR and OAI-PMH were both `type: standard` and landed in the same tier/row despite being conceptually different levels — principles vs. a technical protocol)', () => {
    expect(computeTier('standard', 'principles')).toBe(4); // FAIR
    expect(computeTier('standard', 'governance-criteria')).toBe(4); // POSI
    expect(computeTier('standard', 'protocol')).toBe(3); // OAI-PMH
    expect(computeTier('standard', 'metadata-schema')).toBe(3);
    expect(computeTier('standard', 'serialisation')).toBe(3);
    expect(computeTier('standard', 'certification-criteria')).toBe(3);
    expect(computeTier('standard', 'framework')).toBe(3);
    expect(computeTier('standard', 'principles')).not.toBe(computeTier('standard', 'protocol'));
  });
  it('a `standard` with no/unknown standardKind falls back to T3, never silently to T1', () => {
    expect(computeTier('standard')).toBe(3);
    expect(computeTier('standard', 'some-future-kind')).toBe(3);
  });
  it('splits `coalition` by coalitionKind: a declaration is a document (T4), the other kinds are actors (T2)', () => {
    expect(computeTier('coalition', 'declaration')).toBe(4);
    expect(computeTier('coalition', 'reform-movement')).toBe(2);
    expect(computeTier('coalition', 'funding-initiative')).toBe(2);
    expect(computeTier('coalition', 'network')).toBe(2);
  });
  it('a `coalition` with no/unknown coalitionKind falls back to T2 (an actor by default), never silently to T1', () => {
    expect(computeTier('coalition')).toBe(2);
    expect(computeTier('coalition', 'some-future-kind')).toBe(2);
  });
  it('places governing/operating bodies in the middle (T2)', () => {
    expect(computeTier('community')).toBe(2);
    expect(computeTier('organization')).toBe(2);
    expect(computeTier('agency')).toBe(2);
  });
  it('places concrete instruments at the bottom (T1)', () => {
    expect(computeTier('identifier')).toBe(1);
    expect(computeTier('index')).toBe(1);
    expect(computeTier('repository')).toBe(1);
    expect(computeTier('cris')).toBe(1);
    expect(computeTier('aggregator')).toBe(1);
    expect(computeTier('publishing-platform')).toBe(1);
  });
  it('defaults an unknown type to T1 rather than throwing', () => {
    expect(computeTier('unknown-future-type')).toBe(1);
  });
});

describe('computeTier against the real corpus', () => {
  // Data-driven, not hardcoded: reads every real `type: standard` entity's
  // actual `standardKind` from src/content/entities/*.yaml at test time, so
  // this fails the moment a new standard is authored with a standardKind
  // this module doesn't yet classify, or with a value that lands in an
  // unexpected tier — rather than silently trusting an assumed list (the
  // Opus evaluation report's own §A3 table was built by hand-reading these
  // same 18 files; this test re-derives it from the files directly).
  const ENTITIES_DIR = join(__dirname, '../../../src/content/entities');
  const PRINCIPLE_KINDS = new Set(['principles', 'governance-criteria']);

  function realStandardEntities(): { id: string; standardKind: string }[] {
    const files = readdirSync(ENTITIES_DIR).filter((f) => f.endsWith('.yaml'));
    const out: { id: string; standardKind: string }[] = [];
    for (const file of files) {
      const raw = readFileSync(join(ENTITIES_DIR, file), 'utf-8');
      const data = parseYaml(raw) as Record<string, unknown>;
      if (data.type === 'standard') {
        out.push({ id: file.replace(/\.yaml$/, ''), standardKind: data.standardKind as string });
      }
    }
    return out;
  }

  it('finds real `type: standard` entities in the corpus to test against (sanity check that the fixture path is right)', () => {
    expect(realStandardEntities().length).toBeGreaterThan(10);
  });

  it('every real standard entity has a standardKind computeTier recognises, and principle-level kinds land strictly above protocol/schema-level kinds', () => {
    const entities = realStandardEntities();
    for (const { id, standardKind } of entities) {
      expect(standardKind, `${id} is missing standardKind`).toBeTruthy();
      const tier = computeTier('standard', standardKind);
      if (PRINCIPLE_KINDS.has(standardKind)) {
        expect(tier, `${id} (standardKind: ${standardKind}) should be T4`).toBe(4);
      } else {
        expect(tier, `${id} (standardKind: ${standardKind}) should be T3, not silently T1/T2`).toBe(3);
      }
    }
  });

  it('a principles standard (TRUST) and OAI-PMH land in different tiers (originally the FAIR/OAI-PMH pair; FAIR is now a concept)', () => {
    const raw = parseYaml(readFileSync(join(ENTITIES_DIR, 'trust-principles.yaml'), 'utf-8')) as { standardKind: string };
    const oai = parseYaml(readFileSync(join(ENTITIES_DIR, 'oai-pmh.yaml'), 'utf-8')) as { standardKind: string };
    expect(computeTier('standard', raw.standardKind)).not.toBe(computeTier('standard', oai.standardKind));
  });
});

describe('computeRanks', () => {
  it('reproduces the user-described ordering on a slice of the real corpus: DataCite/Crossref above DOI, DataCite Metadata Schema next to DOI', () => {
    const nodes = [
      { id: 'doi', type: 'identifier' },
      { id: 'datacite', type: 'agency' },
      { id: 'crossref', type: 'agency' },
      { id: 'datacite-metadata-schema', type: 'standard' },
      { id: 'handle-system', type: 'identifier' },
    ];
    const edges = [
      { from: 'datacite', to: 'doi', predicate: 'issues' }, // source-higher: datacite above doi
      { from: 'crossref', to: 'doi', predicate: 'issues' },
      { from: 'datacite-metadata-schema', to: 'datacite', predicate: 'governed-by' }, // target-higher: datacite above schema
      { from: 'datacite-metadata-schema', to: 'doi', predicate: 'depends-on' }, // source-higher: schema above doi
      { from: 'doi', to: 'handle-system', predicate: 'depends-on' }, // source-higher: doi above handle-system
    ];
    const ranks = computeRanks(nodes, edges);
    expect(ranks.get('datacite')!.composite).toBeGreaterThan(ranks.get('doi')!.composite);
    expect(ranks.get('crossref')!.composite).toBeGreaterThan(ranks.get('doi')!.composite);
    expect(ranks.get('datacite-metadata-schema')!.composite).toBeGreaterThan(ranks.get('doi')!.composite);
    // doi and handle-system are both `identifier` (same tier) — same-type row
    // cohesion (2026-09-07, unconditional per direct user instruction) snaps
    // them onto one shared row rather than splitting them at their real
    // graph depths, even though a real depends-on edge connects them.
    expect(ranks.get('doi')!.composite).toBe(ranks.get('handle-system')!.composite);
  });

  it('places a commercial parent above its product via owned-by (target-higher) across types, but collapses same-type parent/subsidiary pairs onto one row (unconditional row cohesion, 2026-09-07 — the real corpus case: RELX owns Elsevier, both `organization`)', () => {
    const nodes = [
      { id: 'scopus', type: 'index' },
      { id: 'elsevier', type: 'organization' },
      { id: 'relx', type: 'organization' },
    ];
    const edges = [
      { from: 'scopus', to: 'elsevier', predicate: 'owned-by' },
      { from: 'elsevier', to: 'relx', predicate: 'owned-by' },
    ];
    const ranks = computeRanks(nodes, edges);
    // Cross-type (index below organization) still holds — collapsing only
    // ever applies within a same-(tier,type) group.
    expect(ranks.get('elsevier')!.composite).toBeGreaterThan(ranks.get('scopus')!.composite);
    // Same-type (both `organization`) — deliberate, known trade-off of the
    // unconditional rule: elsevier and relx now share one row instead of
    // relx sitting visibly above elsevier. The user explicitly rejected a
    // "keep genuinely-connected members split" exception for this same
    // pattern on identifiers (DOI/Handle System), so it applies here too.
    expect(ranks.get('relx')!.composite).toBe(ranks.get('elsevier')!.composite);
  });

  it('lifts a principle (FAIR) above the tools that comply with it, and below what mandates it', () => {
    const nodes = [
      { id: 'fair', type: 'standard' },
      { id: 'dataverse', type: 'repository' },
      { id: 'unesco', type: 'policy' },
    ];
    const edges = [
      { from: 'dataverse', to: 'fair', predicate: 'complies-with' }, // target-higher: fair above dataverse
      { from: 'unesco', to: 'fair', predicate: 'mandates' }, // source-higher: unesco above fair
    ];
    const ranks = computeRanks(nodes, edges);
    expect(ranks.get('fair')!.composite).toBeGreaterThan(ranks.get('dataverse')!.composite);
    expect(ranks.get('unesco')!.composite).toBeGreaterThan(ranks.get('fair')!.composite);
  });

  it('treats endorsed-by as lateral: a supporter does not rank above the declaration it signs', () => {
    const nodes = [
      { id: 'barcelona', type: 'coalition', subtype: 'declaration' },
      { id: 'crossref', type: 'agency' },
    ];
    const edges = [{ from: 'barcelona', to: 'crossref', predicate: 'endorsed-by' }];
    const ranks = computeRanks(nodes, edges);
    expect(ranks.get('barcelona')!.depth).toBe(0);
    expect(ranks.get('crossref')!.depth).toBe(0);
  });

  it('excludes lateral predicates (interoperates-with, supersedes) from ranking', () => {
    const nodes = [
      { id: 'a', type: 'index' },
      { id: 'b', type: 'index' },
    ];
    const edges = [{ from: 'a', to: 'b', predicate: 'interoperates-with' }];
    const ranks = computeRanks(nodes, edges);
    expect(ranks.get('a')!.depth).toBe(0);
    expect(ranks.get('b')!.depth).toBe(0);
  });

  it('resolves a conflicting pair (both directions implied) by preferring the target-higher predicate — the real datacite/re3data case', () => {
    const nodes = [
      { id: 'datacite', type: 'agency' },
      { id: 're3data', type: 'index' },
    ];
    const edges = [
      { from: 're3data', to: 'datacite', predicate: 'depends-on' }, // source-higher: re3data above datacite
      { from: 're3data', to: 'datacite', predicate: 'operated-by' }, // target-higher: datacite above re3data (wins)
    ];
    const ranks = computeRanks(nodes, edges);
    expect(ranks.get('datacite')!.depth).toBeGreaterThan(ranks.get('re3data')!.depth);
  });

  it('never hangs on an adversarial residual cycle after conflict resolution', () => {
    const nodes = [
      { id: 'a', type: 'index' },
      { id: 'b', type: 'index' },
      { id: 'c', type: 'index' },
    ];
    // A same-orientation 3-cycle (all source-higher) has no conflicting pair
    // to resolve, so it stays a real cycle — must terminate, not hang.
    const edges = [
      { from: 'a', to: 'b', predicate: 'depends-on' },
      { from: 'b', to: 'c', predicate: 'depends-on' },
      { from: 'c', to: 'a', predicate: 'depends-on' },
    ];
    expect(() => computeRanks(nodes, edges)).not.toThrow();
  });

  it('ignores edges whose endpoint is not in the node set', () => {
    const nodes = [{ id: 'a', type: 'index' }];
    const edges = [{ from: 'a', to: 'ghost', predicate: 'depends-on' }];
    const ranks = computeRanks(nodes, edges);
    expect(ranks.get('a')!.depth).toBe(0);
  });

  it('snaps a same-(tier,type) group with no internal above-edge onto one shared composite (row cohesion fix — user: "still not really ordered... should be all in the same row")', () => {
    // crossref/datacite: both `agency`, each reaches `doi` via `issues`
    // (source-higher) at the same distance, so no bug means they'd already
    // land at the same depth here — the point of THIS test is a group whose
    // members would otherwise scatter: give crossref one extra hop.
    const nodes = [
      { id: 'doi', type: 'identifier' },
      { id: 'crossref', type: 'agency' },
      { id: 'datacite', type: 'agency' },
      { id: 'extra-hop', type: 'standard' },
    ];
    const edges = [
      { from: 'datacite', to: 'doi', predicate: 'issues' }, // datacite depth = doi.depth + 1
      { from: 'extra-hop', to: 'doi', predicate: 'depends-on' }, // extra-hop above doi too
      { from: 'crossref', to: 'extra-hop', predicate: 'depends-on' }, // crossref one hop further than datacite
    ];
    const ranks = computeRanks(nodes, edges);
    // Without the fix, crossref.depth (2) !== datacite.depth (1) — different
    // rows despite being the same type/tier and having no direct edge to
    // each other. With the fix, both `agency` members share one composite.
    expect(ranks.get('crossref')!.composite).toBe(ranks.get('datacite')!.composite);
  });

  it('collapses a same-type group onto one row even when a real, direct above-edge connects two of its own members (DOI depends-on Handle System — user, 2026-09-07: "DOI, handle, orcid ID, ROR: are not in the same row, and are all identifiers; why????" — unconditional, no exception)', () => {
    const nodes = [
      { id: 'doi', type: 'identifier' },
      { id: 'handle-system', type: 'identifier' },
    ];
    const edges = [{ from: 'doi', to: 'handle-system', predicate: 'depends-on' }];
    const ranks = computeRanks(nodes, edges);
    expect(ranks.get('doi')!.composite).toBe(ranks.get('handle-system')!.composite);
  });

  // 2026-09-08: user found T1 ("instrumentos y sistemas") and T2 ("instituciones
  // y agencias") too visually concentrated — everything of one `type` sharing
  // exactly one row, regardless of scale, was the row-cohesion fix above doing
  // its job too well once a type has 40-60+ members. Split each one dimension
  // further, on data that already exists and already varies meaningfully:
  // T1 by `governance` (subtype doesn't help — it's null on identifier/
  // repository), T2 by the entity's `region:*` tag.
  it('splits a same-(tier,type) T1 group by governance instead of forcing the whole type onto one row (real case: index entities split commercial vs nonprofit, e.g. Scopus/Web of Science vs OpenAlex)', () => {
    const nodes = [
      { id: 'commercial-a', type: 'index', governance: 'commercial' },
      { id: 'commercial-b', type: 'index', governance: 'commercial' },
      { id: 'nonprofit-a', type: 'index', governance: 'nonprofit' },
      { id: 'anchor', type: 'agency', governance: 'nonprofit' },
    ];
    // Gives nonprofit-a a real depth of 1; commercial-a/b stay at depth 0.
    // Pre-fix (type-only grouping), all three `index` members would snap to
    // the majority depth (0), forcing nonprofit-a onto the commercial pair's
    // row despite having a different governance.
    const edges = [{ from: 'nonprofit-a', to: 'anchor', predicate: 'depends-on' }];
    const ranks = computeRanks(nodes, edges);
    // Same governance still snaps together...
    expect(ranks.get('commercial-a')!.composite).toBe(ranks.get('commercial-b')!.composite);
    // ...but a different governance is no longer dragged onto that row.
    expect(ranks.get('nonprofit-a')!.composite).not.toBe(ranks.get('commercial-a')!.composite);
  });

  it('splits a same-(tier,type) T2 group by region tag instead of forcing the whole type onto one row (real case: organization entities split europe vs north-america/global, e.g. Elsevier/RELX vs International DOI Foundation)', () => {
    const nodes = [
      { id: 'europe-a', type: 'organization', tags: ['region:europe'] },
      { id: 'europe-b', type: 'organization', tags: ['region:europe'] },
      { id: 'global-a', type: 'organization', tags: [] }, // no region tag -> defaults to 'global'
      { id: 'anchor', type: 'index' },
    ];
    // Gives global-a a real depth of 1; europe-a/b stay at depth 0. Pre-fix
    // (type-only grouping), all three `organization` members would snap to
    // the majority depth (0), forcing global-a onto the europe pair's row.
    const edges = [{ from: 'global-a', to: 'anchor', predicate: 'depends-on' }];
    const ranks = computeRanks(nodes, edges);
    expect(ranks.get('europe-a')!.composite).toBe(ranks.get('europe-b')!.composite);
    expect(ranks.get('global-a')!.composite).not.toBe(ranks.get('europe-a')!.composite);
  });

  describe('row cohesion against the real /map2 curated corpus', () => {
    // Data-driven, not a hand-picked fixture: loads every entity actually
    // shown on /map2 (same CORE_ENTITY_IDS list as
    // src/pages/[locale]/map2/index.astro) plus every real relation between
    // two of them, and asserts the invariant this fix exists to guarantee:
    // a type never scatters across multiple rows within one tier, period.
    const ENTITIES_DIR = join(__dirname, '../../../src/content/entities');
    // Kept in sync by hand with src/pages/[locale]/map2/index.astro's
    // CORE_ENTITY_IDS — small, stable, curated list; a drift here would only
    // ever make this test's coverage stale, never wrong (still real corpus
    // data either way).
    const CORE_ENTITY_IDS = [
      'doi', 'orcid', 'ror', 'handle-system', 'crossref', 'datacite', 'scopus',
      'web-of-science', 'openalex', 'dimensions', 'zenodo', 'dataverse', 'dspace',
      'symplectic-elements', 'figshare', 'elsevier', 'relx', 'clarivate',
      'digital-science', 'holtzbrinck', 'fair', 'coar', 'posi',
      'datacite-metadata-schema', 'unesco-recommendation-open-science',
      'coar-notify', 'oai-pmh', 'dona-foundation', 'international-doi-foundation',
      'force11', 'ourresearch', 'trust-principles', 'coretrustseal',
    ];

    function loadCuratedGraph() {
      const idSet = new Set(CORE_ENTITY_IDS);
      const nodes: { id: string; type: string; subtype?: string; governance?: string; tags?: string[] }[] = [];
      const edges: { from: string; to: string; predicate: string }[] = [];
      for (const id of CORE_ENTITY_IDS) {
        const raw = readFileSync(join(ENTITIES_DIR, `${id}.yaml`), 'utf-8');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = parseYaml(raw) as any;
        const subtypeField: Record<string, string> = {
          standard: 'standardKind',
          coalition: 'coalitionKind',
          index: 'indexKind',
          repository: 'repositoryKind',
          cris: 'crisKind',
          aggregator: 'aggregatorKind',
          'publishing-platform': 'platformKind',
          community: 'communityKind',
          policy: 'policyKind',
          organization: 'orgKind',
        };
        const field = subtypeField[data.type as string];
        nodes.push({ id, type: data.type, subtype: field ? data[field] : undefined, governance: data.governance, tags: data.tags ?? [] });
        for (const rel of data.relations ?? []) {
          if (idSet.has(rel.target)) edges.push({ from: id, to: rel.target, predicate: rel.predicate });
        }
      }
      return { nodes, edges };
    }
    /** Mirrors hierarchy.ts's own `groupKey` (T1 by governance, T2 by region
     *  tag, other tiers by type alone) so this test's invariant matches what
     *  the code actually guarantees, not the pre-2026-09-08 type-only rule. */
    function extendedGroupKey(n: { type: string; subtype?: string; governance?: string; tags?: string[] }): string {
      const tier = computeTier(n.type, n.subtype);
      if (tier === 1) return `${tier}|${n.type}|${n.governance ?? ''}`;
      if (tier === 2) {
        const regionTag = (n.tags ?? []).find((t) => t.startsWith('region:'));
        return `${tier}|${n.type}|${regionTag ? regionTag.slice('region:'.length) : 'global'}`;
      }
      return `${tier}|${n.type}`;
    }

    it('finds the curated entities on disk (sanity check the id list is still current)', () => {
      const { nodes } = loadCuratedGraph();
      expect(nodes.length).toBe(CORE_ENTITY_IDS.length);
      for (const n of nodes) expect(n.type, `${n.id} missing type`).toBeTruthy();
    });

    // Unconditional (2026-09-07, per direct user instruction — a prior
    // version of this fix let a real internal above-edge between two
    // members split just that pair; the user rejected the exception
    // outright: "DOI, handle, orcid ID, ROR: are not in the same row, and
    // are all identifiers; why????"). Every (tier,type) group with 2+
    // members must share exactly one composite, full stop — no carve-out
    // for an internal edge.
    it('every (tier,type[,governance|region]) group with 2+ members shares exactly one composite, unconditionally', () => {
      const { nodes, edges } = loadCuratedGraph();
      const ranks = computeRanks(nodes, edges);
      const groups = new Map<string, string[]>();
      for (const n of nodes) {
        const key = extendedGroupKey(n);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(n.id);
      }
      for (const [key, memberIds] of groups) {
        if (memberIds.length < 2) continue;
        const composites = new Set(memberIds.map((id) => ranks.get(id)!.composite));
        expect(composites.size, `group ${key} (${memberIds.join(', ')}) spans ${composites.size} rows instead of sharing one`).toBe(1);
      }
    });

    // Concrete real-corpus anchor for the 2026-09-08 split: OpenAlex
    // (nonprofit) must no longer share a row with the commercial indices it
    // used to be forced onto (Scopus/Web of Science are `governance:
    // commercial`; OpenAlex is `governance: nonprofit` — same `type: index`,
    // same T1 tier).
    it('OpenAlex (nonprofit index) no longer shares a row with the commercial indices (Scopus, Web of Science)', () => {
      const { nodes, edges } = loadCuratedGraph();
      const ranks = computeRanks(nodes, edges);
      const openalex = ranks.get('openalex')!.composite;
      expect(ranks.get('scopus')!.composite).not.toBe(openalex);
      expect(ranks.get('web-of-science')!.composite).not.toBe(openalex);
    });

    // Concrete anchor for the exact reported case, not just the generic
    // sweep above: DOI, Handle System, ORCID and ROR (all `identifier`) must
    // ALL share one row, including the DOI<->Handle-System pair connected by
    // a real depends-on edge.
    it('DOI, Handle System, ORCID and ROR all share one row (the exact reported case)', () => {
      const { nodes, edges } = loadCuratedGraph();
      const ranks = computeRanks(nodes, edges);
      const composite = ranks.get('doi')!.composite;
      for (const id of ['handle-system', 'orcid', 'ror']) {
        expect(ranks.get(id)!.composite, `${id} does not share doi's row`).toBe(composite);
      }
    });
  });
});

describe('row separation across governance/region subgroups (real full corpus)', () => {
  // Regression test for a real bug: the 2026-09-08 groupKey split (T1 by
  // governance, T2 by region tag) only gave COHESION — members of one
  // subgroup snap to that subgroup's own mode depth — never SEPARATION
  // between two different subgroups of the same type. Since real
  // topological depth barely correlates with governance/region, most
  // subgroups' independently-computed modes coincided anyway (e.g. every
  // `organization` region bucket landed on the same depth), so the split
  // was invisible on the actual site despite 282/282 tests passing — the
  // suite above only ever asserted cohesion, never separation. Runs against
  // the FULL corpus (matches /map, not just /map2's curated subset) since
  // the bug lives in `computeRanks` itself, not in any one page's node list.
  const ENTITIES_DIR = join(__dirname, '../../../src/content/entities');
  const SUBTYPE_FIELD: Record<string, string> = {
    standard: 'standardKind',
    coalition: 'coalitionKind',
    index: 'indexKind',
    repository: 'repositoryKind',
    cris: 'crisKind',
    aggregator: 'aggregatorKind',
    'publishing-platform': 'platformKind',
    community: 'communityKind',
    policy: 'policyKind',
    organization: 'orgKind',
  };

  function loadFullGraph() {
    const files = readdirSync(ENTITIES_DIR).filter((f) => f.endsWith('.yaml'));
    const nodes: { id: string; type: string; subtype?: string; governance?: string; tags?: string[] }[] = [];
    const edges: { from: string; to: string; predicate: string }[] = [];
    for (const file of files) {
      const id = file.replace(/\.yaml$/, '');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = parseYaml(readFileSync(join(ENTITIES_DIR, file), 'utf-8')) as any;
      const field = SUBTYPE_FIELD[data.type as string];
      nodes.push({ id, type: data.type, subtype: field ? data[field] : undefined, governance: data.governance, tags: data.tags ?? [] });
      for (const rel of data.relations ?? []) {
        edges.push({ from: id, to: rel.target, predicate: rel.predicate });
      }
    }
    return { nodes, edges };
  }

  function regionOf(n: { tags?: string[] }): string {
    const tag = (n.tags ?? []).find((t) => t.startsWith('region:'));
    return tag ? tag.slice('region:'.length) : 'global';
  }

  it('every distinct governance value present within a T1 type gets its own composite, never shared with a sibling governance value of that same type', () => {
    const { nodes, edges } = loadFullGraph();
    const ranks = computeRanks(nodes, edges);
    const byType = new Map<string, Map<string, Set<number>>>(); // type -> governance -> composites seen
    for (const n of nodes) {
      if (computeTier(n.type, n.subtype) !== 1) continue;
      if (!byType.has(n.type)) byType.set(n.type, new Map());
      const byGov = byType.get(n.type)!;
      const gov = n.governance ?? '(none)';
      if (!byGov.has(gov)) byGov.set(gov, new Set());
      byGov.get(gov)!.add(ranks.get(n.id)!.composite);
    }
    for (const [type, byGov] of byType) {
      if (byGov.size < 2) continue; // only one governance value present — nothing to separate
      const compositeToGov = new Map<number, string>();
      for (const [gov, composites] of byGov) {
        for (const c of composites) {
          const clash = compositeToGov.get(c);
          expect(clash, `type "${type}": governance "${gov}" shares composite ${c} with governance "${clash}"`).toBeUndefined();
          compositeToGov.set(c, gov);
        }
      }
    }
  });

  it('every distinct region tag present within a T2 type gets its own composite, never shared with a sibling region of that same type', () => {
    const { nodes, edges } = loadFullGraph();
    const ranks = computeRanks(nodes, edges);
    const byType = new Map<string, Map<string, Set<number>>>(); // type -> region -> composites seen
    for (const n of nodes) {
      if (computeTier(n.type, n.subtype) !== 2) continue;
      if (!byType.has(n.type)) byType.set(n.type, new Map());
      const byRegion = byType.get(n.type)!;
      const region = regionOf(n);
      if (!byRegion.has(region)) byRegion.set(region, new Set());
      byRegion.get(region)!.add(ranks.get(n.id)!.composite);
    }
    for (const [type, byRegion] of byType) {
      if (byRegion.size < 2) continue;
      const compositeToRegion = new Map<number, string>();
      for (const [region, composites] of byRegion) {
        for (const c of composites) {
          const clash = compositeToRegion.get(c);
          expect(clash, `type "${type}": region "${region}" shares composite ${c} with region "${clash}"`).toBeUndefined();
          compositeToRegion.set(c, region);
        }
      }
    }
  });

  it('concrete anchor: the worst-reported case — organization region buckets (europe/north-america/latam/global) are all on different rows', () => {
    const { nodes, edges } = loadFullGraph();
    const ranks = computeRanks(nodes, edges);
    const byRegion = new Map<string, number>();
    for (const n of nodes) {
      if (n.type !== 'organization') continue;
      const region = regionOf(n);
      if (!byRegion.has(region)) byRegion.set(region, ranks.get(n.id)!.composite);
    }
    const composites = [...byRegion.values()];
    expect(new Set(composites).size, `organization region composites: ${JSON.stringify([...byRegion])}`).toBe(composites.length);
  });
});

describe('computeXSlots', () => {
  it('assigns a distinct slot to every node in the same row', () => {
    const nodes = [
      { id: 'a', type: 'identifier' },
      { id: 'b', type: 'identifier' },
      { id: 'c', type: 'identifier' },
    ];
    const edges: { from: string; to: string; predicate: string }[] = [];
    const ranks = computeRanks(nodes, edges);
    const slots = computeXSlots(nodes, edges, ranks);
    const values = [...slots.values()];
    expect(new Set(values).size).toBe(3);
  });

  it('is deterministic across repeated calls', () => {
    const nodes = [
      { id: 'z', type: 'identifier' },
      { id: 'a', type: 'identifier' },
    ];
    const edges: { from: string; to: string; predicate: string }[] = [];
    const ranks = computeRanks(nodes, edges);
    const first = computeXSlots(nodes, edges, ranks);
    const second = computeXSlots(nodes, edges, ranks);
    expect([...first.entries()]).toEqual([...second.entries()]);
  });

  it('breaks ties alphabetically when no neighbours are placed yet', () => {
    const nodes = [
      { id: 'zeta', type: 'identifier' },
      { id: 'alpha', type: 'identifier' },
    ];
    const edges: { from: string; to: string; predicate: string }[] = [];
    const ranks = computeRanks(nodes, edges);
    const slots = computeXSlots(nodes, edges, ranks);
    expect(slots.get('alpha')).toBeLessThan(slots.get('zeta')!);
  });

  // User: "inside a node, we should probably order cards by color (same
  // color remain together, in the same row for example), and then by
  // sub-type or other" — `type` determines a node's canvas fill colour, so
  // "by colour" means "by type". Nodes of the same type in the same row must
  // end up in a single contiguous run in the final x-order (no other type's
  // node between them), and within that run, ordered by subtype/id.
  it('groups same-type nodes into a single contiguous block within a row', () => {
    // `identifier` and `repository` are both T1 (see TIER_BY_TYPE), so all
    // five nodes below share one row/composite — the case that matters here
    // (mixing types that land in DIFFERENT tiers, like index/T1 vs
    // agency/T2, would put them in different rows entirely, which isn't
    // what "same row" means).
    const nodes = [
      { id: 'idx-b', type: 'repository' },
      { id: 'agency-b', type: 'identifier' },
      { id: 'idx-a', type: 'repository' },
      { id: 'agency-a', type: 'identifier' },
      { id: 'idx-c', type: 'repository' },
    ];
    const edges: { from: string; to: string; predicate: string }[] = [];
    const ranks = computeRanks(nodes, edges);
    const slots = computeXSlots(nodes, edges, ranks);
    const order = [...slots.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
    const typeAtSlot = (id: string) => nodes.find((n) => n.id === id)!.type;
    // Walk the ordered ids: once we leave a type's run, we must never see
    // that type again (no interleaving).
    const seenAndLeft = new Set<string>();
    let prevType: string | null = null;
    for (const id of order) {
      const t = typeAtSlot(id);
      if (prevType !== null && t !== prevType) seenAndLeft.add(prevType);
      expect(seenAndLeft.has(t), `type "${t}" reappeared after its block ended (order: ${order.join(',')})`).toBe(false);
      prevType = t;
    }
  });

  it('orders nodes within a same-type block by subtype, then id, as the secondary key', () => {
    // All three `standardKind` values used here (protocol/metadata-schema/
    // serialisation) map to the SAME tier (T3), so these three nodes share
    // one row — unlike `principles`, which would put a node in T4 instead
    // (a different row, where this test's slot comparison wouldn't mean
    // anything).
    const nodes = [
      { id: 'z-schema', type: 'standard', subtype: 'metadata-schema' },
      { id: 'a-protocol', type: 'standard', subtype: 'protocol' },
      { id: 'm-serialisation', type: 'standard', subtype: 'serialisation' },
    ];
    const edges: { from: string; to: string; predicate: string }[] = [];
    const ranks = computeRanks(nodes, edges);
    const slots = computeXSlots(nodes, edges, ranks);
    // Alphabetical by subtype: metadata-schema < protocol < serialisation.
    expect(slots.get('z-schema')).toBeLessThan(slots.get('a-protocol')!);
    expect(slots.get('a-protocol')).toBeLessThan(slots.get('m-serialisation')!);
  });
});

describe('computeLayout', () => {
  // Regression test for the exact bug reported by the user after Stage 2's
  // hierarchical layout shipped: composite (tier*100+depth) was being used
  // directly as a row multiplier, so a lone T1 row at composite 101 and a T2
  // row at composite 201 ended up 100*rowSpacing apart even though nothing
  // occupies the 99 composites in between — an ~20x layout bloat that forced
  // the initial fit zoom far below readability ("entities really far away,
  // need to zoom a lot"). Rows must be ranked by DENSE sorted position among
  // composites actually present, not by the raw composite value.
  it('spaces rows by dense rank, not by the raw composite gap between tiers', () => {
    const nodes = [
      { id: 'doi', type: 'identifier' }, // T1, depth 0 -> composite 100
      { id: 'datacite', type: 'agency' }, // T2, depth 0 -> composite 200
    ];
    const edges = [{ from: 'datacite', to: 'doi', predicate: 'operated-by' }]; // target-higher: datacite above doi
    const positions = computeLayout(nodes, edges, { rowSpacing: 80, colSpacing: 190, tierGap: 40, maxPerRow: 5 });
    const doiY = positions.get('doi')!.y;
    const dataciteY = positions.get('datacite')!.y;
    // datacite (higher composite/tier) must be higher up on screen, i.e. a
    // smaller (more negative) y than doi — checking direction as well as
    // magnitude, since a prior version of this test only checked the raw
    // difference and passed even with the rows inverted.
    expect(dataciteY).toBeLessThan(doiY);
    // Exactly one row apart (rowSpacing) plus the one tier-boundary gap
    // crossed (tierGap + LABEL_CLEARANCE, since T1 and T2 sit in the same
    // grid-arrangement column — see `computeLayout`'s COLUMN_A) — NOT
    // (200-100)=100 raw composite units apart. T1 ("doi") is a GRID_TIER —
    // even a single member still nests inside its own governance Cluster
    // box (see `MapExplorerV2.astro`'s `subBandKeyFor`), which itself
    // auto-expands by `2 * CLUSTER_PADDING` beyond its one child (2026-09-09
    // follow-up: this used to be silently absorbed by `LABEL_CLEARANCE`'s
    // much larger pre-retune buffer; now that the buffer is tight, this
    // module has to account for it explicitly — see `computeLayout`'s own
    // `clusterPad` comment).
    expect(doiY - dataciteY).toBe(80 + 2 * CLUSTER_PADDING + 40 + LABEL_CLEARANCE);
  });

  it('is unaffected by how large the gap between the two composite values is — only their rank order matters (single-column tiers)', () => {
    // Dense-rank spacing must be uniform between adjacent occupied rows
    // regardless of the underlying depth values. T4 is used deliberately —
    // it's one of the two tiers that KEPT the original single-column stack
    // (T1/T2 tile their buckets into a 2D grid instead, since 2026-09-08,
    // and no longer make this uniform-gap guarantee across buckets — see the
    // grid test below). Three distinct T4 types (`policy` is always T4;
    // `standard`/`coalition` reach T4 only via their principles/declaration
    // subtype) give 3 distinct `${tier}|${type}` groups to chain depths
    // across — `standard`/`coalition` alone can't offer more than one group
    // each since `groupKey` doesn't key on subtype.
    const nodes = [
      { id: 'n0', type: 'policy' },
      { id: 'n1', type: 'standard', subtype: 'principles' },
      { id: 'n2', type: 'coalition', subtype: 'declaration' },
    ];
    const edges = [
      { from: 'n1', to: 'n0', predicate: 'depends-on' },
      { from: 'n2', to: 'n1', predicate: 'depends-on' },
    ];
    const positions = computeLayout(nodes, edges, { rowSpacing: 80, colSpacing: 190, tierGap: 40, maxPerRow: 5 });
    const ys = ['n0', 'n1', 'n2'].map((id) => positions.get(id)!.y);
    const gaps = ys.slice(1).map((y, i) => Math.abs((ys[i] ?? 0) - y));
    for (const gap of gaps) expect(gap).toBe(80); // same tier throughout -> no tierGap crossed
  });

  it('tiles multiple T1 governance buckets into a 2D grid instead of one tall column', () => {
    // 2026-09-08 grid redesign (user: "the grey boxes can be side by side,
    // not only top to bottom"): T1/T2 Clusters (governance/region buckets)
    // no longer participate in the single-column stack at all — they tile
    // row-major into a grid sized to their own count. 5 buckets -> ceil(√5)
    // = 3 columns, 2 rows (3 in row 0, 2 in row 1), regardless of any real
    // graph depth between them (dropped from the key on purpose — see
    // `computeRanks`'s groupKey comment).
    const types = ['identifier', 'index', 'repository', 'cris', 'aggregator'];
    const governances = ['commercial', 'nonprofit', 'community', 'academic', 'public-agency'];
    const nodes = Array.from({ length: 5 }, (_, i) => ({ id: `n${i}`, type: types[i]!, governance: governances[i]! }));
    const positions = computeLayout(nodes, [], { rowSpacing: 80, colSpacing: 190, tierGap: 40, maxPerRow: 5 });
    const ys = [...new Set([...positions.values()].map((p) => p.y))];
    expect(ys.length).toBe(2); // 2 grid rows
    const xsByY = new Map<number, number>();
    for (const p of positions.values()) xsByY.set(p.y, (xsByY.get(p.y) ?? 0) + 1);
    const counts = [...xsByY.values()].sort((a, b) => b - a);
    expect(counts).toEqual([3, 2]); // 3 buckets in the fuller grid row, 2 in the other
  });

  // Follow-up bug report (2026-09-09, round 3): "there's too much empty
  // space between them (horizontally primary)" — the grid's horizontal gap
  // was built from `colSpacing` (tuned for spacing CARDS apart WITHIN one
  // row, not for the gap between whole CLUSTER blocks), while the vertical
  // gap already used the smaller `rowSpacing` — a real, measured asymmetry
  // (356px horizontal vs. 250px vertical at production spacing) with no
  // visual justification, since neither grid axis is "a row of cards". Both
  // axes now share the same `rowSpacing`-based gap.
  it('grids two single-card Clusters using the SAME rowSpacing-based gap on both axes, not colSpacing for the horizontal one', () => {
    const nodes = [
      { id: 'a', type: 'identifier', governance: 'commercial' },
      { id: 'b', type: 'identifier', governance: 'nonprofit' },
    ];
    // ceil(√2) = 2 columns, 1 row -> the two single-card Clusters land side
    // by side, so the x-distance between their centres is exactly one grid
    // column gap plus both cells' own (floor-width-dominated, since a single
    // card is far narrower than a Cluster's own label) half-widths.
    const positions = computeLayout(nodes, [], { rowSpacing: 80, colSpacing: 190, tierGap: 40, maxPerRow: 5 });
    const gapBetweenCenters = Math.abs(positions.get('a')!.x - positions.get('b')!.x);
    // Each cell here is floored at MIN_CLUSTER_CELL_WIDTH (a single card's
    // own `colSpacing`-wide block is narrower than the label needs), so the
    // two equal-width cells' centre-to-centre distance is cellWidth + gap.
    expect(gapBetweenCenters).toBeCloseTo(MIN_CLUSTER_CELL_WIDTH + (80 + CLUSTER_LABEL_CLEARANCE), 5);
    // Regression guard: the OLD (colSpacing-based) gap would have produced a
    // visibly larger distance — fail loudly if this ever drifts back.
    const oldBuggyGap = MIN_CLUSTER_CELL_WIDTH + (190 + CLUSTER_LABEL_CLEARANCE);
    expect(gapBetweenCenters).toBeLessThan(oldBuggyGap);
  });

  // Regression test for the second half of the same bug report: even after
  // fixing row spacing, one crowded rank (e.g. 10 T1 instruments sharing a
  // depth) set the layout's overall WIDTH and dragged the initial fit zoom
  // back down again ("still too much scrolling to zoom in/out"). A rank must
  // wrap into extra sub-rows past `maxPerRow` instead of spreading arbitrarily
  // wide.
  it('wraps a rank wider than maxPerRow into stacked sub-rows instead of one wide row', () => {
    const nodes = Array.from({ length: 7 }, (_, i) => ({ id: `n${i}`, type: 'identifier' }));
    const positions = computeLayout(nodes, [], { rowSpacing: 80, colSpacing: 190, tierGap: 40, maxPerRow: 5 });
    const distinctYs = new Set([...positions.values()].map((p) => p.y));
    // 7 nodes at maxPerRow 5 -> 2 sub-rows (5 + 2), not 1.
    expect(distinctYs.size).toBe(2);
    // No sub-row exceeds maxPerRow nodes.
    const countByY = new Map<number, number>();
    for (const p of positions.values()) countByY.set(p.y, (countByY.get(p.y) ?? 0) + 1);
    for (const count of countByY.values()) expect(count).toBeLessThanOrEqual(5);
  });

  it('wraps at a type-block boundary, never splitting one type across the wrap point (real corpus shape: cris(1)+identifier(3)+index(4)+repository(2)=10 members sharing one composite, maxPerRow 5 — a blind fixed-size slice cuts straight through the index and repository blocks)', () => {
    const nodes = [
      { id: 'cris-a', type: 'cris' },
      { id: 'id-a', type: 'identifier' },
      { id: 'id-b', type: 'identifier' },
      { id: 'id-c', type: 'identifier' },
      { id: 'idx-a', type: 'index' },
      { id: 'idx-b', type: 'index' },
      { id: 'idx-c', type: 'index' },
      { id: 'idx-d', type: 'index' },
      { id: 'repo-a', type: 'repository' },
      { id: 'repo-b', type: 'repository' },
    ];
    const positions = computeLayout(nodes, [], { rowSpacing: 80, colSpacing: 190, tierGap: 40, maxPerRow: 5 });
    // Two (or more) small type-blocks may legitimately share one sub-row —
    // the invariant that matters is that ONE type's own members never land
    // on two DIFFERENT sub-row y-values within this composite.
    const ysByType = new Map<string, Set<number>>();
    for (const n of nodes) {
      const y = positions.get(n.id)!.y;
      if (!ysByType.has(n.type)) ysByType.set(n.type, new Set());
      ysByType.get(n.type)!.add(y);
    }
    for (const [type, ys] of ysByType) {
      expect(ys.size, `type "${type}" was split across ${ys.size} sub-rows by the wrap`).toBe(1);
    }
  });

  it('does not wrap a rank at or under maxPerRow', () => {
    const nodes = Array.from({ length: 5 }, (_, i) => ({ id: `n${i}`, type: 'identifier' }));
    const positions = computeLayout(nodes, [], { rowSpacing: 80, colSpacing: 190, tierGap: 40, maxPerRow: 5 });
    const distinctYs = new Set([...positions.values()].map((p) => p.y));
    expect(distinctYs.size).toBe(1);
  });

  it('is deterministic across repeated calls', () => {
    const nodes = [
      { id: 'doi', type: 'identifier' },
      { id: 'datacite', type: 'agency' },
      { id: 'crossref', type: 'agency' },
    ];
    const edges = [
      { from: 'datacite', to: 'doi', predicate: 'operated-by' },
      { from: 'crossref', to: 'doi', predicate: 'operated-by' },
    ];
    const opts = { rowSpacing: 80, colSpacing: 190, tierGap: 40, maxPerRow: 5 };
    const first = computeLayout(nodes, edges, opts);
    const second = computeLayout(nodes, edges, opts);
    expect([...first.entries()]).toEqual([...second.entries()]);
  });

  // Regression test for the third bug in the same report: `ROW_SPACING` in
  // the renderer (70) was smaller than the class box's actual rendered
  // height (a constant 80px, since map2's class boxes always render exactly
  // 2 fields — see node-svg.ts's classBoxHeight(2)) — so every row's boxes
  // overlapped the next row's by ~10px regardless of node count ("some cards
  // are on top of others"). This checks the PRODUCTION spacing
  // (`DEFAULT_LAYOUT_OPTIONS`, the same values the renderer now imports —
  // see MapExplorerV2.astro) against every node pair's real axis-aligned
  // bounding box (Cytoscape's `position` is a node's CENTER), not just row
  // gaps in the abstract — this is what would have caught the original bug,
  // since that bug's row gap (70) was a real number, just smaller than the
  // real box height, and no prior test compared the two.
  describe('production spacing has zero node overlap', () => {
    const BOX_WIDTH = CLASS_BOX_WIDTH;
    const BOX_HEIGHT = classBoxHeight(2); // map2's classBoxFields() always returns exactly 2 rows

    function overlaps(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
      return Math.abs(a.x - b.x) < BOX_WIDTH && Math.abs(a.y - b.y) < BOX_HEIGHT;
    }
    function assertNoOverlaps(positions: Map<string, { x: number; y: number }>): void {
      const entries = [...positions.entries()];
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          const [idA, posA] = entries[i]!;
          const [idB, posB] = entries[j]!;
          expect(overlaps(posA, posB), `${idA} and ${idB} overlap at ${JSON.stringify(posA)} / ${JSON.stringify(posB)}`).toBe(false);
        }
      }
    }

    it('has zero overlapping node pairs on a dense multi-tier, multi-depth, row-wrapping fixture', () => {
      // Deliberately stresses every layout mechanism at once: 3 tiers, a
      // multi-step depth chain within a tier, and a rank wider than
      // maxPerRow (5) so sub-row wrapping is exercised too.
      const nodes = [
        // T1: 12 identifiers/indices sharing depth 0 -> forces >1 sub-row wrap.
        ...Array.from({ length: 12 }, (_, i) => ({ id: `t1-${i}`, type: 'identifier' })),
        // T1 depth chain: t1-chain-3 depends on t1-chain-2 depends on t1-chain-1 depends on t1-chain-0.
        { id: 't1-chain-0', type: 'index' },
        { id: 't1-chain-1', type: 'index' },
        { id: 't1-chain-2', type: 'index' },
        { id: 't1-chain-3', type: 'index' },
        // T2: 8 agencies/organizations.
        ...Array.from({ length: 8 }, (_, i) => ({ id: `t2-${i}`, type: 'agency' })),
        // T3: 4 standards.
        ...Array.from({ length: 4 }, (_, i) => ({ id: `t3-${i}`, type: 'standard' })),
      ];
      const edges = [
        { from: 't1-chain-1', to: 't1-chain-0', predicate: 'depends-on' },
        { from: 't1-chain-2', to: 't1-chain-1', predicate: 'depends-on' },
        { from: 't1-chain-3', to: 't1-chain-2', predicate: 'depends-on' },
        ...Array.from({ length: 8 }, (_, i) => ({ from: `t2-${i}`, to: `t1-${i % 12}`, predicate: 'operated-by' })),
      ];
      const positions = computeLayout(nodes, edges, DEFAULT_LAYOUT_OPTIONS);
      expect(positions.size).toBe(nodes.length);
      assertNoOverlaps(positions);
    });

    it('has zero overlapping node pairs on the exact tier/depth shape seen in the real /map2 curated set (27 nodes, per the last content-audit report)', () => {
      // Mirrors the real corpus's rough shape (a large T1 instrument group,
      // a mid-size T2 governance group, a small T3 principles group) without
      // depending on live content — same spirit as this file's other
      // fixtures, which use synthetic ids rather than reading real entities.
      const nodes = [
        ...Array.from({ length: 16 }, (_, i) => ({ id: `instrument-${i}`, type: i % 2 === 0 ? 'identifier' : 'repository' })),
        ...Array.from({ length: 8 }, (_, i) => ({ id: `agency-${i}`, type: 'agency' })),
        ...Array.from({ length: 3 }, (_, i) => ({ id: `standard-${i}`, type: 'standard' })),
      ];
      const edges = Array.from({ length: 8 }, (_, i) => ({ from: `agency-${i}`, to: `instrument-${i % 16}`, predicate: 'operated-by' }));
      const positions = computeLayout(nodes, edges, DEFAULT_LAYOUT_OPTIONS);
      assertNoOverlaps(positions);
    });

    // Regression test for the follow-up report: "no overlap" (strictly true
    // even at the old rowSpacing 85 / colSpacing 190, a 5px/14px gap) still
    // read as "touching" to the user. This asserts a REAL minimum visible
    // gap, not just an absence of overlap — the actual complaint.
    it('leaves a real minimum gap (not just zero overlap) between adjacent boxes in the same row and between adjacent rows', () => {
      const MIN_REAL_GAP = 12; // px at 1.0 zoom — matches the report's own bar
      expect(DEFAULT_LAYOUT_OPTIONS.rowSpacing - BOX_HEIGHT).toBeGreaterThanOrEqual(MIN_REAL_GAP);
      expect(DEFAULT_LAYOUT_OPTIONS.colSpacing - BOX_WIDTH).toBeGreaterThanOrEqual(MIN_REAL_GAP);
    });
  });
});

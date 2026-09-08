// Abstraction-tier + topological-depth ranking for `/map2`'s hierarchical
// layout (Opus evaluation report §A7/§B3 — the layer-band grouping answers
// "which of 5 taxonomy layers do you belong to", not the axis the user
// actually asked for: "concepts, institutions to instruments, top to
// bottom"). Pure and deterministic (rule A1) — no Cytoscape/DOM dependency,
// so it's unit-testable against the real corpus's own edges independent of
// rendering.
//
// Two factors, combined:
//  - `tier`: a coarse 4-level grouping derived from `type` (T4 principles/
//    declarations at the very top, T3 protocols/specs/schemas just below,
//    T2 who-governs-it in the middle, T1 concrete instruments at the
//    bottom) — this alone gives the "concepts to instruments" shape the
//    layer-band model doesn't.
//  - `depth`: a fine within/across-tier longest-path rank over a directed
//    "is above" relation derived from each predicate's real-world meaning
//    (e.g. DataCite `operated-by` DOI's registration agency sits above DOI;
//    DOI `depends-on` Handle System sits above Handle System) — this is what
//    correctly places DataCite/Crossref above DOI and the DataCite Metadata
//    Schema right next to it, using edges the corpus already has.
//
// T3/T4 split (added after the initial 3-tier version): `type: standard`
// alone conflated FAIR ("standardKind: principles") with OAI-PMH
// ("standardKind: protocol") in one tier/row — a real Opus-evaluation-report
// finding (§A2), not a taste call: the subtype field already existed and was
// already correctly populated on all 18 real `standard` entities in the
// corpus (verified against src/content/entities/*.yaml before writing this),
// the tier function just never read it. Same split applies to `coalition`
// via `coalitionKind` (`declaration` reads as principles-level; the other
// three kinds — reform-movement/funding-initiative/network — are actors that
// belong with the institutions tier, not the documents tier).
export type Tier = 4 | 3 | 2 | 1;

/** T4 (top) = principles/declarations; T3 = protocols/schemas/specs/criteria/
 *  frameworks; T2 (middle) = who governs/runs things; T1 (bottom) = concrete
 *  instruments people actually touch. Unknown types default to T1 rather
 *  than throwing — this module must degrade gracefully against test
 *  fixtures that don't enumerate every real type. */
const TIER_BY_TYPE: Record<string, Tier> = {
  policy: 4,
  coalition: 3, // overridden per-entity by COALITION_KIND_TIER below
  standard: 3, // overridden per-entity by STANDARD_KIND_TIER below
  community: 2,
  organization: 2,
  agency: 2,
  identifier: 1,
  index: 1,
  repository: 1,
  cris: 1,
  aggregator: 1,
  'publishing-platform': 1,
};

/** `standardKind` -> tier override, consulted before `TIER_BY_TYPE`. An
 *  unrecognised or missing `standardKind` on a `type: standard` entity falls
 *  back to T3 (never silently to T1 via the generic `?? 1` — a standard
 *  without a subtype is still a standard, not an instrument). */
const STANDARD_KIND_TIER: Record<string, Tier> = {
  principles: 4,
  'governance-criteria': 4,
  protocol: 3,
  'metadata-schema': 3,
  serialisation: 3,
  'certification-criteria': 3,
  framework: 3,
};

/** `coalitionKind` -> tier override, same precedence rule. Missing/unknown
 *  falls back to T2 (an unclassified coalition reads as an actor/institution
 *  by default, not a document). */
const COALITION_KIND_TIER: Record<string, Tier> = {
  declaration: 4,
  'reform-movement': 2,
  'funding-initiative': 2,
  network: 2,
};

export function computeTier(type: string, subtype?: string): Tier {
  if (type === 'standard') return (subtype ? STANDARD_KIND_TIER[subtype] : undefined) ?? 3;
  if (type === 'coalition') return (subtype ? COALITION_KIND_TIER[subtype] : undefined) ?? 2;
  return TIER_BY_TYPE[type] ?? 1;
}

type Orientation = 'source-higher' | 'target-higher' | 'lateral';

/** Per-predicate orientation: which endpoint reads as "above" the other.
 *  `lateral` predicates (interoperates-with, supersedes) connect peers, not
 *  a hierarchy, and are excluded from ranking entirely. */
export const ORIENTATION: Record<string, Orientation> = {
  issues: 'source-higher',
  'depends-on': 'source-higher',
  indexes: 'source-higher',
  mandates: 'source-higher',
  'applies-to': 'source-higher',
  implements: 'target-higher',
  'complies-with': 'target-higher',
  'owned-by': 'target-higher',
  'governed-by': 'target-higher',
  'operated-by': 'target-higher',
  'developed-by': 'target-higher',
  'funded-by': 'target-higher',
  'member-of': 'target-higher',
  'part-of': 'target-higher',
  'profile-of': 'target-higher',
  'certified-by': 'target-higher',
  'endorsed-by': 'target-higher',
  'interoperates-with': 'lateral',
  supersedes: 'lateral',
};

export interface RankInput {
  id: string;
  type: string;
  subtype?: string;
  /** T1 ("instrumentos y sistemas") row-cohesion is split by this instead of
   *  by bare `type` alone — see `groupKey` below. Optional so existing test
   *  fixtures that don't set it keep working (falls back to a shared bucket,
   *  i.e. behaves like the old type-only grouping for that tier). */
  governance?: string;
  /** T2 ("instituciones y agencias") row-cohesion is split by the `region:*`
   *  tag instead of by bare `type` alone — see `groupKey` below. */
  tags?: readonly string[];
}
export interface RankEdge {
  from: string;
  to: string;
  predicate: string;
}
export interface Rank {
  tier: Tier;
  depth: number;
  /** tier * 100 + depth — bigger means "higher up" the hierarchy. Rendering
   *  code turns this into a screen y-position; kept as a plain composite
   *  number here so this module stays agnostic of pixels/orientation. */
  composite: number;
}

/**
 * Longest-path depth over the "is above" relation implied by each edge's
 * predicate, layered within/across the 3 coarse tiers.
 *
 * Cycle handling: a pair can end up with edges implying both directions at
 * once (e.g. one entity `depends-on` another — source-higher — while a
 * *different* edge on the same unordered pair is `operated-by` — target-
 * higher; this happens once in the full corpus, `datacite`<->`re3data`).
 * Per the evaluation report's explicit rule, a target-higher predicate wins
 * over a source-higher one on a conflicting pair (a real governance fact
 * — "who operates this" — outranks a looser "depends on" for the purpose of
 * *this* diagram's vertical position). Any cycle that still remains after
 * that (there shouldn't be one in real content, but test fixtures can
 * construct one) is broken generically by dropping the last edge that would
 * close it, so this function never throws or infinite-loops on bad input.
 */
export function computeRanks(nodes: readonly RankInput[], edges: readonly RankEdge[]): Map<string, Rank> {
  const typeById = new Map(nodes.map((n) => [n.id, n.type]));
  const subtypeById = new Map(nodes.map((n) => [n.id, n.subtype]));
  const governanceById = new Map(nodes.map((n) => [n.id, n.governance]));
  const tagsById = new Map(nodes.map((n) => [n.id, n.tags]));
  const ids = nodes.map((n) => n.id);
  /** First `region:*` tag on an entity, or `'global'` when none is set
   *  (matches the vocab's own `region:global` default meaning). */
  const regionOf = (id: string): string => {
    const tag = (tagsById.get(id) ?? []).find((t) => t.startsWith('region:'));
    return tag ? tag.slice('region:'.length) : 'global';
  };

  // "above" edge: above -> below (above is higher up).
  type AboveEdge = { above: string; below: string; sourceHigher: boolean };
  const rawAbove: AboveEdge[] = [];
  for (const e of edges) {
    const orientation = ORIENTATION[e.predicate];
    if (!orientation || orientation === 'lateral') continue;
    if (!typeById.has(e.from) || !typeById.has(e.to)) continue;
    if (orientation === 'source-higher') rawAbove.push({ above: e.from, below: e.to, sourceHigher: true });
    else rawAbove.push({ above: e.to, below: e.from, sourceHigher: false });
  }

  // Conflict resolution: for any unordered pair with edges implying both
  // directions, keep only the target-higher-derived ("operated-by wins")
  // edges for that pair.
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const directionsByPair = new Map<string, Set<string>>(); // pairKey -> set of "above" ids seen
  for (const e of rawAbove) {
    const key = pairKey(e.above, e.below);
    const set = directionsByPair.get(key) ?? new Set<string>();
    set.add(e.above);
    directionsByPair.set(key, set);
  }
  const conflictingPairs = new Set([...directionsByPair.entries()].filter(([, set]) => set.size > 1).map(([key]) => key));
  const resolvedAbove = rawAbove.filter((e) => {
    const key = pairKey(e.above, e.below);
    if (!conflictingPairs.has(key)) return true;
    return !e.sourceHigher; // drop the source-higher edge on a conflicting pair
  });

  // Deduplicate (above,below) pairs (multiple predicates can agree).
  const seen = new Set<string>();
  const aboveEdges: { above: string; below: string }[] = [];
  for (const e of resolvedAbove) {
    const key = `${e.above}->${e.below}`;
    if (seen.has(key)) continue;
    seen.add(key);
    aboveEdges.push({ above: e.above, below: e.below });
  }

  // Longest-path depth via Kahn's algorithm over "below -> above" (an edge
  // in this direction means: process `below` before `above`). Any residual
  // cycle (shouldn't occur in real content after the conflict rule above,
  // but must never hang on adversarial test input) is broken by dropping
  // edges that don't fit into topological order once no zero-in-degree
  // node remains.
  const outFromBelow = new Map<string, string[]>(); // below -> [above,...]
  const inDegree = new Map<string, number>();
  for (const id of ids) inDegree.set(id, 0);
  for (const e of aboveEdges) {
    if (!outFromBelow.has(e.below)) outFromBelow.set(e.below, []);
    outFromBelow.get(e.below)!.push(e.above);
    inDegree.set(e.above, (inDegree.get(e.above) ?? 0) + 1);
  }

  const depth = new Map<string, number>();
  for (const id of ids) depth.set(id, 0);
  const queue: string[] = ids.filter((id) => (inDegree.get(id) ?? 0) === 0);
  const processed = new Set<string>();
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (processed.has(node)) continue;
    processed.add(node);
    for (const above of outFromBelow.get(node) ?? []) {
      const candidate = (depth.get(node) ?? 0) + 1;
      if (candidate > (depth.get(above) ?? 0)) depth.set(above, candidate);
      const remaining = (inDegree.get(above) ?? 0) - 1;
      inDegree.set(above, remaining);
      if (remaining <= 0 && !processed.has(above)) queue.push(above);
    }
  }
  // Anything left unprocessed is part of a residual cycle — leave its depth
  // at whatever it last reached rather than looping forever.

  // Same-type row cohesion (user: "we should probably order cards by
  // color... same color remain together, in the same row" — reaffirmed
  // 2026-09-07 after a prior attempt kept genuinely-connected same-type
  // pairs like DOI/Handle System split at their real graph depths: "DOI,
  // handle, orcid ID, ROR: are not in the same row, and are all
  // identifiers; why????" — explicit, unconditional: same type, same row,
  // full stop, no exception for an internal edge between two members).
  // `depth` above is a pure graph longest-path metric with zero awareness
  // of `type` — two nodes of the same type (hence same tier) land on
  // different rows whenever they happen to sit at different distances from
  // an unrelated depth-0 anchor, OR because a real edge connects them
  // directly (e.g. DOI `depends-on` Handle System). Snap every member of a
  // same-(tier,type) group onto that group's most common depth, always,
  // with no carve-out — the vertical hierarchy is still fully visible via
  // depth differences BETWEEN types/tiers; forcing it within one type too
  // is not something this diagram needs to also show, per direct user
  // instruction.
  // T1 ("instrumentos y sistemas", 49 entities) and T2 ("instituciones y
  // agencias", 66 entities) were each collapsing into one dense row per
  // `type` — legible for the smaller groups but visually concentrated for
  // these two. Split them one dimension further, on data that already
  // exists and already varies meaningfully within each (2026-09-08):
  //  - T1 by `governance` (commercial/nonprofit/community/academic/...) —
  //    `subtype` doesn't help here (null on `identifier`/`repository`).
  //  - T2 by the entity's `region:*` tag — same-type orgs cluster by where
  //    they're actually headquartered instead of all sharing one row.
  // Other tiers keep the original type-only key unchanged.
  const groupKey = (id: string) => {
    const type = typeById.get(id) ?? '';
    const tier = computeTier(type, subtypeById.get(id));
    if (tier === 1) return `${tier}|${type}|${governanceById.get(id) ?? ''}`;
    if (tier === 2) return `${tier}|${type}|${regionOf(id)}`;
    return `${tier}|${type}`;
  };
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const key = groupKey(id);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(id);
  }
  for (const [, memberIds] of groups) {
    if (memberIds.length < 2) continue;
    const counts = new Map<number, number>();
    for (const id of memberIds) {
      const d = depth.get(id) ?? 0;
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    let modeDepth = depth.get(memberIds[0]!) ?? 0;
    let modeCount = -1;
    for (const [d, count] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
      if (count > modeCount) {
        modeCount = count;
        modeDepth = d;
      }
    }
    for (const id of memberIds) depth.set(id, modeDepth);
  }

  const ranks = new Map<string, Rank>();
  for (const id of ids) {
    const tier = computeTier(typeById.get(id) ?? '', subtypeById.get(id));
    const d = depth.get(id) ?? 0;
    ranks.set(id, { tier, depth: d, composite: tier * 100 + d });
  }
  return ranks;
}

/**
 * Production spacing for `/map2`'s hierarchical preset layout. Single source
 * of truth shared by the renderer (`MapExplorerV2.astro`) and this module's
 * own tests, so the two can never drift apart the way the renderer's
 * previously-inline `ROW_SPACING = 70` did: that value was smaller than the
 * class box's actual rendered height (a constant 80px — `classBoxFields`
 * always returns exactly 2 rows, so `classBoxHeight(2)` from `node-svg.ts` is
 * fixed for every node), so every row's boxes overlapped the next row's by
 * ~10px regardless of node count. `rowSpacing` here is 80 + a real gutter.
 */
export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  // Retuned again 2026-09-07 (user: "nodes should not touch between them; we
  // can have more space"). The previous pass (below, kept for history) chose
  // a bare-minimum gutter (85/190/20) specifically to chase a higher
  // fit-to-viewport zoom — but that reasoning assumed the RENDERER must
  // always show the whole graph at once ("fit" semantics). It no longer
  // does: `MapExplorerV2.astro`'s initial view now floors at a fixed
  // `MIN_DEFAULT_ZOOM` (see its own comment) instead of shrinking to
  // whatever a naive `cy.fit()` produces, so panning — not a smaller-still
  // gutter — is how the rest of a dense layout gets seen. That frees this
  // module to size for genuine legibility instead of fighting the fit-zoom
  // trade-off documented below.
  //
  // Previous pass's finding, still true and still relevant to why this
  // module can't just keep growing gaps forever: 13 rows of an 80px-tall box
  // do not fit above the class-box LOD threshold in this canvas's real
  // available height at ANY spacing that also leaves a visible gutter — so
  // "make the default view legible" is the renderer's job (a zoom floor),
  // not this module's (it only ever controls the layout's own scale, not
  // what fraction of it the initial viewport shows).
  //
  // rowSpacing 85->114 (a real 34px gutter over the 80px box height, up from
  // 5px), colSpacing 190->220 (a real 44px gutter over the 176px box width,
  // up from 14px), tierGap 20->32 (keeps the tier bands visibly separated at
  // the new row spacing rather than reading as one continuous gap). See the
  // overlap test in hierarchy.test.ts for the exact minimum-gap assertion.
  rowSpacing: 114,
  colSpacing: 220,
  tierGap: 32,
  // Measured against the real curated corpus (13 distinct tier/depth rows,
  // widest rank 5, i.e. no rank exceeds this cap in the current corpus so
  // wrapping never actually triggers today): raising this further wouldn't
  // change anything (nothing is wrapped to unwrap), and this cap still
  // exists for whatever new entity eventually does form a >5-wide rank.
  maxPerRow: 5,
};

export interface LayoutOptions {
  /** px between adjacent rank rows within the same tier (also used between
   *  wrapped sub-rows of an over-wide rank — see `maxPerRow`). */
  rowSpacing: number;
  /** px between class boxes within a row. */
  colSpacing: number;
  /** extra px inserted between the last row of one tier and the first row
   *  of the next, on top of `rowSpacing` — keeps the 3 tiers visually
   *  distinct as bands even though row height itself is compact. */
  tierGap: number;
  /** max class boxes drawn side-by-side before a rank wraps into an
   *  additional sub-row stacked directly below it. Without this, one
   *  crowded rank (e.g. many T1 instruments sharing a depth) sets the
   *  layout's overall width and drags the initial fit-to-viewport zoom
   *  down for every other, much narrower, row. */
  maxPerRow: number;
}
export interface Position {
  x: number;
  y: number;
}

/**
 * Full (x, y) layout for a preset Cytoscape layout: combines `computeRanks`
 * + `computeXSlots` into pixel positions.
 *
 * Two corrections over a naive "y = -composite * rowSpacing" mapping:
 *
 * 1. Rows are ranked by their DENSE sorted position among the distinct
 *    `composite` values actually present, not by the raw `composite` number.
 *    `composite` (`tier*100+depth`) is designed only as an ordering key
 *    (bigger sorts higher); using it directly as a row multiplier bakes in
 *    gaps of up to 99 empty "rows" between tiers (e.g. a lone T1 row at
 *    composite 101 and a T2 row at composite 201 are 100 apart even though
 *    nothing occupies rows 102-200) — a ~20x layout bloat on a typical
 *    curated set. An explicit, modest `tierGap` is inserted at real tier
 *    boundaries instead of an accidental one implied by `composite`'s scale.
 *
 * 2. A rank with more than `maxPerRow` nodes wraps into extra sub-rows
 *    (still the same tier/depth — this doesn't change the computed
 *    hierarchy, only how one crowded rank is laid out spatially) so a single
 *    wide rank can't force every other, narrower rank to sit in a
 *    letterboxed sliver of the viewport once the whole graph is fit to it.
 */
export function computeLayout(nodes: readonly RankInput[], edges: readonly RankEdge[], options: LayoutOptions): Map<string, Position> {
  const ranks = computeRanks(nodes, edges);
  const xSlots = computeXSlots(nodes, edges, ranks);
  const typeById = new Map(nodes.map((n) => [n.id, n.type]));
  const maxPerRow = Math.max(1, options.maxPerRow);

  const idsByComposite = new Map<number, string[]>();
  for (const n of nodes) {
    const composite = ranks.get(n.id)?.composite ?? 0;
    if (!idsByComposite.has(composite)) idsByComposite.set(composite, []);
    idsByComposite.get(composite)!.push(n.id);
  }
  for (const ids of idsByComposite.values()) {
    ids.sort((a, b) => (xSlots.get(a) ?? 0) - (xSlots.get(b) ?? 0));
  }

  // Lowest composite first: it starts at y=0 and gets progressively more
  // negative as composite rises, so the HIGHEST composite ends up with the
  // most-negative y — i.e. highest up on screen, matching the "smaller y is
  // higher up" convention used everywhere else in this renderer. (Sorting
  // descending here, processing highest-first, was the exact regression
  // this comment now guards against: it put the lowest composite at the
  // most-negative y instead, inverting the whole hierarchy on screen.)
  const composites = [...idsByComposite.keys()].sort((a, b) => a - b);
  const positions = new Map<string, Position>();
  let y = 0;
  let prevTier: number | null = null;
  for (const composite of composites) {
    const tier = Math.floor(composite / 100);
    if (prevTier !== null && tier !== prevTier) y -= options.tierGap;

    const ids = idsByComposite.get(composite)!;

    // Greedily pack into sub-rows WITHOUT ever splitting a contiguous
    // same-type run: `ids` is already sorted by xSlot, which guarantees each
    // type forms one contiguous run within it (computeXSlots's whole point —
    // user: "order cards by color, same color remain together"). A naive
    // fixed-size slice every `maxPerRow` nodes — the previous behaviour —
    // cuts through a run at an arbitrary position whenever a composite's
    // total member count (summed across every type sharing that row) exceeds
    // maxPerRow, undoing the grouping the moment a row gets crowded (the
    // exact case that was still visibly scattering `index`/`repository`
    // after the depth-collapse fix above: e.g. cris(1)+identifier(3)+
    // index(4)+repository(2) = 10 members at one composite, wrapped at a
    // blind count of 5, chopped straight through both the index and
    // repository blocks). A run itself longer than maxPerRow is left intact
    // in its own sub-row rather than split (graceful overflow, same spirit
    // as the rest of this function).
    const runs: string[][] = [];
    for (const id of ids) {
      const type = typeById.get(id);
      const last = runs[runs.length - 1];
      if (last && typeById.get(last[0]!) === type) last.push(id);
      else runs.push([id]);
    }
    const subRows: string[][] = [];
    let current: string[] = [];
    for (const run of runs) {
      if (run.length > maxPerRow) {
        // A single type's own run outgrows one full row — unavoidable to
        // split, but it splits only against ITSELF (consecutive full-width
        // sub-rows of the same type), never at an arbitrary boundary mixed
        // with a different, unrelated type.
        if (current.length > 0) {
          subRows.push(current);
          current = [];
        }
        for (let i = 0; i < run.length; i += maxPerRow) subRows.push(run.slice(i, i + maxPerRow));
        continue;
      }
      if (current.length + run.length > maxPerRow) {
        subRows.push(current);
        current = [];
      }
      current.push(...run);
    }
    if (current.length > 0) subRows.push(current);

    subRows.forEach((chunk, sub) => {
      const rowWidth = chunk.length * options.colSpacing;
      chunk.forEach((id, i) => {
        const x = i * options.colSpacing - rowWidth / 2;
        positions.set(id, { x, y: y - sub * options.rowSpacing });
      });
    });
    y -= subRows.length * options.rowSpacing;
    prevTier = tier;
  }
  return positions;
}

/**
 * Deterministic x-position assignment within each composite-rank "row".
 *
 * Two-level ordering (user: "order cards by color [i.e. by `type`, which
 * determines a node's fill], same color remain together... then by
 * sub-type or other" — explicit priority over crossing-minimisation for
 * this task):
 *
 * 1. PRIMARY key: `type` — nodes of the same type (same canvas colour) are
 *    grouped into a contiguous block within the row. Blocks themselves are
 *    ordered by their barycentre (the mean x of each block's own members'
 *    already-placed neighbours, from rows below) so related blocks still
 *    tend to line up across rows — the crossing-reduction the old pure-
 *    barycentre sweep provided doesn't disappear, it just now operates at
 *    the block level instead of the individual-node level.
 * 2. SECONDARY key, within a type-block: `subtype` (alphabetical; nodes
 *    with no subtype sort after those with one), then `id` as a final
 *    stable tiebreak.
 *
 * Falls back to alphabetical id order for a block with no already-placed
 * neighbours (mirrors the previous function's own fallback). Returns a
 * 0-based slot index per node within its row — the renderer decides actual
 * pixel spacing.
 */
export function computeXSlots(nodes: readonly RankInput[], edges: readonly RankEdge[], ranks: Map<string, Rank>): Map<string, number> {
  const typeById = new Map(nodes.map((n) => [n.id, n.type]));
  const subtypeById = new Map(nodes.map((n) => [n.id, n.subtype]));
  const rows = new Map<number, string[]>();
  for (const n of nodes) {
    const composite = ranks.get(n.id)?.composite ?? 0;
    if (!rows.has(composite)) rows.set(composite, []);
    rows.get(composite)!.push(n.id);
  }
  const neighborsOf = new Map<string, string[]>();
  for (const e of edges) {
    (neighborsOf.get(e.from) ?? neighborsOf.set(e.from, []).get(e.from)!).push(e.to);
    (neighborsOf.get(e.to) ?? neighborsOf.set(e.to, []).get(e.to)!).push(e.from);
  }

  const x = new Map<string, number>();
  const orderedComposites = [...rows.keys()].sort((a, b) => a - b); // bottom (lowest composite) first
  for (const composite of orderedComposites) {
    const rowIds = rows.get(composite)!;

    // Group by type, preserving each id's own barycentre for the
    // within-block secondary sort's tiebreak-free path (a block sorted only
    // by subtype/id doesn't need per-node barycentre, but computing it once
    // here keeps the block-level barycentre derivation simple below).
    const blocks = new Map<string, string[]>();
    for (const id of rowIds) {
      const type = typeById.get(id) ?? '';
      if (!blocks.has(type)) blocks.set(type, []);
      blocks.get(type)!.push(id);
    }

    const barycentreOf = (id: string): number | null => {
      const placedNeighborXs = (neighborsOf.get(id) ?? []).map((nb) => x.get(nb)).filter((v): v is number => v !== undefined);
      return placedNeighborXs.length > 0 ? placedNeighborXs.reduce((a, b) => a + b, 0) / placedNeighborXs.length : null;
    };

    const scoredBlocks = [...blocks.entries()].map(([type, ids]) => {
      const barycentres = ids.map(barycentreOf).filter((v): v is number => v !== null);
      const blockBarycentre = barycentres.length > 0 ? barycentres.reduce((a, b) => a + b, 0) / barycentres.length : null;
      return { type, ids, blockBarycentre };
    });
    scoredBlocks.sort((a, b) => {
      if (a.blockBarycentre !== null && b.blockBarycentre !== null && a.blockBarycentre !== b.blockBarycentre) {
        return a.blockBarycentre - b.blockBarycentre;
      }
      if (a.blockBarycentre !== null && b.blockBarycentre === null) return -1;
      if (a.blockBarycentre === null && b.blockBarycentre !== null) return 1;
      return a.type.localeCompare(b.type);
    });

    let slot = 0;
    for (const block of scoredBlocks) {
      const sortedIds = [...block.ids].sort((a, b) => {
        const subA = subtypeById.get(a) ?? '';
        const subB = subtypeById.get(b) ?? '';
        if (subA !== subB) return subA.localeCompare(subB);
        return a.localeCompare(b);
      });
      for (const id of sortedIds) x.set(id, slot++);
    }
  }
  return x;
}

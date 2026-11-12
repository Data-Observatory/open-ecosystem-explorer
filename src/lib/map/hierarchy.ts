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

/** First `region:*` tag on an entity, or `'global'` when none is set
 *  (matches the vocab's own `region:global` default meaning). Exported so
 *  rendering code (the tier-2 sub-band grouping) derives the exact same
 *  bucket key as the layout's own row-separation logic below. */
export function regionOf(tags: readonly string[] | undefined): string {
  const tag = (tags ?? []).find((t) => t.startsWith('region:'));
  return tag ? tag.slice('region:'.length) : 'global';
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
  //
  // `type` is deliberately NOT part of the T1/T2 key (a follow-up correction
  // — the first version keyed on `${tier}|${type}|${governance/region}`,
  // which computed cohesion+separation independently per type). That version
  // shipped a real visual bug once `MapExplorerV2.astro` started rendering an
  // actual nested compound box per governance/region bucket (2026-09-08,
  // same day): two DIFFERENT (type, governance) cohesion groups — e.g.
  // `identifier|nonprofit` and `cris|commercial` — were never de-duplicated
  // against EACH OTHER (the separation pass below only compared buckets of
  // the SAME type), so they could and did land on the same depth, and their
  // two nested boxes rendered visually overlapping/crossing on screen.
  // Dropping `type` from the key merges every same-governance (T1) /
  // same-region (T2) entity into ONE cohesion group regardless of type —
  // correct, since one nested box is meant to hold exactly one governance/
  // region value's entities, whatever type they are — and the separation
  // pass below now runs tier-wide for T1/T2, so no two distinct governance
  // values (or region values) can ever share a row. Type-level visual
  // clustering within a shared row/box still happens, just one level down,
  // in `computeXSlots`' own type-first x-ordering — unaffected by this key.
  const groupKey = (id: string) => {
    const type = typeById.get(id) ?? '';
    const tier = computeTier(type, subtypeById.get(id));
    if (tier === 1) return `${tier}|${governanceById.get(id) ?? ''}`;
    if (tier === 2) return `${tier}|${regionOf(tagsById.get(id))}`;
    return `${tier}|${type}`;
  };
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const key = groupKey(id);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(id);
  }

  // Each group's own natural depth: the mode (most common) real depth among
  // its members when there's more than one, or that one member's own depth
  // otherwise. This is cohesion — everyone in ONE (type, governance/region)
  // bucket agrees on a row — but it is NOT separation: two different buckets
  // of the SAME type can independently compute the same mode (e.g. both
  // happen to sit at depth 0, which is common — most T1/T2 members have no
  // "above" edge at all). Verified empirically against the real corpus right
  // after shipping the groupKey split above: e.g. every `organization`
  // subgroup (europe/north-america/latam/global) landed on depth 1 —
  // identical rows, i.e. no visible split at all. Cohesion alone was never
  // going to produce the split; a second, explicit de-duplication pass is
  // required.
  const groupModeDepth = new Map<string, number>();
  for (const [key, memberIds] of groups) {
    if (memberIds.length < 2) {
      groupModeDepth.set(key, depth.get(memberIds[0]!) ?? 0);
      continue;
    }
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
    groupModeDepth.set(key, modeDepth);
  }

  // Separation: no two buckets sharing a de-dup SCOPE may keep the same
  // depth. Process buckets lowest-natural-depth-first (ties broken by key,
  // for determinism) and bump each one forward past whatever depths its
  // scope-siblings already claimed. A bucket that never collides keeps its
  // natural depth untouched.
  //
  // The scope differs by tier, and this is the part that matters: for T1/T2
  // the scope is the WHOLE TIER — every governance (T1) / region (T2) bucket
  // must be exclusive of every other one, full stop, because each bucket
  // becomes one real nested compound box in `MapExplorerV2.astro` and two
  // boxes sharing a row means two boxes visually overlapping on screen. For
  // T3/T4 the scope is `tier|type` (unchanged from before governance/region
  // grouping existed) — but since T3/T4's `groupKey` above has no further
  // split dimension, each such scope already contains exactly one bucket, so
  // this is inherently a no-op there: two different T3/T4 types sharing a
  // row remains normal (a row already concatenates multiple types' runs side
  // by side, see `computeXSlots`), exactly as before this feature existed.
  const dedupScopeOf = (key: string): string => {
    const [tier] = key.split('|');
    return tier === '1' || tier === '2' ? tier! : key;
  };
  const keysByScope = new Map<string, string[]>();
  for (const key of groups.keys()) {
    const scope = dedupScopeOf(key);
    if (!keysByScope.has(scope)) keysByScope.set(scope, []);
    keysByScope.get(scope)!.push(key);
  }
  const finalGroupDepth = new Map<string, number>();
  for (const keys of keysByScope.values()) {
    const sorted = [...keys].sort((a, b) => {
      const da = groupModeDepth.get(a)!;
      const db = groupModeDepth.get(b)!;
      return da !== db ? da - db : a.localeCompare(b);
    });
    const used = new Set<number>();
    for (const key of sorted) {
      let d = groupModeDepth.get(key)!;
      while (used.has(d)) d++;
      used.add(d);
      finalGroupDepth.set(key, d);
    }
  }

  for (const [key, memberIds] of groups) {
    const d = finalGroupDepth.get(key)!;
    for (const id of memberIds) depth.set(id, d);
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
  // (2026-09-08: briefly tripled these in lockstep with a Card-size
  // tripling, then reverted both — the "triple the box text" ask was about
  // the grey Tier/Cluster band labels, not these per-Card gutters. Back to
  // the 2026-09-07 values.)
  rowSpacing: 114,
  colSpacing: 220,
  // 32->16 (2026-09-09 follow-up, same "closer, way closer" ask): with
  // labels now living INSIDE each box's own padding (see `LABEL_CLEARANCE`'s
  // comment) rather than floating outside it, the padded border itself
  // already reads as a clear band separator — this no longer needs to carry
  // as much of that job on its own.
  tierGap: 16,
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
/** Unified label font-size for BOTH Tier and Cluster compound-node labels
 *  (2026-09-09 follow-up, explicit ask: "both with the same text size").
 *  Previously 36 (Tier) / 45 (Cluster) — two different sizes with no
 *  functional reason once both labels render the same way (inside the
 *  border, not floating outside it). */
export const LABEL_FONT_SIZE = 36;

/** A bold sans-serif label's rendered line box, in px — 1.15x its font-size
 *  is a conservative estimate (this module has no canvas/DOM to measure
 *  real glyph metrics). Shared by `LABEL_INSET_MARGIN` and `compoundPadding`
 *  below, both of which need it for the SAME reason: Cytoscape's actual
 *  label-positioning math for `text-valign: top` needs to know it. */
const LABEL_LINE_HEIGHT = Math.ceil(LABEL_FONT_SIZE * 1.15);

/** Positive `text-margin-y` (px) that pulls a compound-node label DOWN from
 *  its default above-the-border position into the box's own padded
 *  interior. Cytoscape positions a `text-valign: top` label the same way
 *  for a compound parent as for any regular node: the label's OWN BOTTOM
 *  edge anchors at (node top edge + `text-margin-y`) — a small positive
 *  number does NOT mean "inside by a little"; it means "the label's bottom
 *  is only a little below the border", which — since the label extends
 *  UPWARD from its bottom edge by its own full height — leaves most of a
 *  real ~40px-tall label still poking out ABOVE the border (verified via a
 *  real Playwright bounding-box check, 2026-09-09: a first pass here used a
 *  flat `10`, which measured a ~9-31px residual overlap depending on
 *  nesting depth — moving the label "inside" needs `text-margin-y` to
 *  cover the label's OWN height first, THEN a small extra inset, not just a
 *  token nudge). `INSET_GUTTER` is that small extra — the tiny visible gap
 *  between the label's own top and the border, once the label is actually
 *  pulled fully inside. Shared as one constant between `compoundPadding`
 *  below (which sizes each box's own padding to fit a label offset by
 *  exactly this much) and `MapExplorerV2.astro`'s stylesheet (which uses it
 *  directly as `text-margin-y`), so the two can never drift the way a
 *  hand-copied number could. */
export const LABEL_INSET_MARGIN = LABEL_LINE_HEIGHT + 6;

/** Bold-sans-serif average char-width estimate as a fraction of font-size —
 *  this module has no canvas/DOM to measure real glyph metrics, so this is a
 *  deliberately conservative (slightly wide) approximation, shared by every
 *  label-width estimate below so they can never drift against each other.
 *  Verified against real rendered Cytoscape label widths (2026-09-09,
 *  standalone Playwright harness measuring `node.renderedBoundingBox()`
 *  before/after `text-halign`): real widths measured ~0.46-0.54x font-size
 *  per char depending on the string (space-heavy strings run narrower) — 0.62
 *  overestimates on purpose, since the one place this feeds a *position*
 *  formula (`estimateLabelWidth` below, used for the Tier label's dynamic
 *  `text-margin-x`) fails safe in the overestimate direction: a too-large
 *  estimate merely leaves a slightly bigger gap between the label and the
 *  box's left border, while an underestimate would push the label back
 *  outside the border — the exact bug this exists to fix. */
const AVG_CHAR_WIDTH_RATIO = 0.62;

/** Estimated rendered width (px) of a label string at a given font-size —
 *  see `AVG_CHAR_WIDTH_RATIO`'s comment for why this over- rather than
 *  under-estimates. Exported so `MapExplorerV2.astro`'s stylesheet can use
 *  the SAME formula at render time (as a per-node `text-margin-x` function)
 *  that `MIN_TIER_CELL_WIDTH` below uses to size the box itself — one
 *  formula, not two hand-copied ones that could drift apart. */
export function estimateLabelWidth(label: string, fontSize: number): number {
  return Math.ceil(fontSize * AVG_CHAR_WIDTH_RATIO * label.length);
}

const TIER_BORDER_WIDTH = 2;
const CLUSTER_BORDER_WIDTH = 4;

/** Small fixed gutter (px) kept between a Tier label's own rendered edge and
 *  the box's border — used on BOTH axes: horizontally, added on top of the
 *  label's own estimated width so the label doesn't sit flush-touching the
 *  left border (see the `text-margin-x` formula in MapExplorerV2.astro);
 *  vertically (as `TIER_LABEL_OUTSET_GAP` below), the same idea for the gap
 *  between the label floating above the box and the box's own top border.
 *  One shared constant since both are "a little breathing room around the
 *  label", not two independently-tuned numbers. */
export const TIER_LABEL_GUTTER = 10;
/** Negated and used directly as `node.tier-band`'s `text-margin-y` — see
 *  `TIER_LABEL_GUTTER`'s comment. A NEGATIVE `text-margin-y` pushes a
 *  `text-valign: top` label's bottom edge further UP/away from the node's
 *  own top border (positive pulls it down/inside — see `LABEL_INSET_MARGIN`
 *  above, still used by Cluster, which keeps its label inside). 2026-09-09
 *  follow-up REVERSAL: the user's prior ask ("titles inside the border") was
 *  explicitly walked back for Tier specifically ("I want the title... above
 *  the box" — Cluster titles were separately confirmed fine and are
 *  untouched). Verified via a real Playwright bounding-box measurement
 *  (`renderedBoundingBox({includeLabels：false})` vs `{includeLabels:true}`
 *  on a standalone Cytoscape node) that `text-valign: 'top'` with
 *  `text-margin-y: 0` already anchors the label's bottom edge exactly AT the
 *  node's own top border, extending upward — this constant is only the
 *  small extra gap so the label doesn't touch the border. */
export const TIER_LABEL_OUTSET_GAP = TIER_LABEL_GUTTER;

/** A compound node's own CSS `padding` (Cytoscape's blank space between a
 *  compound box's border and its children's bounding box, applied
 *  uniformly on all 4 sides) — sized so a label positioned
 *  `text-valign: top` + `text-margin-y: LABEL_INSET_MARGIN` fits ENTIRELY
 *  inside that padded band instead of overlapping the first row of
 *  children beneath it (padding must be `>= LABEL_INSET_MARGIN` — the
 *  label's own bottom edge sits exactly `LABEL_INSET_MARGIN` below the
 *  border, per that constant's own comment — plus a small buffer for the
 *  border's own sliver and font-metric slack). This is the "automatic" part
 *  of the 2026-09-09 retune (user: "can we achieve this in an automatic
 *  way?"): the label's footprint now lives inside space the box already
 *  reserves for itself, instead of needing a separate, much larger,
 *  EXTERNAL gap between boxes (see `LABEL_CLEARANCE` below, and this
 *  module's own comment history for the old outside-the-box formula this
 *  replaces). Verified empirically (real Playwright bounding-box check
 *  against zero overlaps on both `/map` and `/map2`, at the actual default
 *  zoom), same as `LABEL_INSET_MARGIN` above — not assumed exact. */
function compoundPadding(borderWidth: number): number {
  const PADDING_BUFFER = 10;
  return LABEL_INSET_MARGIN + borderWidth + PADDING_BUFFER;
}
/** Tier band's own padding — imported directly by `MapExplorerV2.astro` as
 *  its `node.tier-band` style's `padding` (in px), so the CSS and this
 *  module's own gap math can never drift apart.
 *
 *  2026-09-09 follow-up REVERSAL (same round as `TIER_LABEL_OUTSET_GAP`
 *  above): Tier's label moved back OUTSIDE the box (floating above it), so
 *  this no longer needs `compoundPadding`'s label-sized interior band —
 *  that formula stays reserved for Cluster (`CLUSTER_PADDING` below), whose
 *  label is still confirmed-correct INSIDE the border. Tier's own padding is
 *  now just a small, label-independent gutter around its real content. */
export const TIER_PADDING = TIER_BORDER_WIDTH + TIER_LABEL_GUTTER;
/** Cluster (`.sub-band`) box's own padding — sized to fit its label INSIDE
 *  the border (unchanged this round — user confirmed Cluster titles are
 *  fine as they are). See `compoundPadding`'s own comment. */
export const CLUSTER_PADDING = compoundPadding(CLUSTER_BORDER_WIDTH);

/** Extra clearance (on top of the normal card gutters / `tierGap`) reserved
 *  BETWEEN adjacent Tier compound boxes. Applied between the 4 outer Tier
 *  bands only (stacked-in-column gap, and the gap between the two Tier
 *  columns) — see `CLUSTER_LABEL_CLEARANCE` below for the gap between
 *  nested Clusters within one Tier's grid.
 *
 *  Two components, both real (2026-09-09 follow-up — see
 *  `TIER_LABEL_OUTSET_GAP`'s comment for why this changed again the same
 *  round): Cytoscape auto-expands EACH compound box outward by its own
 *  `padding` on every side, on top of its children's bounding box, and
 *  `rowSpacing`/`tierGap` alone have no awareness of that — two adjacent
 *  boxes each independently expand toward each other by their own padding,
 *  so this covers both expansions (`2 * TIER_PADDING`). ON TOP of that, now
 *  that a Tier's label floats OUTSIDE/ABOVE its own box again (not inside —
 *  that's the reversal), the gap between two STACKED Tier boxes has to
 *  physically contain the LOWER box's own label (which pokes up into
 *  exactly that gap — the box stacked further up has nothing of its own
 *  poking into this particular gap; its label pokes into whatever's above
 *  IT instead): `TIER_LABEL_OUTSET_GAP` (small border-to-label gap) +
 *  `LABEL_LINE_HEIGHT` (the label's own rendered height) + a small fixed
 *  gutter so the label's own top doesn't kiss the box stacked above it.
 *  Verified via a real Playwright bounding-box overlap check on both the
 *  full `/map` corpus and the curated `/map2` subset (tests/e2e/map2.spec.ts's
 *  "no two rendered Tier/Cluster boxes overlap" tests) at the actual default
 *  zoom, on top of this module's own unit-level card-overlap tests. */
export const LABEL_CLEARANCE = TIER_PADDING * 2 + TIER_LABEL_OUTSET_GAP + LABEL_LINE_HEIGHT + 12;
/** Same reasoning as `LABEL_CLEARANCE`'s FIRST component only, for gaps
 *  between Cluster cells within a Tier's grid (T1/T2's governance/region
 *  tiling) — Cluster's label stays INSIDE its own border (unchanged), so
 *  there's no external label-height term to add here, unlike Tier's. */
export const CLUSTER_LABEL_CLEARANCE = CLUSTER_PADDING * 2 + 12;

/** Floor on a Cluster/Tier compound box's own declared WIDTH, independent of
 *  `LABEL_CLEARANCE`/`CLUSTER_LABEL_CLEARANCE` above (which only reserve
 *  space BETWEEN boxes). A box whose real CARD content is narrower than its
 *  own label's rendered TEXT WIDTH still auto-expands (Cytoscape's compound
 *  bounding box includes the label) — found empirically (2026-09-09): a
 *  small `T1` governance Cluster with few Cards but a long label ("Sin
 *  fines de lucro") rendered wider than its own declared card-derived
 *  width, encroaching on its neighbour even though the *gap* between them
 *  was, on paper, generous. Reserving this width up front (rather than
 *  growing the inter-box gap to compensate) is the tighter fix — it only
 *  widens a genuinely narrow box up to what its own label needs, instead of
 *  inflating the gap around EVERY box regardless of how much room its
 *  label actually needs.
 *  `AVG_CHAR_WIDTH_RATIO` is a conservative bold-sans-serif estimate (real
 *  glyph widths vary; this module has no canvas to measure them exactly);
 *  `maxLabelChars` is sized for the longest real label string in the
 *  current locale files (`MapExplorerV2.astro`'s governance/region/tier
 *  label dictionaries) plus headroom for a longer one later. `marginX` is
 *  the label's own `text-margin-x` — 0 for a centered Cluster label (no
 *  horizontal offset from center), `TIER_LABEL_GUTTER` for the left-aligned
 *  Tier label (see below — its real `text-margin-x` at render time is
 *  DYNAMIC, `estimateLabelWidth(label) + TIER_LABEL_GUTTER`, so this floor
 *  uses the same `estimateLabelWidth` — via the `fontSize * ratio *
 *  maxLabelChars` term below — plus that same fixed gutter, not a
 *  hand-copied number, so the two can never drift apart). Verified
 *  empirically, same as the clearances above — not assumed exact. */
function minLabelBoxWidth(fontSize: number, borderWidth: number, padding: number, maxLabelChars: number, marginX: number): number {
  return estimateLabelWidth('x'.repeat(maxLabelChars), fontSize) + marginX + borderWidth * 2 + padding * 2;
}
/** Cluster label vocab today: governance labels up to "Sin fines de lucro"/
 *  "Intergubernamental" (~19 chars), region labels shorter — 22 chars covers
 *  either with headroom. Cluster's label is centered (`text-halign: center`,
 *  `text-margin-x: 0` — see MapExplorerV2.astro), so `marginX` is 0. */
export const MIN_CLUSTER_CELL_WIDTH = minLabelBoxWidth(LABEL_FONT_SIZE, CLUSTER_BORDER_WIDTH, CLUSTER_PADDING, 22, 0);
/** Tier label vocab today: up to "Estándares y especificaciones" (30
 *  chars) — 32 covers it with headroom. Tier's label is left-aligned
 *  (`text-halign: left`) with a DYNAMIC `text-margin-x` (see
 *  `TIER_LABEL_GUTTER`'s comment and MapExplorerV2.astro's stylesheet) —
 *  `marginX` here is just that fixed gutter, since the length-dependent part
 *  is already the `maxLabelChars` term above. */
export const MIN_TIER_CELL_WIDTH = minLabelBoxWidth(LABEL_FONT_SIZE, TIER_BORDER_WIDTH, TIER_PADDING, 32, TIER_LABEL_GUTTER);
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

  /**
   * One composite's own internal footprint: same-type-run-preserving sub-row
   * wrap (unchanged from the pre-2026-09-08 single-column version — see the
   * long-standing rationale below), returned as positions RELATIVE to the
   * block's own origin (x centered on 0, local y=0 at the block's bottom
   * edge, growing more negative upward — same sign convention as the rest of
   * this module) instead of an absolute running y. This is what makes the
   * block reusable both for T3/T4's single-column stack (unchanged visual
   * result) and for T1/T2's new 2D Cluster grid below (each Cluster —
   * one governance/region bucket, i.e. one composite post-`computeRanks` — is
   * exactly one of these blocks, tiled instead of stacked).
   *
   * Greedily packs into sub-rows WITHOUT ever splitting a contiguous
   * same-type run: `ids` is already sorted by xSlot, which guarantees each
   * type forms one contiguous run within it (computeXSlots's whole point —
   * user: "order cards by color, same color remain together"). A naive
   * fixed-size slice every `maxPerRow` nodes cuts through a run at an
   * arbitrary position whenever a composite's total member count exceeds
   * maxPerRow, undoing the grouping the moment a row gets crowded. A run
   * itself longer than maxPerRow is left intact in its own sub-row rather
   * than split (graceful overflow, same spirit as the rest of this function).
   */
  function layoutComposite(ids: string[]): { width: number; height: number; rel: Map<string, Position> } {
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

    const rel = new Map<string, Position>();
    let width = 0;
    subRows.forEach((chunk, sub) => {
      const rowWidth = chunk.length * options.colSpacing;
      width = Math.max(width, rowWidth);
      chunk.forEach((id, i) => {
        const x = i * options.colSpacing - rowWidth / 2;
        rel.set(id, { x, y: -sub * options.rowSpacing });
      });
    });
    return { width, height: subRows.length * options.rowSpacing, rel };
  }

  const compositesByTier = new Map<number, number[]>();
  for (const composite of idsByComposite.keys()) {
    const tier = Math.floor(composite / 100);
    if (!compositesByTier.has(tier)) compositesByTier.set(tier, []);
    compositesByTier.get(tier)!.push(composite);
  }
  for (const list of compositesByTier.values()) list.sort((a, b) => a - b);

  // T1 ("instrumentos y sistemas") and T2 ("instituciones y agencias"): each
  // composite here is one governance/region Cluster (see `computeRanks`'s
  // groupKey), and — unlike T3/T4's composites — there is no remaining real
  // hierarchy signal BETWEEN Clusters of the same tier (the de-dup pass
  // exists purely to keep them apart, not to rank them). Forcing them into
  // one tall column was the exact complaint this redesign answers ("the grey
  // boxes can be side by side, not only top to bottom") — tile them into a
  // 2D grid instead. T3/T4 keep the original single-column stack: their
  // composites still encode a real depth relationship worth reading
  // top-to-bottom.
  const GRID_TIERS = new Set([1, 2]);
  const tierBox = new Map<number, { width: number; height: number }>();
  const tierRel = new Map<number, Map<string, Position>>();

  for (const [tier, composites] of compositesByTier) {
    const blocks = composites.map((c) => ({ ...layoutComposite(idsByComposite.get(c)!) }));
    const rel = new Map<string, Position>();

    if (GRID_TIERS.has(tier) && blocks.length > 1) {
      // Grid cells sized PER ROW/PER COLUMN (each row's height and each
      // column's width follow only the Clusters actually placed in that row/
      // column), not one uniform cell sized to the single widest/tallest
      // Cluster anywhere in the tier. Still reads as a clean grid (a fixed
      // `cols` count, row-major placement — no jagged bin-packing), but no
      // longer forces every small Cluster to sit inside a cell sized for the
      // tier's biggest one. This is the automatic half of the 2026-09-09
      // tight-spacing retune (user: "so when we add/remove cards, it works
      // well?") — a sparse Tier with a few small Clusters now gets a
      // correspondingly small grid instead of the same dead space a dense
      // Tier's biggest Cluster would have forced onto it.
      const cols = Math.max(1, Math.ceil(Math.sqrt(blocks.length)));
      const rows = Math.ceil(blocks.length / cols);
      // Both axes based on `rowSpacing`, NOT `colSpacing` for the horizontal
      // one (2026-09-09 follow-up, user: "too much empty space between them
      // [Clusters]... horizontally primary"). `colSpacing` (220) is tuned for
      // spacing CARDS apart WITHIN one row (`layoutComposite` above) — it has
      // nothing to do with the gap between two whole CLUSTER blocks in this
      // grid, but the horizontal gap here previously reused it anyway,
      // producing a real, measured asymmetry (356px horizontal vs. 250px
      // vertical at production spacing) with no visual justification: neither
      // axis of a Cluster-to-Cluster grid gap is "a row of cards", so both
      // should share the SAME, smaller base (`rowSpacing`) plus the same
      // `CLUSTER_LABEL_CLEARANCE` padding-expansion term. This only shrinks
      // the gap BETWEEN Clusters — `colSpacing` itself, and every per-card
      // gutter inside a Cluster, is untouched.
      const gapW = options.rowSpacing + CLUSTER_LABEL_CLEARANCE;
      const gapH = options.rowSpacing + CLUSTER_LABEL_CLEARANCE;
      const colWidths = new Array<number>(cols).fill(0);
      const rowHeights = new Array<number>(rows).fill(0);
      blocks.forEach((b, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        // Floored at `MIN_CLUSTER_CELL_WIDTH` — a Cluster narrower than its
        // own label's rendered text width still auto-expands to fit that
        // label (Cytoscape's compound bounding box includes it), so a
        // column sized purely from card content can be narrower than what
        // actually renders. See `MIN_CLUSTER_CELL_WIDTH`'s own comment.
        colWidths[col] = Math.max(colWidths[col]!, b.width, MIN_CLUSTER_CELL_WIDTH);
        rowHeights[row] = Math.max(rowHeights[row]!, b.height);
      });
      // Column centre-x positions: cumulative half-width + gap + half-width
      // (each block's own local x is already centred on 0 — see
      // `layoutComposite` — so `originX` below is each block's CENTRE, not a
      // cell's left edge).
      const colCenterX: number[] = [];
      {
        let cursor = 0;
        for (let c = 0; c < cols; c++) {
          cursor = c === 0 ? colWidths[0]! / 2 : cursor + colWidths[c - 1]! / 2 + gapW + colWidths[c]! / 2;
          colCenterX.push(cursor);
        }
      }
      // Row origin-y positions: cumulative bottom-edge accumulator, exactly
      // mirroring the single-column stacking branch below and
      // `layoutComposite`'s own "local y=0 is a block's bottom edge" contract
      // — just per-row instead of per-block.
      const rowOriginY: number[] = [];
      {
        let cursor = 0;
        for (let r = 0; r < rows; r++) {
          rowOriginY.push(cursor);
          cursor -= rowHeights[r]! + gapH;
        }
      }
      blocks.forEach((b, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const originX = colCenterX[col]!;
        const originY = rowOriginY[row]!;
        for (const [id, p] of b.rel) rel.set(id, { x: originX + p.x, y: originY + p.y });
      });
      // Grid spans from x=0 (column 0's own left edge, since colCenterX[0] is
      // exactly half its width in from 0) to the last column's right edge.
      // `2 * CLUSTER_PADDING` on each dimension accounts for the OUTERMOST
      // row/column's own Cluster boxes auto-expanding beyond this grid math
      // by their own `padding` (Cytoscape adds it around each Cluster's
      // children regardless of position in the grid) — `gapW`/`gapH` above
      // already cover that expansion BETWEEN adjacent cells (via
      // `CLUSTER_LABEL_CLEARANCE`), but nothing previously accounted for it
      // at the grid's own outer edges (top/bottom/left/right), since there's
      // no "next cell" there to have budgeted a gap against. Found via a
      // real Playwright overlap check (2026-09-09) once the old, much
      // larger `CLUSTER_LABEL_CLEARANCE` buffer stopped being generous
      // enough to mask this gap by accident.
      const totalWidth = colCenterX[cols - 1]! + colWidths[cols - 1]! / 2 + CLUSTER_PADDING * 2;
      const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0) + (rows - 1) * gapH + CLUSTER_PADDING * 2;
      // Shift so the grid is centered on 0 like a single block would be.
      for (const [id, p] of rel) rel.set(id, { x: p.x - totalWidth / 2, y: p.y });
      // Floored at the TIER's own label width too — a whole Tier's grid
      // could in principle still be narrower than its OWN outer label needs
      // (e.g. a tier with just one or two small Clusters), though in
      // practice `MIN_CLUSTER_CELL_WIDTH` above usually already exceeds it.
      tierBox.set(tier, { width: Math.max(totalWidth, MIN_TIER_CELL_WIDTH), height: totalHeight });
    } else {
      // Original single-column stacking: lowest composite first, starting
      // at local y=0 and growing more negative (upward) from there.
      let y = 0;
      let width = 0;
      for (const b of blocks) {
        for (const [id, p] of b.rel) rel.set(id, { x: p.x, y: y + p.y });
        y -= b.height;
        width = Math.max(width, b.width);
      }
      // T1/T2 with only a single Cluster still nest it in its own Cluster-
      // labelled compound box (see `MapExplorerV2.astro`'s `subBandKeyFor`
      // — sub-bands aren't conditional on there being more than one); T3/T4
      // have no Cluster nesting at all, only their own Tier label. Floor
      // against whichever one actually applies here. Same `2 * CLUSTER_PADDING`
      // reasoning as the grid branch above applies here too — this single
      // Cluster still auto-expands by its own padding, which nothing else in
      // this branch accounts for.
      const minWidth = GRID_TIERS.has(tier) ? MIN_CLUSTER_CELL_WIDTH : MIN_TIER_CELL_WIDTH;
      const clusterPad = GRID_TIERS.has(tier) ? CLUSTER_PADDING * 2 : 0;
      tierBox.set(tier, { width: Math.max(width + clusterPad, minWidth), height: -y + clusterPad });
    }
    tierRel.set(tier, rel);
  }

  // Two-column arrangement of the 4 Tiers themselves (user, after clarifying
  // "side by side" was approved at both the Tier and the Cluster level):
  // column A = {T1 at the bottom, T2 above it}, column B = {T3 at the
  // bottom, T4 above it}. This groups the two REAL adjacent pairs in the
  // conceptual 1->2->3->4 stack — the only relationship this cuts is the 2/3
  // boundary, unavoidable when splitting 4 tiers into 2 columns of 2 — and
  // conveniently puts the two Cluster-gridded tiers (1, 2 — usually the
  // widest now) in their own column instead of forcing their width onto the
  // narrower, ungridded document tiers (3, 4). Both columns are independently
  // built bottom-up from local y=0 (same convention `layoutComposite`/the
  // single-column branch above already use) and then centered side by side
  // around global x=0 with a gap between them.
  const COLUMN_A = [1, 2];
  const COLUMN_B = [3, 4];
  const positions = new Map<string, Position>();

  function placeColumn(tiers: number[], xOffset: number): void {
    let y = 0;
    for (const tier of tiers) {
      const box = tierBox.get(tier);
      const rel = tierRel.get(tier);
      if (!box || !rel) continue;
      for (const [id, p] of rel) positions.set(id, { x: p.x + xOffset, y: y + p.y });
      y -= box.height + options.tierGap + LABEL_CLEARANCE;
    }
  }

  const widthA = Math.max(0, ...COLUMN_A.map((t) => tierBox.get(t)?.width ?? 0));
  const widthB = Math.max(0, ...COLUMN_B.map((t) => tierBox.get(t)?.width ?? 0));
  const columnGap = options.colSpacing * 2 + LABEL_CLEARANCE;
  placeColumn(COLUMN_A, -(widthA / 2 + columnGap / 2));
  placeColumn(COLUMN_B, widthB / 2 + columnGap / 2);

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

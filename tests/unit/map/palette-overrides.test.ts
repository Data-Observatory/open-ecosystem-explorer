// CI-style colour-distinguishability gate for map2's palette (Opus
// evaluation report §B4/§C — replaces the prior ad-hoc "checked within
// same-shape groups by eye" method with a computed, re-runnable test).
//
// Scope note: this task's directive named 3 specific collisions to fix as
// they apply to map2's curated set — repository/community, standard/
// community (agency/cris doesn't apply, `cris` isn't in the curated set).
// Fixing those with a single `community` override is what this test proves.
// Two OTHER pairs the base palette.ts already had (index/policy ΔE 7.9,
// repository/standard ΔE 17.1) are PRE-EXISTING, corpus-wide issues, not
// something this override touches or regresses — the evaluation report
// itself sequenced a full `TYPE_FILL` repaint as a separate, later, holistic
// task ("§C Stage 4... driven by the CI test... last among the visual
// work"), not something to solve piecemeal inside a single type's map2
// override. This file therefore (a) proves the 2 fixed pairs actually clear
// the full bar, and (b) proves every OTHER pair the override touches (i.e.
// any pair involving `community`, since that's the only value this module
// changes) doesn't regress relative to its pre-override baseline.
import { describe, it, expect } from 'vitest';
import { hexDeltaE } from '../../../src/lib/map/color-distance.js';
import { map2TypeFill } from '../../../src/lib/map/palette-overrides.js';
import { TYPE_FILL } from '../../../src/lib/mermaid/palette.js';
import type { EntityType } from '../../../src/lib/model/types.js';

// Types actually present on /map2 after this task's curated-set additions
// (unesco-recommendation-open-science: policy; coar-notify + oai-pmh:
// standard) — kept in sync by hand since the curated list is itself
// hand-curated (not derived), same discipline as curated.ts's own comment.
const MAP2_TYPES: EntityType[] = ['identifier', 'agency', 'index', 'repository', 'standard', 'community', 'organization', 'policy'];

// Cross-cutting layer types (entity-types.yaml) share the Cytoscape hexagon
// shape on the canvas — those pairs need the stricter same-shape CVD floor.
const HEXAGON_TYPES = new Set<EntityType>(['standard', 'community', 'organization', 'policy']);

const NORMAL_FLOOR = 20;
const CVD_SAME_SHAPE_FLOOR = 10;
const CVD_DIFF_SHAPE_FLOOR = 12;

// The 2 collisions this override was built to fix — must clear the full bar.
const FIXED_PAIRS: [EntityType, EntityType][] = [
  ['repository', 'community'],
  ['standard', 'community'],
];

describe('map2 palette — named collisions are actually fixed', () => {
  for (const [a, b] of FIXED_PAIRS) {
    const sameShape = HEXAGON_TYPES.has(a) && HEXAGON_TYPES.has(b);
    const cvdFloor = sameShape ? CVD_SAME_SHAPE_FLOOR : CVD_DIFF_SHAPE_FLOOR;
    it(`${a} vs ${b} (sameShape=${sameShape}) clears normal>=${NORMAL_FLOOR}, cvd>=${cvdFloor}`, () => {
      const colorA = map2TypeFill(a);
      const colorB = map2TypeFill(b);
      const normal = hexDeltaE(colorA, colorB, 'normal');
      const protan = hexDeltaE(colorA, colorB, 'protanopia');
      const deutan = hexDeltaE(colorA, colorB, 'deuteranopia');
      expect(normal, `normal-vision ΔE between ${a} (${colorA}) and ${b} (${colorB})`).toBeGreaterThanOrEqual(NORMAL_FLOOR);
      expect(protan, `protanopia-sim ΔE between ${a} and ${b}`).toBeGreaterThanOrEqual(cvdFloor);
      expect(deutan, `deuteranopia-sim ΔE between ${a} and ${b}`).toBeGreaterThanOrEqual(cvdFloor);
    });
  }

  // Was "the override differs from the shared palette.ts value" — true only
  // while this was a map2-only override. Promoted into `TYPE_FILL.community`
  // itself 2026-09-07 once /map2's rendering (and this fix with it) was
  // promoted to /map, so every Mermaid diagram gets the fix too, not just
  // this one route's Cytoscape rendering. `map2TypeFill('community')` and
  // `TYPE_FILL.community` are now deliberately the SAME value — this proves
  // that (not a regression: `MAP2_TYPE_FILL_OVERRIDES` is now a documented
  // no-op, kept as a one-line escape hatch for a future map2-only need).
  it('the community fix lives in the shared palette now; the override is a harmless no-op', () => {
    expect(map2TypeFill('community')).toBe(TYPE_FILL.community);
    expect(TYPE_FILL.community).toBe('#bf3989');
  });
});

describe('map2 palette — no regressions on every other pair the override touches', () => {
  const otherTypes = MAP2_TYPES.filter((t) => t !== 'community');
  for (const other of otherTypes) {
    // Not a strict "no worse than baseline" check: some base-palette pairs
    // (e.g. community/organization at ΔE ~60) had far more separation than
    // the 20 floor requires, so a smaller-but-still-comfortable ΔE after the
    // override isn't a regression — the invariant that matters is that the
    // override never drops a pair BELOW the floor it previously cleared.
    it(`community vs ${other} still clears the normal-vision floor after the override`, () => {
      const overrideNormal = hexDeltaE(map2TypeFill('community'), map2TypeFill(other), 'normal');
      expect(overrideNormal).toBeGreaterThanOrEqual(NORMAL_FLOOR);
    });
  }

  it('pairs the override never touches are byte-identical to the base palette (no accidental change)', () => {
    for (const t of MAP2_TYPES) {
      if (t === 'community') continue;
      expect(map2TypeFill(t)).toBe(TYPE_FILL[t]);
    }
  });
});

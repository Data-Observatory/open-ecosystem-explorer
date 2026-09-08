// map2-only colour override (Opus evaluation report §A8/§B4). Scoped
// deliberately: `/map` and every Mermaid diagram sitewide keep reading
// `TYPE_FILL` from mermaid/palette.ts unchanged — this module MERGES one
// override on top of it for map2's rendering only, it never mutates the
// shared module.
//
// The report measured (CIEDE2000, normal + protanopia/deuteranopia sim)
// `community`'s base fill (#0969da) against `repository` (#1f6feb, ΔE 3.3
// normal — same blue at small size) and `standard` (#8250df, ΔE 1.9 under
// protanopia AND the same Cytoscape hexagon shape as community/standard/
// organization/policy, since all four share the `cross-cutting` layer).
// `#bf3989` (a magenta, clear of every hue already in use) was picked by
// exhaustively checking it against all 7 other type colours actually
// rendered on map2's curated 27-entity set — see
// tests/unit/map/palette-overrides.test.ts for the numbers this must keep
// clearing if the curated set or base palette ever changes.
import { TYPE_FILL } from '../mermaid/palette.js';
import type { EntityType } from '../model/types.js';

export const MAP2_TYPE_FILL_OVERRIDES: Partial<Record<EntityType, string>> = {
  community: '#bf3989',
};

export function map2TypeFill(type: EntityType): string {
  return MAP2_TYPE_FILL_OVERRIDES[type] ?? TYPE_FILL[type];
}

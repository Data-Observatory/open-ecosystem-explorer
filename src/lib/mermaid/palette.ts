// Shape-by-layer, fill-by-type encoding (specs.md §6.4). Five colours
// (repository/index/cris/standard/organization) are the exact values from
// Appendix B.2's worked example and must not drift from it. All 13 were
// checked in Phase 7 (§9.2): every stroke colour is >=3:1 against the fixed
// white diagram background (Diagram.astro pins this regardless of page
// theme — see that file's comment) and every same-shape group (types
// sharing a Mermaid shape, since shape is keyed by layer not by type) was
// checked for colourblind hue collisions. One was found and fixed: `policy`
// moved off its original gold, which collided with `organization` under
// protanopia/deuteranopia (both hexagon-shaped, same orange/gold family).
import type { EntityType, Layer, CrossCuttingLayer } from '../model/types.js';

export type MermaidShape = 'stadium' | 'subroutine' | 'cylinder' | 'rect' | 'parallelogram' | 'hexagon' | 'rounded';

const SHAPE_BY_LAYER: Record<Layer | CrossCuttingLayer, MermaidShape> = {
  identifier: 'stadium',
  agency: 'subroutine',
  index: 'cylinder',
  'institutional-system': 'rect',
  regional: 'parallelogram',
  'cross-cutting': 'hexagon',
  // Concepts are ideas, not things: a plain rounded box, unique among shapes
  // (so its fill never has to be colourblind-separated from another type).
  concept: 'rounded',
};

export function shapeForLayer(layer: Layer | CrossCuttingLayer): MermaidShape {
  return SHAPE_BY_LAYER[layer];
}

export function wrapShape(shape: MermaidShape, nodeId: string, label: string): string {
  switch (shape) {
    case 'stadium':
      return `${nodeId}([${label}])`;
    case 'subroutine':
      return `${nodeId}[[${label}]]`;
    case 'cylinder':
      return `${nodeId}[(${label})]`;
    case 'rect':
      return `${nodeId}[${label}]`;
    case 'parallelogram':
      return `${nodeId}[/${label}/]`;
    case 'hexagon':
      return `${nodeId}{{${label}}}`;
    case 'rounded':
      return `${nodeId}(${label})`;
  }
}

/**
 * Verified against Appendix B.2 for repository/index/cris/standard/organization.
 * identifier/agency/aggregator/publishing-platform/community/coalition/policy
 * are reasonable provisional fills — see file header.
 */
export const TYPE_FILL: Record<EntityType, string> = {
  repository: '#1f6feb',
  index: '#0e7070',
  cris: '#1a7f37',
  standard: '#8250df',
  organization: '#bf8b00',
  identifier: '#953800',
  agency: '#116329',
  aggregator: '#6e40c9',
  'publishing-platform': '#a40e26',
  // Was '#0969da' — measured (CIEDE2000, normal + protanopia/deuteranopia
  // sim) too close to `repository` (#1f6feb, ΔE 3.3 normal) and `standard`
  // (#8250df, ΔE 1.9 under protanopia), and all four cross-cutting-layer
  // hexagon types (community/standard/organization/policy) share a shape too
  // — see tests/unit/map/palette-overrides.test.ts. Originally a /map2-only
  // override (`palette-overrides.ts`); promoted here site-wide (2026-09-07)
  // once /map2's rendering was promoted to /map, so it's no longer scoped to
  // one route's Cytoscape rendering while every Mermaid diagram kept the
  // colliding colour. `palette-overrides.ts`'s `MAP2_TYPE_FILL_OVERRIDES` is
  // now a no-op (same value) — kept rather than removed so a future map2-
  // only override stays a one-line change if ever needed again.
  community: '#bf3989',
  coalition: '#57606a',
  // Phase 7 (§9.2 colourblind-safe pass): the original '#9a6700' sat in the
  // same orange/gold hue family as `organization` ('#bf8b00'). Both share the
  // 'hexagon' shape (cross-cutting layer), so under protanopia/deuteranopia
  // they were nearly indistinguishable by shape+colour alone. Moved to a
  // teal hue, clearly separated from every other hexagon-shaped type;
  // 4.86:1 vs white / 4.33:1 vs black, both well above the 3:1 floor.
  policy: '#0a7d8c',
  // Sole occupant of the 'rounded' shape (concept layer), so only needs >=3:1
  // against white (6.1:1) and to be distinct from its neighbours in the legend.
  concept: '#9a3412',
};

export function classDefLine(type: EntityType): string {
  return `classDef ${type.replace(/-/g, '')} fill:${TYPE_FILL[type]}22,stroke:${TYPE_FILL[type]},stroke-width:2px;`;
}

/** Mermaid classDef names can't contain hyphens; strip them consistently. */
export function classNameForType(type: EntityType): string {
  return type.replace(/-/g, '');
}

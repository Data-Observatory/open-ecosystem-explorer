// Minimal map (`/{loc}/map3`): which nodes a newcomer sees first, and the
// two five-way visual encodings (node family, predicate family). Pure data
// + pure functions — defined in code, not in entity YAML, so the default
// view can be tuned without touching curated content.
import type { EntityType, PredicateFamilyId } from '../model/types.js';

/**
 * The 14 nodes of the default view: the 11 `prominence: core` concepts plus
 * the three identifiers a newcomer meets first. Sorted; every id must exist
 * in the corpus (tests/unit/map/anchors.test.ts).
 */
export const DEFAULT_ANCHOR_IDS: readonly string[] = [
  'citation-index',
  'cris',
  'diamond-open-access',
  'doi',
  'metadata',
  'open-access',
  'open-data',
  'open-science',
  'orcid',
  'persistent-identifier',
  'preprint',
  'research-data-management',
  'research-repository',
  'ror',
];

export function isAnchor(id: string): boolean {
  return DEFAULT_ANCHOR_IDS.includes(id);
}

/** Five node families instead of 13 types (review report §3.3). */
export type NodeFamily = 'concept' | 'identifier' | 'service' | 'rule' | 'actor';

export const NODE_FAMILIES: readonly NodeFamily[] = ['concept', 'identifier', 'service', 'rule', 'actor'];

const FAMILY_BY_TYPE: Record<EntityType, NodeFamily> = {
  concept: 'concept',
  identifier: 'identifier',
  repository: 'service',
  index: 'service',
  cris: 'service',
  aggregator: 'service',
  'publishing-platform': 'service',
  standard: 'rule',
  policy: 'rule',
  agency: 'actor',
  organization: 'actor',
  community: 'actor',
  coalition: 'actor',
};

export function nodeFamilyOf(type: EntityType): NodeFamily {
  return FAMILY_BY_TYPE[type];
}

export interface NodeFamilyStyle {
  /** Cytoscape node shape — repeats the colour coding (WCAG 1.4.1). */
  shape: 'round-rectangle' | 'diamond' | 'ellipse' | 'hexagon' | 'rectangle';
  /** Fill on the light / dark canvas; each >= 3:1 against its background. */
  light: string;
  dark: string;
}

export const NODE_FAMILY_STYLE: Record<NodeFamily, NodeFamilyStyle> = {
  concept: { shape: 'round-rectangle', light: '#4f46e5', dark: '#a5b4fc' },
  identifier: { shape: 'diamond', light: '#b45309', dark: '#f5b84b' },
  service: { shape: 'ellipse', light: '#0e7490', dark: '#5fd3e3' },
  rule: { shape: 'hexagon', light: '#be185d', dark: '#f4a3c8' },
  actor: { shape: 'rectangle', light: '#57606a', dark: '#b9c2cc' },
};

export interface EdgeFamilyStyle {
  line: 'solid' | 'dashed' | 'dotted';
  light: string;
  dark: string;
}

/** Edge colour by predicate family (5), shown only for the selected node's edges. */
export const EDGE_FAMILY_STYLE: Record<PredicateFamilyId, EdgeFamilyStyle> = {
  behind: { line: 'solid', light: '#c2410c', dark: '#fb923c' },
  'builds-on': { line: 'dashed', light: '#0f766e', dark: '#5eead4' },
  connects: { line: 'solid', light: '#1d4ed8', dark: '#93c5fd' },
  shapes: { line: 'dashed', light: '#7e22ce', dark: '#d8b4fe' },
  kind: { line: 'dotted', light: '#6b7280', dark: '#9ca3af' },
};

/** Canvas backgrounds the two palettes above are validated against. */
export const MAP_CANVAS_BG = { light: '#fafaf9', dark: '#111418' } as const;

/** Cut a summary to at most `maxWords` words, on a word boundary, with an ellipsis. */
export function clampWords(text: string, maxWords = 25): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return words.join(' ');
  return `${words.slice(0, maxWords).join(' ').replace(/[,;:.]$/, '')}…`;
}

export interface RankableNeighbour {
  id: string;
  anchor: boolean;
  core: boolean;
  degree: number;
}

/** Stable "most worth showing first" order: anchors, then core, then degree, then id. */
export function rankNeighbours<T extends RankableNeighbour>(neighbours: readonly T[]): T[] {
  return [...neighbours].sort(
    (a, b) => Number(b.anchor) - Number(a.anchor) || Number(b.core) - Number(a.core) || b.degree - a.degree || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

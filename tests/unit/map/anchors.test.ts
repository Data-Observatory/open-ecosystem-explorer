import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ANCHOR_IDS,
  EDGE_FAMILY_STYLE,
  MAP_CANVAS_BG,
  NODE_FAMILIES,
  NODE_FAMILY_STYLE,
  clampWords,
  isAnchor,
  nodeFamilyOf,
  rankNeighbours,
} from '../../../src/lib/map/anchors.js';
import { hexToRgb } from '../../../src/lib/map/color-distance.js';
import { ENTITY_TYPES, PREDICATE_FAMILY_IDS } from '../../../src/lib/model/types.js';
import { loadRealEntities } from '../../fixtures/load-real-content.js';

function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('default anchors', () => {
  const entities = new Map(loadRealEntities().map((e) => [e.id, e]));

  it('are 14, sorted and unique', () => {
    expect(DEFAULT_ANCHOR_IDS).toHaveLength(14);
    expect([...DEFAULT_ANCHOR_IDS].sort()).toEqual([...DEFAULT_ANCHOR_IDS]);
    expect(new Set(DEFAULT_ANCHOR_IDS).size).toBe(14);
  });

  it('all exist in the corpus and have at least one relation', () => {
    const linked = new Set<string>();
    for (const e of entities.values()) {
      for (const r of e.relations) {
        linked.add(e.id);
        linked.add(r.target);
      }
    }
    for (const id of DEFAULT_ANCHOR_IDS) {
      expect(entities.has(id), id).toBe(true);
      expect(linked.has(id), id).toBe(true);
    }
  });

  it('cover every core concept', () => {
    const coreConcepts = [...entities.values()].filter((e) => e.type === 'concept' && e.prominence === 'core').map((e) => e.id);
    for (const id of coreConcepts) expect(isAnchor(id), id).toBe(true);
    expect(isAnchor('zenodo')).toBe(false);
  });
});

describe('visual families', () => {
  it('every entity type maps to one of the five node families', () => {
    for (const type of ENTITY_TYPES) expect(NODE_FAMILIES).toContain(nodeFamilyOf(type));
    expect(nodeFamilyOf('concept')).toBe('concept');
    expect(nodeFamilyOf('policy')).toBe('rule');
    expect(nodeFamilyOf('agency')).toBe('actor');
  });

  it('node families use five distinct shapes (colour is never the only cue)', () => {
    expect(new Set(NODE_FAMILIES.map((f) => NODE_FAMILY_STYLE[f].shape)).size).toBe(5);
    expect(new Set(NODE_FAMILIES.map((f) => NODE_FAMILY_STYLE[f].light)).size).toBe(5);
  });

  it('node and edge colours reach 3:1 against the canvas in both themes (WCAG 1.4.11)', () => {
    for (const f of NODE_FAMILIES) {
      expect(contrast(NODE_FAMILY_STYLE[f].light, MAP_CANVAS_BG.light), `${f} light`).toBeGreaterThanOrEqual(3);
      expect(contrast(NODE_FAMILY_STYLE[f].dark, MAP_CANVAS_BG.dark), `${f} dark`).toBeGreaterThanOrEqual(3);
    }
    for (const f of PREDICATE_FAMILY_IDS) {
      expect(contrast(EDGE_FAMILY_STYLE[f].light, MAP_CANVAS_BG.light), `${f} light`).toBeGreaterThanOrEqual(3);
      expect(contrast(EDGE_FAMILY_STYLE[f].dark, MAP_CANVAS_BG.dark), `${f} dark`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('clampWords', () => {
  it('leaves short text alone and cuts long text on a word boundary', () => {
    expect(clampWords('  uno dos  tres ')).toBe('uno dos tres');
    const long = Array.from({ length: 30 }, (_, i) => `w${i}`).join(' ');
    const cut = clampWords(long);
    expect(cut.endsWith('w24…')).toBe(true);
    expect(cut.split(' ')).toHaveLength(25);
    expect(clampWords('a b, c', 2)).toBe('a b…');
  });
});

describe('rankNeighbours', () => {
  it('orders anchors, then core, then degree, then id — without mutating', () => {
    const input = [
      { id: 'z', anchor: false, core: false, degree: 9 },
      { id: 'b', anchor: false, core: true, degree: 1 },
      { id: 'a', anchor: true, core: false, degree: 1 },
      { id: 'y', anchor: false, core: false, degree: 9 },
      { id: 'c', anchor: false, core: false, degree: 2 },
    ];
    expect(rankNeighbours(input).map((n) => n.id)).toEqual(['a', 'b', 'y', 'z', 'c']);
    expect(input[0]!.id).toBe('z');
  });
});

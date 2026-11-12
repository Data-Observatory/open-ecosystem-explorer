import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeLayout, serializeLayout, type LayoutEdge, type LayoutNode } from '../../../src/lib/map/layout.js';
import { DEFAULT_ANCHOR_IDS } from '../../../src/lib/map/anchors.js';
import { generateLayoutFile, loadLayoutInput } from '../../../scripts/layout-graph.js';

const nodes: LayoutNode[] = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, anchor: id === 'a' || id === 'd' }));
const edges: LayoutEdge[] = [
  { from: 'a', to: 'b' },
  { from: 'a', to: 'c' },
  { from: 'd', to: 'e' },
  { from: 'b', to: 'd' },
];

describe('computeLayout (minimal map, specs.md A3 determinism)', () => {
  it('returns one integer position per node, including disconnected ones', () => {
    const pos = computeLayout(nodes, edges);
    expect(Object.keys(pos).sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    for (const [x, y] of Object.values(pos)) {
      expect(Number.isInteger(x)).toBe(true);
      expect(Number.isInteger(y)).toBe(true);
    }
  });

  it('is independent of input order and repeatable', () => {
    const a = serializeLayout(computeLayout(nodes, edges));
    const b = serializeLayout(computeLayout([...nodes].reverse(), [...edges].reverse()));
    const c = serializeLayout(computeLayout(nodes, edges));
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it('ignores self-loops, duplicate edges and edges to unknown ids', () => {
    const base = serializeLayout(computeLayout(nodes, edges));
    const noisy = serializeLayout(computeLayout(nodes, [...edges, { from: 'a', to: 'a' }, { from: 'b', to: 'a' }, { from: 'a', to: 'zzz' }]));
    expect(noisy).toBe(base);
  });

  it('handles a graph with no anchors and no edges', () => {
    const pos = computeLayout([{ id: 'x', anchor: false }, { id: 'y', anchor: false }], []);
    expect(Object.keys(pos)).toHaveLength(2);
    expect(pos.x).not.toEqual(pos.y);
  });

  it('serialises with sorted ids and a trailing newline', () => {
    const body = serializeLayout({ b: [1, 2], a: [3, 4] });
    expect(body).toBe('{\n  "version": 1,\n  "positions": {\n    "a": [3, 4],\n    "b": [1, 2]\n  }\n}\n');
    expect(JSON.parse(body).positions.a).toEqual([3, 4]);
  });
});

describe('real corpus layout', () => {
  const { nodes: realNodes, edges: realEdges } = loadLayoutInput();
  const pos = computeLayout(realNodes, realEdges);

  it('committed src/generated/graph-layout.json is up to date (run `npm run layout:generate`)', () => {
    const committed = readFileSync(join(import.meta.dirname, '../../../src/generated/graph-layout.json'), 'utf-8');
    expect(generateLayoutFile()).toBe(committed);
  });

  it('positions every entity', () => {
    expect(Object.keys(pos)).toHaveLength(realNodes.length);
  });

  it('no two label footprints overlap', () => {
    const ids = Object.keys(pos);
    const clashes: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = pos[ids[i]!]!;
        const b = pos[ids[j]!]!;
        if (((a[0] - b[0]) / 128) ** 2 + ((a[1] - b[1]) / 62) ** 2 < 0.95) clashes.push(`${ids[i]} / ${ids[j]}`);
      }
    }
    expect(clashes).toEqual([]);
  });

  it('keeps the default anchors well apart', () => {
    for (const a of DEFAULT_ANCHOR_IDS) {
      for (const b of DEFAULT_ANCHOR_IDS) {
        if (a >= b) continue;
        const d = Math.hypot(pos[a]![0] - pos[b]![0], pos[a]![1] - pos[b]![1]);
        expect(d, `${a} / ${b}`).toBeGreaterThan(110);
      }
    }
  });
});

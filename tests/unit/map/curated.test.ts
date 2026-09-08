import { describe, it, expect } from 'vitest';
import { filterToEntitySet } from '../../../src/lib/map/curated.js';

interface N {
  id: string;
  outgoing: { id: string }[];
  incoming: { id: string }[];
  degree: { in: number; out: number };
  noRelations: boolean;
  label: string;
}
interface E {
  from: string;
  to: string;
}

function node(id: string, outgoing: string[], incoming: string[]): N {
  return {
    id,
    outgoing: outgoing.map((i) => ({ id: i })),
    incoming: incoming.map((i) => ({ id: i })),
    degree: { in: incoming.length, out: outgoing.length },
    noRelations: outgoing.length === 0 && incoming.length === 0,
    label: id,
  };
}

describe('filterToEntitySet', () => {
  it('keeps only nodes whose id is in the curated set', () => {
    const nodes = [node('a', ['b'], []), node('b', [], ['a']), node('c', [], [])];
    const { nodes: out } = filterToEntitySet(nodes, [], ['a', 'b']);
    expect(out.map((n) => n.id).sort()).toEqual(['a', 'b']);
  });

  it('drops an edge when either endpoint is outside the curated set', () => {
    const edges: E[] = [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'z' },
      { from: 'z', to: 'b' },
    ];
    const { edges: out } = filterToEntitySet<N, E>([], edges, ['a', 'b']);
    expect(out).toEqual([{ from: 'a', to: 'b' }]);
  });

  it('drops a node relation reference that points outside the curated set, and recomputes degree/noRelations', () => {
    const nodes = [node('a', ['b', 'z'], ['z']), node('b', [], ['a'])];
    const { nodes: out } = filterToEntitySet(nodes, [], ['a', 'b']);
    const a = out.find((n) => n.id === 'a')!;
    expect(a.outgoing).toEqual([{ id: 'b' }]);
    expect(a.incoming).toEqual([]);
    expect(a.degree).toEqual({ in: 0, out: 1 });
    expect(a.noRelations).toBe(false);
  });

  it('marks a node with only out-of-set relations as noRelations after filtering', () => {
    const nodes = [node('a', ['z'], ['z'])];
    const { nodes: out } = filterToEntitySet(nodes, [], ['a']);
    expect(out[0]?.degree).toEqual({ in: 0, out: 0 });
    expect(out[0]?.noRelations).toBe(true);
  });

  it('preserves extra fields on nodes untouched', () => {
    const nodes = [node('a', [], [])];
    const { nodes: out } = filterToEntitySet(nodes, [], ['a']);
    expect(out[0]?.label).toBe('a');
  });

  it('returns empty arrays when the curated set matches nothing', () => {
    const nodes = [node('a', [], [])];
    const edges: E[] = [{ from: 'a', to: 'a' }];
    const result = filterToEntitySet(nodes, edges, []);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });
});

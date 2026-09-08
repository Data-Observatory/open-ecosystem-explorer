import { describe, it, expect } from 'vitest';
import { classifyNodes, summarizeStates, nHopNeighborhood, type Adjacency } from '../../../src/lib/map/graph-state.js';

// A small fixture graph: a -> b -> c, d -> b, e -> f (disconnected pair).
// Lets one test exercise upstream/downstream/shared/dimmed all at once.
const ADJ: Adjacency = {
  outTargets: new Map([
    ['a', ['b']],
    ['b', ['c']],
    ['d', ['b']],
    ['e', ['f']],
  ]),
  inSources: new Map([
    ['b', ['a', 'd']],
    ['c', ['b']],
    ['f', ['e']],
  ]),
};
const ALL_IDS = ['a', 'b', 'c', 'd', 'e', 'f'];

describe('classifyNodes', () => {
  it('with no selection, classifies every id as dimmed', () => {
    const states = classifyNodes(ALL_IDS, [], ADJ);
    for (const id of ALL_IDS) expect(states.get(id)).toBe('dimmed');
  });

  it('single selection: outgoing target is upstream, incoming source is downstream', () => {
    const states = classifyNodes(ALL_IDS, ['b'], ADJ);
    expect(states.get('b')).toBe('selected');
    expect(states.get('c')).toBe('upstream'); // b depends on c (b -> c)
    expect(states.get('a')).toBe('downstream'); // a depends on b (a -> b)
    expect(states.get('d')).toBe('downstream');
    expect(states.get('e')).toBe('dimmed');
    expect(states.get('f')).toBe('dimmed');
  });

  it('multi-selection: a node touched by 2+ selected nodes becomes shared', () => {
    const states = classifyNodes(ALL_IDS, ['a', 'd'], ADJ);
    expect(states.get('a')).toBe('selected');
    expect(states.get('d')).toBe('selected');
    expect(states.get('b')).toBe('shared'); // both a and d point at b
    expect(states.get('c')).toBe('dimmed'); // not directly touched by a or d
  });

  it('a selected node is never reclassified even if another selection touches it', () => {
    const states = classifyNodes(ALL_IDS, ['a', 'b'], ADJ);
    expect(states.get('a')).toBe('selected');
    expect(states.get('b')).toBe('selected');
  });
});

describe('summarizeStates', () => {
  it('counts upstream/downstream/shared, ignoring selected/dimmed', () => {
    const states = classifyNodes(ALL_IDS, ['b'], ADJ);
    expect(summarizeStates(states)).toEqual({ upstream: 1, downstream: 2, shared: 0 });
  });

  it('counts a shared node once', () => {
    const states = classifyNodes(ALL_IDS, ['a', 'd'], ADJ);
    expect(summarizeStates(states)).toEqual({ upstream: 0, downstream: 0, shared: 1 });
  });
});

describe('nHopNeighborhood', () => {
  it('1 hop includes only direct neighbours plus the seed', () => {
    const n = nHopNeighborhood('b', 1, ADJ);
    expect(n).toEqual(new Set(['b', 'a', 'd', 'c']));
  });

  it('2 hops reaches transitively, but no further than the graph allows', () => {
    const n = nHopNeighborhood('a', 2, ADJ);
    expect(n).toEqual(new Set(['a', 'b', 'c', 'd']));
  });

  it('stops early when the frontier is exhausted before the hop limit', () => {
    const n = nHopNeighborhood('e', 5, ADJ);
    expect(n).toEqual(new Set(['e', 'f']));
  });
});

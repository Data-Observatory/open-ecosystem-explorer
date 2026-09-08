import { describe, expect, it } from 'vitest';
import { findCycle } from '../../../src/lib/graph/traverse.js';
import type { GraphEdge } from '../../../src/lib/model/types.js';

function edge(from: string, to: string): GraphEdge {
  return { from, to, predicate: 'part-of', confidence: 'asserted', sources: [], derived: false };
}

describe('findCycle', () => {
  it('returns null for an empty edge set', () => {
    expect(findCycle([])).toBeNull();
  });

  it('returns null for a DAG', () => {
    expect(findCycle([edge('a', 'b'), edge('b', 'c'), edge('a', 'c')])).toBeNull();
  });

  it('detects a direct 2-cycle', () => {
    const cycle = findCycle([edge('a', 'b'), edge('b', 'a')]);
    expect(cycle).not.toBeNull();
    expect(cycle).toEqual(['a', 'b', 'a']);
  });

  it('detects a longer cycle across disconnected components', () => {
    const cycle = findCycle([edge('x', 'y'), edge('a', 'b'), edge('b', 'c'), edge('c', 'a')]);
    expect(cycle).not.toBeNull();
    expect(cycle![0]).toBe(cycle![cycle!.length - 1]);
  });

  it('handles a self-loop as a 1-node cycle', () => {
    const cycle = findCycle([edge('a', 'a')]);
    expect(cycle).toEqual(['a', 'a']);
  });
});

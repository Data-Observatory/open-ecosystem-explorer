import { describe, it, expect } from 'vitest';
import { parseMapUrlState, serializeMapUrlState, EMPTY_MAP_URL_STATE } from '../../../src/lib/map/url-state.js';

describe('map URL state', () => {
  it('parses an empty query string to the empty state', () => {
    expect(parseMapUrlState('')).toEqual(EMPTY_MAP_URL_STATE);
  });

  it('parses every facet plus selection and hop depth', () => {
    const state = parseMapUrlState('?layer=index,agency&type=repository&governance=commercial&tag=theme:x&sel=doi,ror&hops=2');
    expect(state).toEqual({
      layers: ['index', 'agency'],
      types: ['repository'],
      governances: ['commercial'],
      tags: ['theme:x'],
      selected: ['doi', 'ror'],
      hops: 2,
    });
  });

  it('clamps an out-of-range hops value to 1', () => {
    expect(parseMapUrlState('?hops=7').hops).toBe(1);
    expect(parseMapUrlState('?hops=abc').hops).toBe(1);
  });

  it('serialises the empty state to an empty string', () => {
    expect(serializeMapUrlState(EMPTY_MAP_URL_STATE)).toBe('');
  });

  it('round-trips a populated state through parse -> serialize -> parse', () => {
    const original = parseMapUrlState('?layer=index,agency&type=repository&governance=commercial&tag=theme:x&sel=doi,ror&hops=3');
    const roundTripped = parseMapUrlState(serializeMapUrlState(original));
    expect(roundTripped).toEqual(original);
  });

  it('omits hops from the query string when it is the default (1)', () => {
    const s = serializeMapUrlState({ ...EMPTY_MAP_URL_STATE, hops: 1, selected: ['doi'] });
    expect(s).toBe('?sel=doi');
  });
});

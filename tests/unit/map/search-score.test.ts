import { describe, it, expect } from 'vitest';
import { scoreSearchEntry } from '../../../src/lib/map/search-score.js';

describe('scoreSearchEntry', () => {
  const entry = { name: 'Zenodo', aka: ['CERN repository'], tags: ['function:deposit'], summary: 'A general-purpose open repository.' };

  it('returns 0 for an empty query (matches, neutral score)', () => {
    expect(scoreSearchEntry(entry, '')).toBe(0);
  });

  it('scores a name-prefix match highest', () => {
    expect(scoreSearchEntry(entry, 'zen')).toBe(3);
  });

  it('scores a name-substring match below prefix', () => {
    expect(scoreSearchEntry(entry, 'nod')).toBe(2);
  });

  it('scores an aka/tag match below name matches', () => {
    expect(scoreSearchEntry(entry, 'cern')).toBe(1.5);
    expect(scoreSearchEntry(entry, 'deposit')).toBe(1.5);
  });

  it('scores a summary-only match lowest positive', () => {
    expect(scoreSearchEntry(entry, 'general-purpose')).toBe(1);
  });

  it('returns -1 for no match', () => {
    expect(scoreSearchEntry(entry, 'nonexistent-term')).toBe(-1);
  });

  it('is case-insensitive', () => {
    expect(scoreSearchEntry(entry, 'ZENODO')).toBe(3);
  });
});

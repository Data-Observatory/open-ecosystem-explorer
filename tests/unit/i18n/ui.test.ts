import { describe, expect, it } from 'vitest';
import { fmt, getAllUiBundles, governanceLabel } from '../../../src/i18n/ui.js';

function keyPaths(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k));
}

describe('UI chrome strings (specs.md §5.7 locale-completeness)', () => {
  it('es and en bundles define exactly the same keys', () => {
    const { es, en } = getAllUiBundles();
    expect(keyPaths(es).sort()).toEqual(keyPaths(en).sort());
  });

  it('no UI string is empty', () => {
    const { es, en } = getAllUiBundles();
    for (const bundle of [es, en]) {
      for (const path of keyPaths(bundle)) {
        const value = path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], bundle);
        expect(value, path).not.toBe('');
      }
    }
  });

  it('fmt fills {placeholders}', () => {
    expect(fmt('Ver como tabla ({n} relaciones)', { n: 7 })).toBe('Ver como tabla (7 relaciones)');
  });

  it('governance enum values are localised, unknown values fall back to the raw value', () => {
    expect(governanceLabel('es', 'nonprofit')).toBe('Sin fines de lucro');
    expect(governanceLabel('en', 'nonprofit')).toBe('Nonprofit');
    expect(governanceLabel('es', 'something-new')).toBe('something-new');
  });
});

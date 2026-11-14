// Unit tests for the §5.7 fallback chain (src/lib/i18n/resolve.ts).
import { describe, expect, it } from 'vitest';
import { resolveProse } from '../../../src/lib/i18n/resolve.js';
import type { GraphIndex, ResolvedProse } from '../../../src/lib/model/types.js';

function fakeIndex(prose: Record<string, Record<string, ResolvedProse>>): GraphIndex {
	const map = new Map(
		Object.entries(prose).map(([locale, byId]) => [locale, new Map(Object.entries(byId))])
	);
	return { prose: map } as unknown as GraphIndex;
}

const esProse: ResolvedProse = { summary: 'Resumen en español.', body: 'Cuerpo en español.' };
const enProse: ResolvedProse = { summary: 'English summary.', body: 'English body.' };

describe('resolveProse', () => {
	it('returns the requested locale directly when its prose file exists (exact match)', () => {
		const index = fakeIndex({ es: { doi: esProse }, en: { doi: enProse } });
		const result = resolveProse(index, 'doi', 'en');
		expect(result).toEqual({ prose: enProse, localeUsed: 'en', fallback: false });
	});

	it('falls back to the default locale (es) when the requested locale has no prose for this entity', () => {
		const index = fakeIndex({ es: { doi: esProse }, en: {} });
		const result = resolveProse(index, 'doi', 'en');
		expect(result).toEqual({ prose: esProse, localeUsed: 'es', fallback: true });
	});

	it('requesting the default locale directly is never flagged as a fallback', () => {
		const index = fakeIndex({ es: { doi: esProse }, en: {} });
		const result = resolveProse(index, 'doi', 'es');
		expect(result).toEqual({ prose: esProse, localeUsed: 'es', fallback: false });
	});

	it('throws loudly if even the default locale has no prose (I29 should make this unreachable post-validate)', () => {
		const index = fakeIndex({ es: {}, en: {} });
		expect(() => resolveProse(index, 'ghost-entity', 'en')).toThrow(/I29/);
	});

	it('resolves real seed content correctly: figshare (translated in this phase) exact-match in en', async () => {
		const { loadRealProseMap } = await import('../../fixtures/load-real-content.js');
		const prose = loadRealProseMap();
		const index = { prose } as unknown as GraphIndex;
		const figshare = resolveProse(index, 'figshare', 'en');
		expect(figshare.fallback).toBe(false);
		expect(figshare.localeUsed).toBe('en');
	});

	it('resolves real seed content correctly: every entity has en prose, so none falls back (full parity)', async () => {
		const { loadRealProseMap } = await import('../../fixtures/load-real-content.js');
		const prose = loadRealProseMap();
		const index = { prose } as unknown as GraphIndex;
		const result = resolveProse(index, 'digital-science', 'en');
		expect(result.fallback).toBe(false);
		expect(result.localeUsed).toBe('en');
	});
});

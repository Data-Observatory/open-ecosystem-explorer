import { describe, expect, it } from 'vitest';
import { runValidation } from '../../../src/lib/invariants/run.js';
import { freshInput } from './helpers.js';

describe('runValidation', () => {
	it('defaults `now` to the current time when omitted', () => {
		const input = freshInput();
		const { now: _now, ...withoutNow } = input;
		void _now;
		const result = runValidation(withoutNow);
		// lastReviewed is 2026-09-01 in the fixture; against the real "now" this
		// should not trip the 18-month freshness warning either way — the point
		// of this test is only that omitting `now` does not throw.
		expect(result.entityCount).toBe(input.entityFiles.length);
	});

	it('creates a locale bucket on the fly for a prose file whose locale is not in the declared locales list', () => {
		const input = freshInput();
		input.proseFiles.push({
			id: 'fx-agency',
			locale: 'fr' as never,
			file: 'src/content/i18n/fr/fx-agency.md',
			prose: { summary: 'x'.repeat(45), body: '' }
		});
		const result = runValidation(input);
		// buildProseMap creates the 'fr' bucket on the fly rather than dropping
		// the data or throwing, even though 'fr' isn't in input.locales.
		const coverage = result.translationCoverage as Record<string, { present: number }>;
		expect(coverage.fr?.present).toBe(1);
		expect(result.errors).toEqual([]);
	});
});

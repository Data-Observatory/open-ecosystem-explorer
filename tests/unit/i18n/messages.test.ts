import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import es from '../../../messages/es.json' with { type: 'json' };
import en from '../../../messages/en.json' with { type: 'json' };
import inlang from '../../../project.inlang/settings.json' with { type: 'json' };
import { locales, defaultLocale } from '../../../src/i18n/locales.js';

// UI chrome strings live in messages/{es,en}.json (Paraglide). Entity, view and story prose stays
// in the YAML content. This replaces the Astro-era src/i18n/ui.test.ts locale-completeness check.

const ROOT = join(import.meta.dirname, '../../..');
const keysOf = (messages: Record<string, unknown>) =>
	Object.keys(messages)
		.filter((key) => !key.startsWith('$'))
		.sort();
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) return name === 'paraglide' ? [] : sourceFiles(full);
		return /\.(svelte|ts)$/.test(name) ? [full] : [];
	});
}

describe('messages', () => {
	it('es and en have identical key sets (100% parity)', () => {
		expect(keysOf(en)).toEqual(keysOf(es));
	});

	it('no message is empty and both locales use the same placeholders', () => {
		const e = es as Record<string, string>;
		const n = en as Record<string, string>;
		for (const key of keysOf(es)) {
			expect(e[key]?.trim(), `es.${key}`).not.toBe('');
			expect(n[key]?.trim(), `en.${key}`).not.toBe('');
			expect(placeholders(n[key] ?? ''), key).toEqual(placeholders(e[key] ?? ''));
		}
	});

	it('Paraglide and the content model agree on the locales and the default locale', () => {
		expect([...inlang.locales].sort()).toEqual(locales.map((l) => l.code).sort());
		expect(inlang.baseLocale).toBe(defaultLocale);
	});

	it('every message is used as m.<key>( under src/', () => {
		const sources = sourceFiles(join(ROOT, 'src')).map((file) => readFileSync(file, 'utf8'));
		const unused = keysOf(es).filter(
			(key) => !sources.some((text) => new RegExp(`\\bm\\.${key}\\b`).test(text))
		);
		expect(unused).toEqual([]);
	});
});

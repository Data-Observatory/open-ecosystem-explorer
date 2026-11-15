import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isPinned, sha256, verify } from '../../../scripts/verify-inlang-modules.mjs';

const root = process.cwd();
const modules: string[] = JSON.parse(
	readFileSync(join(root, 'project.inlang/settings.json'), 'utf8')
).modules;
const lock: Record<string, string> = JSON.parse(
	readFileSync(join(root, 'inlang-modules.lock.json'), 'utf8')
);

describe('the translation compiler plugins are pinned', () => {
	it('names every module at an exact version on the CDN', () => {
		expect(modules.length).toBeGreaterThan(0);
		for (const url of modules) expect(isPinned(url), url).toBe(true);
	});

	it('has a lock entry for each module and none for anything else', () => {
		expect(Object.keys(lock).sort()).toEqual([...modules].sort());
		for (const hash of Object.values(lock)) expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('refuses a floating version, another host, or a file outside dist/', () => {
		const ok = 'https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format@4.6.0/dist/index.js';
		expect(isPinned(ok)).toBe(true);
		expect(isPinned(ok.replace('@4.6.0', '@4'))).toBe(false);
		expect(isPinned(ok.replace('@4.6.0', '@latest'))).toBe(false);
		expect(isPinned(ok.replace('@4.6.0', '@^4.6.0'))).toBe(false);
		expect(isPinned(ok.replace('cdn.jsdelivr.net', 'example.test'))).toBe(false);
		expect(isPinned(ok.replace('http', 'http').replace('https', 'http'))).toBe(false);
		expect(isPinned(ok.replace('/dist/index.js', '/index.js'))).toBe(false);
	});
});

describe('verify', () => {
	const url = modules[0]!;
	const good = new TextEncoder().encode('plugin code');
	const lockOf = (bytes: Uint8Array) => ({ [url]: sha256(bytes) });

	it('passes when the file is the one in the lock', async () => {
		expect(await verify([url], lockOf(good), async () => good)).toEqual([]);
	});

	it('fails when the file at the CDN changed', async () => {
		const problems = await verify([url], lockOf(good), async () =>
			new TextEncoder().encode('plugin code, changed')
		);
		expect(problems).toHaveLength(1);
		expect(problems[0]).toContain('changed');
	});

	it('fails when a module has no hash, or the lock holds a stray one', async () => {
		expect((await verify([url], {}, async () => good))[0]).toContain('no hash');
		const stray = await verify(
			[url],
			{ ...lockOf(good), 'https://x.test/y.js': 'a' },
			async () => good
		);
		expect(stray.join('\n')).toContain('not used');
	});

	it('reports a failed download instead of passing', async () => {
		const problems = await verify([url], lockOf(good), async () => {
			throw new Error('HTTP 503');
		});
		expect(problems[0]).toContain('could not fetch');
	});

	it('does not fetch a module that is not pinned', async () => {
		let fetched = false;
		const floating = 'https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format@4/dist/index.js';
		const problems = await verify([floating], { [floating]: 'a'.repeat(64) }, async () => {
			fetched = true;
			return good;
		});
		expect(fetched).toBe(false);
		expect(problems[0]).toContain('not pinned');
	});
});

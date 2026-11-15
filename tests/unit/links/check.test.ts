import { describe, expect, it } from 'vitest';
import {
	checkLinks,
	checkUrl,
	classify,
	collectUrls,
	formatLinkReport,
	trimUrl,
	urlsInValue,
	type LinkResult
} from '../../../src/lib/links/check';

type Answer = { status: number; url?: string; redirected?: boolean } | Error;

/** A fetch that answers from a table keyed by "METHOD url"; unknown requests answer 200. */
function fakeFetch(table: Record<string, Answer | Answer[]>, log: string[] = []): typeof fetch {
	const seen = new Map<string, number>();
	return (async (input: string | URL | Request, init?: RequestInit) => {
		const url = String(input);
		const key = `${init?.method ?? 'GET'} ${url}`;
		log.push(key);
		const entry = table[key];
		const count = seen.get(key) ?? 0;
		seen.set(key, count + 1);
		const answer = Array.isArray(entry)
			? (entry[Math.min(count, entry.length - 1)] ?? { status: 200 })
			: (entry ?? { status: 200 });
		if (answer instanceof Error) throw answer;
		return {
			status: answer.status,
			url: answer.url ?? url,
			redirected: answer.redirected ?? false,
			body: null
		} as unknown as Response;
	}) as typeof fetch;
}

const options = (fetchImpl: typeof fetch) => ({
	fetch: fetchImpl,
	timeoutMs: 1000,
	retries: 2,
	userAgent: 'test-agent'
});

const withCode = (message: string, code: string) => {
	const error = new Error(message);
	(error as { cause?: unknown }).cause = { code };
	return error;
};

describe('collecting urls', () => {
	it('finds urls anywhere in a document, drops fragments and punctuation, keeps balanced brackets', () => {
		const found = urlsInValue(
			{
				url: 'https://example.org/a',
				sources: [
					{ url: 'https://www.wikidata.org/wiki/Q42#P463', accessed: '2026-11-13' },
					{ note: 'See [the page](https://example.org/b) and https://example.org/c.' }
				],
				title: 'https://en.wikipedia.org/wiki/Cris_(research)'
			},
			'src/content/entities/x.yaml'
		);
		expect(found.map((f) => f.url)).toEqual([
			'https://example.org/a',
			'https://www.wikidata.org/wiki/Q42',
			'https://example.org/b',
			'https://example.org/c',
			'https://en.wikipedia.org/wiki/Cris_(research)'
		]);
		expect(found[1]!.usage).toEqual({
			file: 'src/content/entities/x.yaml',
			path: 'sources[0].url'
		});
	});

	it('trims only what is not part of the address', () => {
		expect(trimUrl('https://example.org/a).')).toBe('https://example.org/a');
		expect(trimUrl('https://example.org/Foo_(bar)')).toBe('https://example.org/Foo_(bar)');
		expect(trimUrl('https://example.org/Foo_(bar)),')).toBe('https://example.org/Foo_(bar)');
	});

	it('ignores non-strings and bare schemes', () => {
		expect(urlsInValue({ n: 3, d: null, s: 'https://', t: 'no link here' }, 'f')).toEqual([]);
	});

	it('deduplicates across files, sorts by url and keeps every usage', () => {
		const entries = collectUrls([
			{
				file: 'b.yaml',
				data: { url: 'https://example.org/z', other: 'https://example.org/a#frag' }
			},
			{ file: 'a.yaml', data: { url: 'https://example.org/a' } }
		]);
		expect(entries.map((e) => e.url)).toEqual(['https://example.org/a', 'https://example.org/z']);
		expect(entries[0]!.usages.map((u) => u.file).sort()).toEqual(['a.yaml', 'b.yaml']);
	});
});

describe('classifying answers', () => {
	const ok = { status: 200, url: 'https://a.org/x', redirected: false };
	it('maps statuses to the groups of the report', () => {
		expect(classify('https://a.org/x', ok).status).toBe('ok');
		expect(classify('https://a.org/x', { ...ok, status: 404 }).status).toBe('broken');
		expect(classify('https://a.org/x', { ...ok, status: 410 }).status).toBe('broken');
		for (const status of [401, 403, 429, 999]) {
			expect(classify('https://a.org/x', { ...ok, status }).status).toBe('blocked');
		}
		expect(classify('https://a.org/x', { ...ok, status: 451 }).status).toBe('client-error');
		expect(classify('https://a.org/x', { ...ok, status: 503 }).status).toBe('server-error');
	});

	it('reports a redirect to another host as moved, and one inside the host as ok', () => {
		expect(
			classify('https://a.org/x', { status: 200, url: 'https://b.org/y', redirected: true })
		).toMatchObject({
			status: 'moved',
			finalUrl: 'https://b.org/y'
		});
		expect(
			classify('https://a.org/x', { status: 200, url: 'https://a.org/y', redirected: true }).status
		).toBe('ok');
	});

	it('treats www and the bare host as one site', () => {
		const moved = (from: string, to: string) =>
			classify(from, { status: 200, url: to, redirected: true }).status;
		expect(moved('https://cambia.org/', 'https://www.cambia.org/')).toBe('ok');
		expect(moved('https://www.doi.org/x', 'https://doi.org/x')).toBe('ok');
		expect(moved('https://www.a.org/x', 'https://www.b.org/x')).toBe('moved');
	});

	it('does not call a persistent-identifier resolver moved for doing its job', () => {
		for (const from of [
			'https://doi.org/10.1/x',
			'https://hdl.handle.net/1/2',
			'https://w3id.org/x',
			'https://purl.org/x'
		]) {
			expect(
				classify(from, { status: 200, url: 'https://publisher.org/a', redirected: true }).status
			).toBe('ok');
		}
	});
});

describe('checking one url', () => {
	const url = 'https://example.org/page';

	it('asks with HEAD and a generic user agent', async () => {
		const log: string[] = [];
		const result = await checkUrl(url, options(fakeFetch({}, log)));
		expect(result.status).toBe('ok');
		expect(log).toEqual([`HEAD ${url}`]);
	});

	it('falls back to GET when HEAD is refused, and trusts the GET', async () => {
		for (const refused of [403, 405, 501]) {
			const log: string[] = [];
			const result = await checkUrl(
				url,
				options(
					fakeFetch({ [`HEAD ${url}`]: { status: refused }, [`GET ${url}`]: { status: 200 } }, log)
				)
			);
			expect(result.status).toBe('ok');
			expect(log).toEqual([`HEAD ${url}`, `GET ${url}`]);
		}
	});

	it('keeps 403 as blocked when GET is refused too, without retrying a 4xx', async () => {
		const log: string[] = [];
		const result = await checkUrl(
			url,
			options(fakeFetch({ [`HEAD ${url}`]: { status: 403 }, [`GET ${url}`]: { status: 403 } }, log))
		);
		expect(result.status).toBe('blocked');
		expect(log).toHaveLength(2);
	});

	it('does not retry a 404', async () => {
		const log: string[] = [];
		const result = await checkUrl(
			url,
			options(fakeFetch({ [`HEAD ${url}`]: { status: 404 } }, log))
		);
		expect(result).toMatchObject({ status: 'broken', httpStatus: 404 });
		expect(log).toHaveLength(1);
	});

	it('retries a 5xx and recovers', async () => {
		const result = await checkUrl(
			url,
			options(fakeFetch({ [`HEAD ${url}`]: [{ status: 503 }, { status: 200 }] }))
		);
		expect(result.status).toBe('ok');
	});

	it('gives up on a 5xx after the retries', async () => {
		const log: string[] = [];
		const result = await checkUrl(
			url,
			options(fakeFetch({ [`HEAD ${url}`]: { status: 502 } }, log))
		);
		expect(result).toMatchObject({ status: 'server-error', httpStatus: 502 });
		expect(log).toHaveLength(3);
	});

	it('calls a domain that does not resolve broken, at once', async () => {
		const log: string[] = [];
		const error = withCode('fetch failed', 'ENOTFOUND');
		const result = await checkUrl(
			url,
			options(fakeFetch({ [`HEAD ${url}`]: error, [`GET ${url}`]: error }, log))
		);
		expect(result.status).toBe('broken');
		expect(result.error).toContain('ENOTFOUND');
		expect(log).toEqual([`HEAD ${url}`, `GET ${url}`]);
	});

	it('calls other network errors unreachable, after the retries', async () => {
		const error = withCode('fetch failed', 'ECONNRESET');
		const log: string[] = [];
		const result = await checkUrl(
			url,
			options(fakeFetch({ [`HEAD ${url}`]: error, [`GET ${url}`]: error }, log))
		);
		expect(result.status).toBe('unreachable');
		expect(log).toHaveLength(6);
	});

	it('reports a timeout as unreachable', async () => {
		const hanging = ((_: unknown, init?: RequestInit) =>
			new Promise((_, reject) => {
				init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
			})) as unknown as typeof fetch;
		const result = await checkUrl(url, { ...options(hanging), timeoutMs: 10, retries: 0 });
		expect(result.status).toBe('unreachable');
		expect(result.error).toContain('Timed out');
	});
});

describe('checking many urls', () => {
	it('keeps the input order', async () => {
		const urls = ['https://a.org/1', 'https://b.org/2', 'https://c.org/3'];
		const results = await checkLinks(urls, {
			...options(fakeFetch({ 'HEAD https://b.org/2': { status: 404 } })),
			concurrency: 3
		});
		expect(results.map((r) => [r.url, r.status])).toEqual([
			['https://a.org/1', 'ok'],
			['https://b.org/2', 'broken'],
			['https://c.org/3', 'ok']
		]);
	});

	it('never has two requests in flight to the same host, while other hosts run side by side', async () => {
		const active = new Map<string, number>();
		let peakSameHost = 0;
		let peakHosts = 0;
		const slow = (async (input: string | URL | Request) => {
			const host = new URL(String(input)).host;
			active.set(host, (active.get(host) ?? 0) + 1);
			peakSameHost = Math.max(peakSameHost, active.get(host)!);
			peakHosts = Math.max(peakHosts, [...active.values()].filter((n) => n > 0).length);
			await new Promise((resolve) => setTimeout(resolve, 5));
			active.set(host, active.get(host)! - 1);
			return {
				status: 200,
				url: String(input),
				redirected: false,
				body: null
			} as unknown as Response;
		}) as typeof fetch;
		const urls = [1, 2, 3, 4]
			.map((n) => `https://wikidata.org/wiki/Q${n}`)
			.concat([1, 2, 3].map((n) => `https://other${n}.org/x`));
		await checkLinks(urls, { ...options(slow), concurrency: 4 });
		expect(peakSameHost).toBe(1);
		expect(peakHosts).toBeGreaterThan(1);
	});

	it('returns nothing for nothing', async () => {
		expect(await checkLinks([], { ...options(fakeFetch({})), concurrency: 4 })).toEqual([]);
	});
});

describe('the report', () => {
	const usages = new Map([
		['https://a.org/gone', [{ file: 'src/content/entities/x.yaml', path: 'url' }]],
		['https://b.org/blocked', [{ file: 'src/content/entities/y.yaml', path: 'sources[0].url' }]],
		['https://c.org/ok', [{ file: 'src/content/entities/z.yaml', path: 'url' }]]
	]);
	const today = new Date('2026-11-15T10:00:00Z');

	it('says there are no findings when only blocked sites remain, and still lists them', () => {
		const results: LinkResult[] = [
			{ url: 'https://b.org/blocked', status: 'blocked', httpStatus: 403 },
			{ url: 'https://c.org/ok', status: 'ok', httpStatus: 200 }
		];
		const { markdown, hasFindings } = formatLinkReport({ results, usages, today });
		expect(hasFindings).toBe(false);
		expect(markdown).toContain('# Link check report 2026-11-15');
		expect(markdown).toContain('No findings.');
		expect(markdown).toContain('Blocked to automated requests (1)');
		expect(markdown).toContain(
			'https://b.org/blocked: HTTP 403 (used in src/content/entities/y.yaml sources[0].url)'
		);
	});

	it('lists what needs attention with where it is used', () => {
		const results: LinkResult[] = [
			{ url: 'https://a.org/gone', status: 'broken', httpStatus: 404 },
			{ url: 'https://c.org/ok', status: 'ok', httpStatus: 200 }
		];
		const { markdown, hasFindings } = formatLinkReport({ results, usages, today });
		expect(hasFindings).toBe(true);
		expect(markdown).not.toContain('No findings.');
		expect(markdown).toContain('## Gone (1)');
		expect(markdown).toContain(
			'https://a.org/gone: HTTP 404 (used in src/content/entities/x.yaml url)'
		);
		expect(markdown).toContain(
			'Links checked: 2. ok: 1. Needing attention: 1. Blocked to automated requests: 0.'
		);
	});

	it('shortens a long list of places and a long error', () => {
		const many = Array.from({ length: 6 }, (_, i) => ({ file: `f${i}.yaml`, path: 'url' }));
		const { markdown } = formatLinkReport({
			results: [{ url: 'https://a.org/gone', status: 'unreachable', error: 'x'.repeat(1000) }],
			usages: new Map([['https://a.org/gone', many]]),
			today
		});
		expect(markdown).toContain('and 3 more');
		expect(markdown).not.toContain('x'.repeat(301));
	});
});

// Link check for the content. Framework-free: the HTTP client is injected, so the logic runs
// without a network in tests. Only HEAD and GET requests are ever made; nothing is submitted to
// any third-party service.

export type UrlUsage = { file: string; path: string };
export type UrlEntry = { url: string; usages: UrlUsage[] };

/**
 * ok: answered 2xx.
 * moved: answered 2xx, but after a redirect to another host.
 * broken: the page is gone (404, 410) or the domain does not resolve.
 * blocked: the site refuses automated requests or rate-limits them (401, 403, 429, 999). Usually
 *   the page works in a browser; check by hand, do not count as broken.
 * client-error: another 4xx.
 * server-error: 5xx after the retries.
 * unreachable: timeout or network error after the retries (often temporary).
 */
export type LinkStatus =
	'ok' | 'moved' | 'broken' | 'blocked' | 'client-error' | 'server-error' | 'unreachable';

export type LinkResult = {
	url: string;
	status: LinkStatus;
	httpStatus?: number;
	finalUrl?: string;
	error?: string;
};

export type CheckOptions = {
	fetch: typeof fetch;
	timeoutMs: number;
	retries: number;
	userAgent: string;
	/** Pause between attempts of one url. Defaults to 0. */
	retryDelayMs?: number;
};

export type CheckAllOptions = CheckOptions & {
	/** Hosts checked at the same time. A single host is always checked one url at a time. */
	concurrency: number;
	/** Pause between two requests to the same host. Defaults to 0. */
	hostDelayMs?: number;
};

// ---------------------------------------------------------------------------------------------
// collectUrls

const URL_IN_TEXT = /https?:\/\/[^\s<>"'`\]]+/g;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;

/**
 * The url inside a matched run of text: trailing punctuation goes, and so does a closing bracket
 * that has no opening one in the url (the end of a Markdown link), while a balanced pair stays
 * (https://en.wikipedia.org/wiki/Foo_(bar)).
 */
export function trimUrl(text: string): string {
	let url = text;
	for (;;) {
		const before = url;
		url = url.replace(TRAILING_PUNCTUATION, '');
		while (url.endsWith(')') && url.split(')').length > url.split('(').length)
			url = url.slice(0, -1);
		if (url === before) return url;
	}
}

/** The part of a url that is sent: without the fragment. */
export function withoutFragment(url: string): string {
	const index = url.indexOf('#');
	return index === -1 ? url : url.slice(0, index);
}

/** Every http(s) url in the string values of a parsed YAML document, with where it was found. */
export function urlsInValue(
	value: unknown,
	file: string,
	path = ''
): { url: string; usage: UrlUsage }[] {
	const out: { url: string; usage: UrlUsage }[] = [];
	if (typeof value === 'string') {
		for (const match of value.matchAll(URL_IN_TEXT)) {
			const url = withoutFragment(trimUrl(match[0]));
			if (url.length > 'https://'.length) out.push({ url, usage: { file, path } });
		}
	} else if (Array.isArray(value)) {
		value.forEach((item, index) => out.push(...urlsInValue(item, file, `${path}[${index}]`)));
	} else if (value && typeof value === 'object') {
		for (const [key, item] of Object.entries(value)) {
			out.push(...urlsInValue(item, file, path ? `${path}.${key}` : key));
		}
	}
	return out;
}

/** Deduplicated by url (fragments dropped), sorted by url, with every place the url is used. */
export function collectUrls(documents: { file: string; data: unknown }[]): UrlEntry[] {
	const byUrl = new Map<string, UrlUsage[]>();
	for (const { file, data } of documents) {
		for (const { url, usage } of urlsInValue(data, file)) {
			const list = byUrl.get(url);
			if (list) list.push(usage);
			else byUrl.set(url, [usage]);
		}
	}
	return [...byUrl.entries()]
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([url, usages]) => ({ url, usages }));
}

/** The host of a url, lower case and without a leading `www.` (www and bare are the same site). */
export function hostOf(url: string): string {
	try {
		return new URL(url).host.toLowerCase().replace(/^www\./, '');
	} catch {
		return '';
	}
}

/** Resolvers and redirectors whose job is to send you to another site: that is not a move. */
const REDIRECTING_HOSTS = new Set([
	'doi.org',
	'dx.doi.org',
	'hdl.handle.net',
	'w3id.org',
	'purl.org'
]);

// ---------------------------------------------------------------------------------------------
// checkUrl

const GET_FALLBACK_STATUSES = new Set([403, 405, 501]);
const BLOCKED_STATUSES = new Set([401, 403, 429, 999]);
const GONE_STATUSES = new Set([404, 410]);
const DNS_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN']);

type Attempt = { result: LinkResult; retry: boolean };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function errorCode(error: unknown): string | undefined {
	if (!(error instanceof Error)) return undefined;
	const cause = (error as { cause?: unknown }).cause;
	if (cause && typeof cause === 'object' && 'code' in cause)
		return String((cause as { code: unknown }).code);
	return undefined;
}

function describeError(error: unknown): string {
	if (error instanceof Error) {
		const code = errorCode(error);
		return code && !error.message.includes(code) ? `${error.message} (${code})` : error.message;
	}
	return String(error);
}

export function classify(
	url: string,
	response: Pick<Response, 'status' | 'url' | 'redirected'>
): LinkResult {
	const httpStatus = response.status;
	if (httpStatus >= 200 && httpStatus < 300) {
		if (
			response.redirected &&
			response.url &&
			!REDIRECTING_HOSTS.has(hostOf(url)) &&
			hostOf(response.url) !== hostOf(url)
		) {
			return { url, status: 'moved', httpStatus, finalUrl: response.url };
		}
		return { url, status: 'ok', httpStatus };
	}
	if (BLOCKED_STATUSES.has(httpStatus)) return { url, status: 'blocked', httpStatus };
	if (httpStatus >= 500) return { url, status: 'server-error', httpStatus };
	if (GONE_STATUSES.has(httpStatus)) return { url, status: 'broken', httpStatus };
	return { url, status: 'client-error', httpStatus };
}

async function request(
	url: string,
	method: 'HEAD' | 'GET',
	options: CheckOptions
): Promise<{ response: Response } | { error: unknown; timedOut: boolean }> {
	const controller = new AbortController();
	let timedOut = false;
	const timer = setTimeout(() => {
		timedOut = true;
		controller.abort(new Error(`Timed out after ${options.timeoutMs} ms`));
	}, options.timeoutMs);
	try {
		const response = await options.fetch(url, {
			method,
			redirect: 'follow',
			headers: { 'user-agent': options.userAgent },
			signal: controller.signal
		});
		// Only the status line matters: release the connection without reading the body.
		try {
			await response.body?.cancel();
		} catch {
			// ignored
		}
		return { response };
	} catch (error) {
		return { error, timedOut };
	} finally {
		clearTimeout(timer);
	}
}

async function attempt(url: string, options: CheckOptions): Promise<Attempt> {
	let outcome = await request(url, 'HEAD', options);
	// A timeout is retried as a whole instead of repeating the request as GET.
	const timedOutOnHead = 'error' in outcome && outcome.timedOut;
	const needsGet =
		!timedOutOnHead && ('error' in outcome || GET_FALLBACK_STATUSES.has(outcome.response.status));
	if (needsGet) outcome = await request(url, 'GET', options);

	if ('error' in outcome) {
		const code = errorCode(outcome.error);
		if (!outcome.timedOut && code && DNS_CODES.has(code)) {
			// The domain does not resolve: retrying does not help, and the link is dead.
			return {
				result: { url, status: 'broken', error: describeError(outcome.error) },
				retry: false
			};
		}
		return {
			result: { url, status: 'unreachable', error: describeError(outcome.error) },
			retry: true
		};
	}
	const result = classify(url, outcome.response);
	return { result, retry: result.status === 'server-error' };
}

/** Checks one URL. Never throws. 4xx is final; 5xx, timeouts and network errors are retried. */
export async function checkUrl(url: string, options: CheckOptions): Promise<LinkResult> {
	let last: LinkResult = { url, status: 'unreachable', error: 'No request made' };
	for (let index = 0; index <= options.retries; index += 1) {
		if (index > 0 && options.retryDelayMs) await sleep(options.retryDelayMs);
		let next: Attempt;
		try {
			next = await attempt(url, options);
		} catch (error) {
			next = { result: { url, status: 'unreachable', error: describeError(error) }, retry: true };
		}
		last = next.result;
		if (!next.retry) break;
	}
	return last;
}

/**
 * Checks every URL. Different hosts run side by side (at most `concurrency`); the urls of one host
 * run one after the other with `hostDelayMs` between them, so a host such as wikidata.org, with
 * dozens of links, is never hit in parallel. Results keep the input order.
 */
export async function checkLinks(urls: string[], options: CheckAllOptions): Promise<LinkResult[]> {
	const results: LinkResult[] = new Array(urls.length);
	const queues = new Map<string, number[]>();
	urls.forEach((url, index) => {
		const host = hostOf(url);
		const queue = queues.get(host);
		if (queue) queue.push(index);
		else queues.set(host, [index]);
	});
	const hosts = [...queues.keys()];
	let nextHost = 0;
	const worker = async () => {
		while (nextHost < hosts.length) {
			const queue = queues.get(hosts[nextHost++]!)!;
			for (let position = 0; position < queue.length; position += 1) {
				if (position > 0 && options.hostDelayMs) await sleep(options.hostDelayMs);
				const index = queue[position]!;
				results[index] = await checkUrl(urls[index]!, options);
			}
		}
	};
	const workers = Math.max(1, Math.min(Math.floor(options.concurrency), hosts.length));
	await Promise.all(Array.from({ length: hosts.length === 0 ? 0 : workers }, worker));
	return results;
}

// ---------------------------------------------------------------------------------------------
// formatLinkReport

export const REPORT_NOTE =
	'A 200 answer does not prove that the page still says what the entry cites; the last review date of each entry is checked by `npm run validate` (I26). "Blocked" means the site refuses automated requests, which says nothing about the page: open it in a browser.';

export type LinkReportInput = {
	results: LinkResult[];
	usages: Map<string, UrlUsage[]> | Record<string, UrlUsage[]>;
	today: Date;
};

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const clean = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, 300);

const MAX_PLACES = 3;

function placesOf(usages: UrlUsage[]): string {
	const places = usages
		.map((usage) => `${usage.file}${usage.path ? ` ${usage.path}` : ''}`)
		.sort(byString);
	const shown = places.slice(0, MAX_PLACES).join('; ');
	return places.length > MAX_PLACES ? `${shown}; and ${places.length - MAX_PLACES} more` : shown;
}

const SECTIONS: { status: LinkStatus; title: string; help: string }[] = [
	{
		status: 'broken',
		title: 'Gone',
		help: 'The page answers 404 or 410, or the domain does not resolve. Replace or remove the source.'
	},
	{
		status: 'moved',
		title: 'Moved to another host',
		help: 'The link works but ends on another site. Update the url if the new address is the right one.'
	},
	{
		status: 'client-error',
		title: 'Other client errors',
		help: 'The site answered with another 4xx. Open the link to see why.'
	},
	{
		status: 'server-error',
		title: 'Server errors',
		help: 'The site answered 5xx on every try. Often temporary: see if it is still there next week.'
	},
	{
		status: 'unreachable',
		title: 'Unreachable',
		help: 'Timeout or network error on every try. Often temporary: see if it is still there next week.'
	}
];

export function formatLinkReport(input: LinkReportInput): {
	markdown: string;
	hasFindings: boolean;
} {
	const lookup = (url: string): UrlUsage[] =>
		(input.usages instanceof Map ? input.usages.get(url) : input.usages[url]) ?? [];
	const line = (result: LinkResult) => {
		const parts: string[] = [];
		if (result.httpStatus !== undefined) parts.push(`HTTP ${result.httpStatus}`);
		if (result.finalUrl) parts.push(`ends at ${clean(result.finalUrl)}`);
		if (result.error) parts.push(clean(result.error));
		const detail = parts.length > 0 ? `: ${parts.join(', ')}` : '';
		return `- ${clean(result.url)}${detail} (used in ${placesOf(lookup(result.url))})`;
	};
	const sorted = (status: LinkStatus) =>
		input.results
			.filter((result) => result.status === status)
			.sort((a, b) => byString(a.url, b.url));

	const count = (status: LinkStatus) => input.results.filter((r) => r.status === status).length;
	const findings = SECTIONS.reduce((sum, section) => sum + count(section.status), 0);
	const blocked = sorted('blocked');
	const today = input.today.toISOString().slice(0, 10);

	const lines: string[] = [`# Link check report ${today}`, ''];
	lines.push(
		`Links checked: ${input.results.length}. ok: ${count('ok')}. Needing attention: ${findings}. Blocked to automated requests: ${blocked.length}.`,
		''
	);
	if (findings === 0) lines.push('No findings.', '');

	for (const section of SECTIONS) {
		const rows = sorted(section.status);
		if (rows.length === 0) continue;
		lines.push(`## ${section.title} (${rows.length})`, '', section.help, '');
		for (const row of rows) lines.push(line(row));
		lines.push('');
	}

	if (blocked.length > 0) {
		lines.push(
			`## Blocked to automated requests (${blocked.length})`,
			'',
			'These sites refuse or rate-limit scripts (401, 403, 429). They are not counted as findings. Open a few by hand now and then.',
			'',
			'<details><summary>List</summary>',
			''
		);
		for (const row of blocked) lines.push(line(row));
		lines.push('', '</details>', '');
	}

	lines.push(REPORT_NOTE, '');
	return { markdown: lines.join('\n'), hasFindings: findings > 0 };
}

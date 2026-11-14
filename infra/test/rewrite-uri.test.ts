import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';

// Load the CloudFront Function source exactly as deployed and evaluate it in plain JS.
const source = fs.readFileSync(path.join(__dirname, '../cloudfront-fn/rewrite-uri.js'), 'utf8');

type Request = {
	uri: string;
	headers?: Record<string, unknown>;
	querystring?: Record<string, { value: string; multiValue?: { value: string }[] }>;
};
type Redirect = {
	statusCode: number;
	statusDescription: string;
	headers: { location: { value: string } };
};
const handler = new Function(`${source}\nreturn handler;`)() as (event: {
	request: Request;
}) => Request | Redirect;

function rewrite(uri: string): string {
	return (handler({ request: { uri, headers: {}, querystring: {} } }) as Request).uri;
}

describe('rewrite-uri.js CloudFront Function', () => {
	it.each([
		['/', '/index.html'],
		['/es/', '/es/index.html'],
		['/en/about/', '/en/about/index.html'],
		['/es/entity/doi/', '/es/entity/doi/index.html'],
		['/es/__data.json', '/es/__data.json'],
		['/data/graph.json', '/data/graph.json'],
		['/search-index-es.json', '/search-index-es.json'],
		['/favicon.svg', '/favicon.svg'],
		['/consent-loader.js', '/consent-loader.js'],
		['/_app/immutable/entry/start.js', '/_app/immutable/entry/start.js'],
		['/sitemap.xml', '/sitemap.xml'],
		['/robots.txt', '/robots.txt'],
		['/404.html', '/404.html']
	])('maps %s to %s', (input, expected) => {
		expect(rewrite(input)).toBe(expected);
	});

	it.each([
		['/es', '/es/'],
		['/en/about', '/en/about/'],
		['/es/entity/doi', '/es/entity/doi/']
	])('redirects %s to %s with a 301', (input, location) => {
		const result = handler({ request: { uri: input, querystring: {} } }) as Redirect;
		expect(result.statusCode).toBe(301);
		expect(result.statusDescription).toBe('Moved Permanently');
		expect(result.headers.location.value).toBe(location);
	});

	it('keeps the query string on the redirect', () => {
		const result = handler({
			request: {
				uri: '/es',
				querystring: {
					nodo: { value: 'doi' },
					vista: { value: '' },
					tag: { value: 'a', multiValue: [{ value: 'a' }, { value: 'b' }] }
				}
			}
		}) as Redirect;
		expect(result.headers.location.value).toBe('/es/?nodo=doi&vista&tag=a&tag=b');
	});

	it('works when the request has no querystring object', () => {
		const result = handler({ request: { uri: '/es' } }) as Redirect;
		expect(result.headers.location.value).toBe('/es/');
	});

	it('returns the request object (not a response) for a mapped URI so CloudFront forwards it', () => {
		const request = { uri: '/es/', headers: { host: { value: 'oee.example.test' } } };
		const result = handler({ request }) as unknown as typeof request;
		expect(result.headers.host.value).toBe('oee.example.test');
		expect(result.uri).toBe('/es/index.html');
	});

	it('only emits URIs that exist in the static build for the documented routes', () => {
		const build = path.join(__dirname, '../../build');
		for (const route of [
			'/',
			'/es/',
			'/en/',
			'/es/about/',
			'/en/glossary/',
			'/es/views/',
			'/en/entity/doi/',
			'/es/__data.json',
			'/data/graph.json',
			'/sitemap.xml'
		]) {
			const target = rewrite(route);
			expect(fs.existsSync(path.join(build, target)), `${route} -> ${target}`).toBe(true);
		}
	});
});

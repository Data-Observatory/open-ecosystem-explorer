import { describe, expect, it } from 'vitest';
import {
	filterFromQuery,
	filterToQuery,
	fold,
	matchesFilter
} from '../../../src/lib/glossary-filter.js';
import { legacyPaths, legacyTarget } from '../../../src/lib/legacy-routes.js';
import { pagePath, switchLocalePath, absoluteUrl } from '../../../src/lib/locale.js';
import { buildUrlPatterns } from '../../../src/lib/url-patterns.js';
import {
	entityPage,
	glossary,
	indexLetter,
	questionPage,
	storyPage,
	wikipediaUrl
} from '../../../src/lib/server/site.js';

const words = { yes: 'yes', no: 'no', related: 'Related to', governance: (v: string) => v };

describe('glossary filter', () => {
	const entry = { type: 'identifier', search: fold('Índice de citas DOI') };
	it('folds case and accents', () => {
		expect(matchesFilter(entry, { query: 'indice', types: [] })).toBe(true);
		expect(matchesFilter(entry, { query: 'ÍNDICE doi', types: [] })).toBe(true);
		expect(matchesFilter(entry, { query: 'orcid', types: [] })).toBe(false);
	});
	it('filters by type', () => {
		expect(matchesFilter(entry, { query: '', types: ['identifier'] })).toBe(true);
		expect(matchesFilter(entry, { query: '', types: ['index'] })).toBe(false);
	});
	it('round-trips through the query string and drops unknown types', () => {
		const params = new URLSearchParams('q=doi&type=identifier,bogus');
		const filter = filterFromQuery(params, ['identifier', 'index']);
		expect(filter).toEqual({ query: 'doi', types: ['identifier'] });
		expect(filterToQuery(filter).toString()).toBe('q=doi&type=identifier');
		expect(filterToQuery({ query: ' ', types: [] }).toString()).toBe('');
	});
});

describe('locale paths', () => {
	it('builds page paths with a trailing slash under the base path', () => {
		expect(pagePath('', 'es')).toBe('/es/');
		expect(pagePath('', 'en', 'entity/doi')).toBe('/en/entity/doi/');
		expect(pagePath('/eco', 'es', '/glossary/')).toBe('/eco/es/glossary/');
	});
	it('switches the locale segment and keeps the rest', () => {
		expect(switchLocalePath('', '/es/entity/doi/', 'en')).toBe('/en/entity/doi/');
		expect(switchLocalePath('/eco', '/eco/en/', 'es')).toBe('/eco/es/');
		expect(switchLocalePath('', '/data/graph.json', 'en')).toBe('/en/');
	});
	it('makes URLs absolute only when a site URL is configured', () => {
		expect(absoluteUrl('', '/es/')).toBe('/es/');
		expect(absoluteUrl('https://example.org/', '/es/')).toBe('https://example.org/es/');
	});
	it('prefixes every locale in the Paraglide URL patterns', () => {
		expect(buildUrlPatterns('')[0]?.localized).toEqual([
			['es', '/es'],
			['en', '/en']
		]);
	});
});

describe('legacy routes', () => {
	const vocab = { entityTypes: ['identifier'], tags: ['open'], predicates: ['owned-by'] };
	it('maps every old route to a page of the new structure', () => {
		expect(legacyTarget('entities', vocab)).toEqual({ path: 'glossary' });
		expect(legacyTarget('entities/identifier', vocab)?.query).toBe('type=identifier');
		expect(legacyTarget('relations/owned-by/', vocab)).toEqual({ path: 'about', hash: 'model' });
		expect(legacyTarget('search', vocab)?.keepQuery).toBe(true);
		expect(legacyTarget('map2', vocab)).toEqual({ path: '' });
		expect(legacyTarget('entities/bogus', vocab)).toBeUndefined();
		expect(legacyTarget('glossary', vocab)).toBeUndefined();
	});
	it('lists each legacy path once, sorted', () => {
		const paths = legacyPaths(vocab);
		expect(paths).toEqual([...new Set(paths)].sort());
		expect(paths).toContain('tags/open');
	});
});

describe('page view models (real content)', () => {
	it('glossary is sorted A-Z with letters and type counts', async () => {
		const data = await glossary('es');
		const names = data.entries.map((e) => e.name);
		expect(names).toEqual(
			[...names].sort(new Intl.Collator('es', { sensitivity: 'base', numeric: true }).compare)
		);
		expect(data.types.reduce((sum, t) => sum + t.count, 0)).toBe(data.entries.length);
		expect(indexLetter('Índice')).toBe('I');
		expect(indexLetter('3D')).toBe('#');
	});

	it('entity page has relations as sentences, no duplicated symmetric edges, and links', async () => {
		const doi = await entityPage('doi', 'en', words);
		expect(doi?.typeLabel).toBe('Identifier');
		const sentences = doi!.relations.flatMap((g) => g.sentences);
		expect(sentences.some((s) => !s.selfIsSubject && s.other.id === 'crossref')).toBe(true);
		const keys = sentences.map((s) => `${s.selfIsSubject}|${s.verb}|${s.other.id}`);
		expect(keys).toEqual([...new Set(keys)]);
		expect(doi!.links[0]).toEqual({ kind: 'website', href: expect.stringMatching(/^https:/) });
		expect(await entityPage('no-such-entity', 'en', words)).toBeUndefined();
	});

	it('Wikipedia links resolve through Wikidata in the reader language', () => {
		expect(wikipediaUrl('Q25670', 'es')).toBe(
			'https://www.wikidata.org/wiki/Special:GoToLinkedPage/eswiki/Q25670'
		);
	});

	it('question and story pages resolve', async () => {
		const view = await questionPage('vertical-integration', 'es', (v) => v);
		expect(view?.sentences.length).toBeGreaterThan(0);
		const story = await storyPage('what-is-a-doi', 'en');
		expect(story?.stepList.length).toBe(story?.steps);
		expect(story?.stepList[0]?.entities[0]?.id).toBe('doi');
	});
});

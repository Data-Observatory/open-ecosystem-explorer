import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { NEW_ISSUE_CHOOSER_URL, REPO_URL, entryIssueUrl } from '../../../src/lib/repo.js';

const templates = join(__dirname, '../../../.github/ISSUE_TEMPLATE');
const forms = readdirSync(templates).filter((f) => f !== 'config.yml');
type Field = {
	type: string;
	id?: string;
	attributes?: { options?: string[] };
	validations?: { required?: boolean };
};
type Vocab = Record<string, { label: { en: string; es: string } }>;
const vocab = (name: string) =>
	parse(readFileSync(join(__dirname, `../../../src/content/vocab/${name}.yaml`), 'utf8')) as Vocab;
const load = (f: string) => parse(readFileSync(join(templates, f), 'utf8'));
const fields = (f: string) => (load(f).body as Field[]).filter((b) => b.type !== 'markdown');

describe('issue links', () => {
	it('points to the public repository', () => {
		expect(REPO_URL).toBe('https://github.com/Data-Observatory/open-ecosystem-explorer');
		expect(NEW_ISSUE_CHOOSER_URL).toBe(`${REPO_URL}/issues/new/choose`);
	});

	it.each([
		['description', 'description.yml', '[Description]', 'entity'],
		['connection', 'connection.yml', '[Connection]', 'entity_a']
	] as const)(
		'prefills the %s form with the entry id and name, and nothing else',
		(kind, template, prefix, field) => {
			const url = new URL(entryIssueUrl(kind, 'doi', 'DOI (Digital Object Identifier)'));
			expect(url.origin + url.pathname).toBe(`${REPO_URL}/issues/new`);
			expect([...url.searchParams.keys()].sort()).toEqual([field, 'template', 'title'].sort());
			expect(url.searchParams.get(field)).toBe('doi');
			expect(url.searchParams.get('template')).toBe(template);
			expect(url.searchParams.get('title')).toBe(`${prefix} DOI (Digital Object Identifier)`);
			// The prefilled field is a field of the form, and the title matches its prefix.
			expect(fields(template).map((b) => b.id)).toContain(field);
			expect(load(template).title).toBe(`${prefix} `);
		}
	);

	it('escapes an entry name that carries URL syntax', () => {
		const url = new URL(entryIssueUrl('description', 'a&b', 'x&template=other#frag'));
		expect(url.searchParams.get('template')).toBe('description.yml');
		expect(url.searchParams.get('entity')).toBe('a&b');
		expect(url.hash).toBe('');
	});
});

describe('issue forms', () => {
	it('has six forms and a chooser that blocks blank issues', () => {
		expect([...forms].sort()).toEqual([
			'bug-report.yml',
			'connection.yml',
			'description.yml',
			'idea.yml',
			'new-entry.yml',
			'remove-entry.yml'
		]);
		const config = load('config.yml');
		expect(config.blank_issues_enabled).toBe(false);
	});

	it.each(forms)(
		'%s has a bilingual name, a description, a title prefix, one label and unique field ids',
		(f) => {
			const form = load(f);
			expect(form.name).toMatch(/ \/ /);
			expect(form.description).toBeTruthy();
			expect(form.title).toMatch(/^\[\w+\] $/);
			expect(form.labels).toHaveLength(1);
			const ids = fields(f).map((b) => b.id);
			expect(new Set(ids).size).toBe(ids.length);
			expect(ids.every(Boolean)).toBe(true);
		}
	);

	it.each(forms)('%s tells people that issues are public', (f) => {
		const markdown = (load(f).body as { type: string; attributes: { value: string } }[])
			.filter((b) => b.type === 'markdown')
			.map((b) => b.attributes.value)
			.join('\n');
		expect(markdown).toMatch(/public/);
		expect(markdown).toMatch(/públicas/);
	});

	it.each(forms)('%s dropdown options are unique, bilingual and have no commas', (f) => {
		for (const b of fields(f).filter((x) => x.type === 'dropdown')) {
			const options = b.attributes?.options ?? [];
			expect(new Set(options).size).toBe(options.length);
			for (const o of options) {
				expect(o, o).toMatch(/ \/ /);
				expect(o, o).not.toContain(',');
			}
		}
	});

	it('asks for a source when proposing a new entry', () => {
		const source = fields('new-entry.yml').find((b) => b.id === 'source');
		expect(source?.validations?.required).toBe(true);
	});

	it('the connection form offers every predicate of the vocabulary, in both languages', () => {
		const relation = fields('connection.yml').find((b) => b.id === 'relation');
		const options = (relation?.attributes?.options ?? []).join('\n');
		const predicates = vocab('predicates');
		for (const [id, p] of Object.entries(predicates)) {
			expect(options, id).toContain(`${p.label.en}`.split(' (')[0]);
			expect(options, id).toContain(`${p.label.es}`);
		}
	});

	it('the new entry form offers every entity type of the vocabulary, in both languages', () => {
		const kind = fields('new-entry.yml').find((b) => b.id === 'kind');
		const options = (kind?.attributes?.options ?? []).join('\n').toLowerCase();
		const entityTypes = vocab('entity-types');
		expect(Object.keys(entityTypes).length).toBeGreaterThan(0);
		for (const [id, t] of Object.entries(entityTypes)) {
			expect(options, id).toContain(t.label.en.toLowerCase().split(' ')[0]);
			expect(options, id).toContain(t.label.es.toLowerCase().split(' ')[0]);
		}
	});
});

describe('no contact email', () => {
	it('is not published in the forms, the pages or the docs', () => {
		const root = join(__dirname, '../../..');
		const files = [
			...forms.map((f) => join(templates, f)),
			join(templates, 'config.yml'),
			join(root, 'src/lib/repo.ts'),
			join(root, 'messages/en.json'),
			join(root, 'messages/es.json'),
			join(root, 'src/routes/[locale=locale]/about/+page.svelte'),
			join(root, 'README.md'),
			join(root, 'CONTRIBUTING.md')
		];
		for (const f of files) {
			expect(readFileSync(f, 'utf8'), f).not.toMatch(/@dataobservatory|mailto:/i);
		}
	});
});

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { NEW_ISSUE_CHOOSER_URL, REPO_URL, changeEntryIssueUrl } from '../../../src/lib/repo.js';

const templates = join(__dirname, '../../../.github/ISSUE_TEMPLATE');
const forms = readdirSync(templates).filter((f) => f !== 'config.yml');
type Field = { type: string; id?: string; validations?: { required?: boolean } };

describe('issue links', () => {
	it('points to the public repository', () => {
		expect(REPO_URL).toBe('https://github.com/Data-Observatory/open-ecosystem-explorer');
		expect(NEW_ISSUE_CHOOSER_URL).toBe(`${REPO_URL}/issues/new/choose`);
	});

	it('prefills the change form with the entry id and name, and nothing else', () => {
		const url = new URL(changeEntryIssueUrl('doi', 'DOI (Digital Object Identifier)'));
		expect(url.origin + url.pathname).toBe(`${REPO_URL}/issues/new`);
		expect([...url.searchParams.keys()].sort()).toEqual(['entity', 'template', 'title']);
		expect(url.searchParams.get('entity')).toBe('doi');
		expect(url.searchParams.get('template')).toBe('change-entry.yml');
		expect(url.searchParams.get('title')).toBe('[Change] DOI (Digital Object Identifier)');
	});

	it('escapes an entry name that carries URL syntax', () => {
		const url = new URL(changeEntryIssueUrl('a&b', 'x&template=other#frag'));
		expect(url.searchParams.get('template')).toBe('change-entry.yml');
		expect(url.searchParams.get('entity')).toBe('a&b');
		expect(url.hash).toBe('');
	});
});

describe('issue forms', () => {
	it('has the four forms and a chooser that blocks blank issues', () => {
		expect(forms.sort()).toEqual([
			'add-entry.yml',
			'change-entry.yml',
			'remove-entry.yml',
			'site-feedback.yml'
		]);
		const config = parse(readFileSync(join(templates, 'config.yml'), 'utf8'));
		expect(config.blank_issues_enabled).toBe(false);
	});

	it.each(forms)(
		'%s has a name, a description, a title prefix, a label and unique field ids',
		(f) => {
			const form = parse(readFileSync(join(templates, f), 'utf8'));
			expect(form.name).toMatch(/ \/ /);
			expect(form.description).toBeTruthy();
			expect(form.title).toMatch(/^\[\w+\] $/);
			expect(form.labels).toHaveLength(1);
			const ids = (form.body as Field[]).filter((b) => b.type !== 'markdown').map((b) => b.id);
			expect(new Set(ids).size).toBe(ids.length);
			expect(ids.every(Boolean)).toBe(true);
		}
	);

	it('the change form has the entity field that the entry page link fills', () => {
		const form = parse(readFileSync(join(templates, 'change-entry.yml'), 'utf8'));
		const entity = (form.body as Field[]).find((b) => b.id === 'entity');
		expect(entity?.type).toBe('input');
		expect(entity?.validations?.required).toBe(true);
		expect(form.title).toBe('[Change] ');
	});

	it('asks for a source when adding an entry', () => {
		const form = parse(readFileSync(join(templates, 'add-entry.yml'), 'utf8'));
		const source = (form.body as Field[]).find((b) => b.id === 'source');
		expect(source?.validations?.required).toBe(true);
	});
});

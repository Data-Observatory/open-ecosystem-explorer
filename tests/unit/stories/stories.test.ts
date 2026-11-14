import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { buildIndex } from '../../../src/lib/graph/build-index.js';
import {
	zStory,
	STORY_STEP_MAX_WORDS,
	type Story,
	type StoryFileEntry
} from '../../../src/lib/stories/schema.js';
import { checkStories, countWords, edgeExists } from '../../../src/lib/stories/check.js';
import { loadRealVocab } from '../../fixtures/load-real-vocab.js';
import { loadRealEntities, loadRealProseMap } from '../../fixtures/load-real-content.js';

const ROOT = join(import.meta.dirname, '../../..');
const STORIES_DIR = join(ROOT, 'src/content/stories');

function realIndex() {
	const vocab = loadRealVocab();
	return buildIndex(
		loadRealEntities(),
		loadRealProseMap(),
		vocab.predicatesVocab,
		vocab.entityTypesVocab
	);
}
const index = realIndex();

const t = (es: string, en = es) => ({ es, en });

function story(patch: Partial<Story> = {}): Story {
	return zStory.parse({
		id: 'fx',
		title: t('Título', 'Title'),
		question: t('¿Pregunta?', 'Question?'),
		steps: [
			{ focus: 'doi', text: t('uno') },
			{
				focus: 'persistent-identifier',
				edges: [{ source: 'doi', predicate: 'is-a', target: 'persistent-identifier' }],
				text: t('dos')
			},
			{ focus: 'orcid', text: t('tres') }
		],
		...patch
	});
}

function entry(s: Story, id = s.id): StoryFileEntry {
	return { id, file: `src/content/stories/${id}.yaml`, story: s };
}

function rules(s: Story, id?: string): string[] {
	return checkStories([entry(s, id)], index).map((m) => m.ruleId);
}

describe('story schema', () => {
	it('accepts a minimal story and defaults reveal to []', () => {
		const s = story();
		expect(s.steps[0]!.reveal).toEqual([]);
	});

	it('requires every locale in title, question and step text (ES/EN parity)', () => {
		const raw = {
			id: 'fx',
			title: t('a'),
			question: t('b'),
			steps: [0, 1, 2].map(() => ({ focus: 'doi', text: { es: 'solo es' } }))
		};
		expect(zStory.safeParse(raw).success).toBe(false);
		expect(zStory.safeParse({ ...raw, title: { es: 'a' } }).success).toBe(false);
	});

	it('rejects unknown locales and unknown keys', () => {
		const base = {
			id: 'fx',
			title: t('a'),
			question: t('b'),
			steps: [0, 1, 2].map(() => ({ focus: 'doi', text: t('x') }))
		};
		expect(zStory.safeParse({ ...base, title: { es: 'a', en: 'a', fr: 'a' } }).success).toBe(false);
		expect(zStory.safeParse({ ...base, colour: 'red' }).success).toBe(false);
	});

	it('bounds the number of steps and the question length', () => {
		const steps = (n: number) => Array.from({ length: n }, () => ({ focus: 'doi', text: t('x') }));
		expect(
			zStory.safeParse({ id: 'fx', title: t('a'), question: t('b'), steps: steps(2) }).success
		).toBe(false);
		expect(
			zStory.safeParse({ id: 'fx', title: t('a'), question: t('b'), steps: steps(13) }).success
		).toBe(false);
		expect(
			zStory.safeParse({ id: 'fx', title: t('a'), question: t('x'.repeat(81)), steps: steps(3) })
				.success
		).toBe(false);
	});

	it('rejects an unknown predicate in an edge ref', () => {
		const s = {
			id: 'fx',
			title: t('a'),
			question: t('b'),
			steps: [0, 1, 2].map(() => ({
				focus: 'doi',
				text: t('x'),
				edges: [{ source: 'doi', predicate: 'owns', target: 'x' }]
			}))
		};
		expect(zStory.safeParse(s).success).toBe(false);
	});
});

describe('checkStories', () => {
	it('passes a well-formed story', () => {
		expect(rules(story())).toEqual([]);
	});

	it('ST1: id must equal the filename and be unique', () => {
		expect(rules(story(), 'other')).toEqual(['ST1']);
		const dup = checkStories(
			[entry(story()), { ...entry(story()), file: 'src/content/stories/copy.yaml' }],
			index
		);
		expect(dup.map((m) => m.ruleId)).toEqual(['ST1']);
	});

	it('ST2: every referenced id must be an entity', () => {
		const s = story();
		s.steps[1]!.reveal = ['no-such-entity'];
		s.steps[2]!.edges = [{ source: 'ghost', predicate: 'is-a', target: 'persistent-identifier' }];
		expect(rules(s)).toEqual(['ST2', 'ST2']);
		const f = story();
		f.steps[2]!.focus = 'ghost';
		expect(rules(f)).toEqual(['ST2']);
	});

	it('ST3: highlighted edges must exist; symmetric ones may be reversed', () => {
		const s = story();
		s.steps[1]!.edges = [{ source: 'persistent-identifier', predicate: 'is-a', target: 'doi' }];
		expect(rules(s)).toEqual(['ST3']);
		expect(edgeExists(index, { source: 'metadata', predicate: 'related-to', target: 'doi' })).toBe(
			true
		);
		expect(edgeExists(index, { source: 'doi', predicate: 'related-to', target: 'metadata' })).toBe(
			true
		);
		expect(
			edgeExists(index, { source: 'persistent-identifier', predicate: 'is-a', target: 'doi' })
		).toBe(false);
	});

	it('ST4: a focus must be shown or one edge from something shown', () => {
		const s = story();
		s.steps[2]!.focus = 'scopus';
		expect(rules(s)).toEqual(['ST4']);
	});

	it('ST4: a revealed entity must be one edge from what is shown', () => {
		const s = story();
		s.steps[1]!.reveal = ['ror', 'scopus', 'doi'];
		expect(rules(s)).toEqual(['ST4']);
	});

	it('ST4: a highlighted edge must join two shown entities', () => {
		const s = story();
		s.steps[1]!.edges = [{ source: 'orcid', predicate: 'is-a', target: 'persistent-identifier' }];
		expect(rules(s)).toEqual(['ST4']);
	});

	it('ST5: captions are limited per locale', () => {
		const s = story();
		s.steps[0]!.text = {
			es: 'corto',
			en: Array.from({ length: STORY_STEP_MAX_WORDS + 1 }, () => 'w').join(' ')
		};
		const msgs = checkStories([entry(s)], index);
		expect(msgs.map((m) => m.ruleId)).toEqual(['ST5']);
		expect(msgs[0]!.field).toBe('steps[0].text.en');
	});

	it('ST6: theme must be a known map theme', () => {
		expect(rules(story({ theme: 'identify' }))).toEqual([]);
		expect(rules(story({ theme: 'nope' }))).toEqual(['ST6']);
	});

	it('counts words on whitespace', () => {
		expect(countWords('  uno  dos\ntres ')).toBe(3);
		expect(countWords('   ')).toBe(0);
	});
});

describe('authored stories (src/content/stories)', () => {
	const files = readdirSync(STORIES_DIR)
		.filter((f) => f.endsWith('.yaml'))
		.sort();
	const entries: StoryFileEntry[] = files.map((f) => {
		const data = parseYaml(readFileSync(join(STORIES_DIR, f), 'utf-8'));
		return {
			id: f.replace(/\.yaml$/, ''),
			file: `src/content/stories/${f}`,
			story: zStory.parse(data)
		};
	});

	it('include the three core questions', () => {
		const ids = entries.map((e) => e.id);
		for (const id of ['what-is-a-doi', 'where-to-deposit-data', 'what-is-fair'])
			expect(ids).toContain(id);
	});

	it('pass every story check against the real graph', () => {
		expect(checkStories(entries, index)).toEqual([]);
	});

	it('have 6-10 steps each', () => {
		for (const e of entries) {
			expect(e.story.steps.length, e.id).toBeGreaterThanOrEqual(6);
			expect(e.story.steps.length, e.id).toBeLessThanOrEqual(10);
		}
	});
});

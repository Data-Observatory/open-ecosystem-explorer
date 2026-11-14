// Stories: short guided paths through the graph that answer one newcomer
// question ("What is a DOI and who issues it?"). Like views (§5.6), a story is
// never a node and never adds an edge: it only points at entities and edges
// that already exist. Unlike views, its prose is inline and bilingual, because
// each step's caption is a single sentence tied to that step.
//
// One file per story: src/content/stories/<id>.yaml. Graph-dependent checks
// (ids resolve, edges exist, steps connect, word limits) are in ./check.ts.
import { z } from 'zod';
import { locales, type LocaleCode } from '../../i18n/locales.js';
import { zPredicateId } from '../model/schema.js';

/** Caption limit per step and locale (plain language, read in one glance). */
export const STORY_STEP_MAX_WORDS = 30;
/** Question chip limit, in characters. */
export const STORY_QUESTION_MAX_CHARS = 80;
export const STORY_MIN_STEPS = 3;
export const STORY_MAX_STEPS = 12;

const storyId = z
	.string()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'id must be lowercase kebab-case')
	.min(2)
	.max(64);
const entityRef = storyId;

/** One non-empty string per configured locale, and nothing else (ES/EN parity by construction). */
function localeText(max?: number) {
	const text = max ? z.string().trim().min(1).max(max) : z.string().trim().min(1);
	const shape = Object.fromEntries(locales.map((l) => [l.code, text])) as Record<
		LocaleCode,
		typeof text
	>;
	return z.object(shape).strict();
}

export const zStoryEdgeRef = z
	.object({
		source: entityRef,
		predicate: zPredicateId,
		target: entityRef
	})
	.strict();

export const zStoryStep = z
	.object({
		/** The entity the camera centres on in this step. */
		focus: entityRef,
		/** Further entities that appear in this step (they stay visible afterwards). */
		reveal: z.array(entityRef).default([]),
		/** Edges to highlight; each must exist in the graph. */
		edges: z.array(zStoryEdgeRef).optional(),
		/** Caption, at most STORY_STEP_MAX_WORDS words per locale (checked in check.ts). */
		text: localeText()
	})
	.strict();

export const zStory = z
	.object({
		id: storyId,
		title: localeText(120),
		/** The chip text: the question the story answers. */
		question: localeText(STORY_QUESTION_MAX_CHARS),
		/** Optional map theme (src/lib/map/anchors.ts MAP_THEMES) the story belongs to. */
		theme: z.string().optional(),
		steps: z.array(zStoryStep).min(STORY_MIN_STEPS).max(STORY_MAX_STEPS)
	})
	.strict();

export type StoryEdgeRef = z.infer<typeof zStoryEdgeRef>;
export type StoryStep = z.infer<typeof zStoryStep>;
export type Story = z.infer<typeof zStory>;

export interface StoryFileEntry {
	/** Filename stem; must equal `story.id`. */
	id: string;
	file: string;
	story: Story;
}

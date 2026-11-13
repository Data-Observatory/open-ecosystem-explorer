// Loads the `stories` collection (src/content/stories/*.yaml) into a map,
// sorted by id. Stories are never nodes/edges, so like views they stay out
// of site-index.ts's GraphIndex. Shape and checks: src/lib/stories/.
import { getCollection } from 'astro:content';
import type { LocaleCode } from '../i18n/locales.js';
import type { Story, StoryStep } from '../lib/stories/schema.js';

let cached: Promise<ReadonlyMap<string, Story>> | undefined;

export function getStories(): Promise<ReadonlyMap<string, Story>> {
  if (!cached) cached = build();
  return cached;
}

async function build(): Promise<ReadonlyMap<string, Story>> {
  const entries = await getCollection('stories');
  const sorted = [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return new Map(sorted.map((e) => [e.id, e.data as unknown as Story]));
}

/** A story step's caption in one locale (every locale is required by the schema). */
export function stepText(step: StoryStep, locale: LocaleCode): string {
  return step.text[locale];
}

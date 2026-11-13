// Loads the `stories` collection (src/content/stories/*.yaml) into a map,
// sorted by id. Stories are never nodes/edges, so like views they stay out
// of site-index.ts's GraphIndex. Shape and checks: src/lib/stories/.
import { loadYamlCollection } from './loaders.js';
import { zStory } from '../lib/stories/schema.js';
import type { LocaleCode } from '../i18n/locales.js';
import type { Story, StoryStep } from '../lib/stories/schema.js';

let cached: Promise<ReadonlyMap<string, Story>> | undefined;

export function getStories(): Promise<ReadonlyMap<string, Story>> {
  if (!cached) cached = build();
  return cached;
}

async function build(): Promise<ReadonlyMap<string, Story>> {
  // Each file carries its own `id`; ST1 (scripts/validate.ts) checks it equals the filename.
  const entries = loadYamlCollection({ base: 'src/content/stories', schema: zStory });
  const sorted = [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return new Map(sorted.map((e) => [e.id, e.data as unknown as Story]));
}

/** A story step's caption in one locale (every locale is required by the schema). */
export function stepText(step: StoryStep, locale: LocaleCode): string {
  return step.text[locale];
}

// Astro content collections (specs.md §4.3, §8.2). Same Zod schemas as
// scripts/validate.ts — never redefined (single source of truth). Uses a
// custom loader (src/content/loaders.ts) rather than the built-in glob()
// loader, because entity/view facts files need `id` injected from the
// filename (I1).
import { defineCollection } from 'astro:content';
import { zEntity, zProseFile, zView, zViewProseFile } from './lib/model/schema.js';
import { frontmatterLoader } from './content/loaders.js';

const entities = defineCollection({
  loader: frontmatterLoader({ base: './src/content/entities', injectId: true }),
  schema: zEntity,
});

// Entity prose: src/content/i18n/<locale>/<id>.yaml (exactly two path
// segments, which naturally excludes the views/ subdirectory below).
const i18n = defineCollection({
  loader: frontmatterLoader({
    base: './src/content/i18n',
    match: (rel) => rel.split('/').length === 2,
    localeAwareId: true,
  }),
  schema: zProseFile,
});

// View prose: src/content/i18n/<locale>/views/<id>.yaml.
const i18nViews = defineCollection({
  loader: frontmatterLoader({
    base: './src/content/i18n',
    match: (rel) => {
      const parts = rel.split('/');
      return parts.length === 3 && parts[1] === 'views';
    },
    localeAwareId: true,
  }),
  schema: zViewProseFile,
});

const views = defineCollection({
  loader: frontmatterLoader({ base: './src/content/views' }),
  schema: zView.omit({ id: true }),
});

export const collections = { entities, i18n, i18nViews, views };

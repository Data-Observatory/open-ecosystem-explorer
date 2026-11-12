// Builds the one GraphIndex every page needs, from Astro's content
// collections plus the vocab YAML on disk. Astro-specific content-layer
// wiring (like loaders.ts, content.config.ts) — deliberately outside
// src/lib/** (rule A1 is about the pure library, not this glue).
//
// Vocab isn't an Astro content collection (it's config, not content), so
// it's read directly here, mirroring scripts/validate.ts's loadVocab() —
// not imported from there, since that file is a CLI entry point, not a
// library module (same reasoning tests/fixtures/load-real-content.ts uses).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { getCollection } from 'astro:content';
import { buildIndex } from '../lib/graph/build-index.js';
import { parseEntityTypesVocab, parsePredicatesVocab } from '../lib/model/vocab.js';
import type { Entity, EntityId, GraphIndex, ResolvedProse } from '../lib/model/types.js';
import { locales, type LocaleCode } from '../i18n/locales.js';

const ROOT = process.cwd();

function loadVocab() {
  const dir = join(ROOT, 'src/content/vocab');
  const entityTypesRaw = parseYaml(readFileSync(join(dir, 'entity-types.yaml'), 'utf-8'));
  const predicatesRaw = parseYaml(readFileSync(join(dir, 'predicates.yaml'), 'utf-8'));
  return {
    entityTypesVocab: parseEntityTypesVocab(entityTypesRaw),
    predicatesVocab: parsePredicatesVocab(predicatesRaw),
  };
}

let cached: Promise<GraphIndex> | undefined;

/** Cached per build process — every page calls this, the graph never changes mid-build. */
export function getSiteIndex(): Promise<GraphIndex> {
  if (!cached) cached = buildSiteIndex();
  return cached;
}

async function buildSiteIndex(): Promise<GraphIndex> {
  const entityEntries = await getCollection('entities');
  const entities = entityEntries.map((e) => e.data as unknown as Entity);

  const i18nEntries = await getCollection('i18n');
  const prose = new Map<LocaleCode, Map<EntityId, ResolvedProse>>();
  for (const { code } of locales) prose.set(code, new Map());
  for (const entry of i18nEntries) {
    // id is `<locale>/<entityId>` (loaders.ts's localeAwareId).
    const [locale, id] = entry.id.split('/') as [LocaleCode, EntityId];
    const data = entry.data as unknown as { summary: string; name?: string; aka?: string[]; relationNotes?: Record<string, string>; localNote?: string; body: string };
    prose.get(locale)?.set(id, {
      summary: data.summary,
      name: data.name,
      aka: data.aka,
      relationNotes: data.relationNotes,
      localNote: data.localNote,
      body: data.body,
    });
  }

  const { entityTypesVocab, predicatesVocab } = loadVocab();
  return buildIndex(entities, prose, predicatesVocab, entityTypesVocab);
}

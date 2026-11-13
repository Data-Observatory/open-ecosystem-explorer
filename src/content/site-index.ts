// Builds the one GraphIndex every page needs, from the entity and prose
// YAML files (read by loaders.ts) plus the vocab YAML on disk. Content
// loading glue, deliberately outside src/lib/** (rule A1 is about the pure
// library, not this glue). Build-time only: imported from server `load`
// functions and prerendered endpoints.
//
// Vocab is config, not content, so it's read directly here, mirroring scripts/validate.ts's loadVocab() —
// not imported from there, since that file is a CLI entry point, not a
// library module (same reasoning tests/fixtures/load-real-content.ts uses).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { loadYamlCollection, ROOT } from './loaders.js';
import { zEntity, zProseFile } from '../lib/model/schema.js';
import { buildIndex } from '../lib/graph/build-index.js';
import { parseEntityTypesVocab, parsePredicatesVocab } from '../lib/model/vocab.js';
import type { Entity, EntityId, GraphIndex, ResolvedProse } from '../lib/model/types.js';
import { locales, type LocaleCode } from '../i18n/locales.js';

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
  const entityEntries = loadYamlCollection({ base: 'src/content/entities', schema: zEntity, injectId: true });
  const entities = entityEntries.map((e) => e.data as unknown as Entity);

  // Entity prose: src/content/i18n/<locale>/<id>.yaml (exactly two path
  // segments, which naturally excludes the views/ subdirectory).
  const i18nEntries = loadYamlCollection({
    base: 'src/content/i18n',
    schema: zProseFile,
    match: (rel) => rel.split('/').length === 2,
    localeAwareId: true,
  });
  const prose = new Map<LocaleCode, Map<EntityId, ResolvedProse>>();
  for (const { code } of locales) prose.set(code, new Map());
  for (const entry of i18nEntries) {
    // id is `<locale>/<entityId>` (loaders.ts's localeAwareId).
    const [locale, id] = entry.id.split('/') as [LocaleCode, EntityId];
    const data = entry.data as unknown as { summary: string; name?: string; shortName?: string; aka?: string[]; relationNotes?: Record<string, string>; localNote?: string; body: string };
    prose.get(locale)?.set(id, {
      summary: data.summary,
      name: data.name,
      shortName: data.shortName,
      aka: data.aka,
      relationNotes: data.relationNotes,
      localNote: data.localNote,
      body: data.body,
    });
  }

  const { entityTypesVocab, predicatesVocab } = loadVocab();
  return buildIndex(entities, prose, predicatesVocab, entityTypesVocab);
}

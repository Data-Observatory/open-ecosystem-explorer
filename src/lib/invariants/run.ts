// Orchestrates buildIndex + all I1-I31 rules into one summary. Pure: takes
// already-parsed content, no file IO (rule A1). scripts/validate.ts does the
// loading and printing.
import { buildIndex } from '../graph/build-index.js';
import type { Entity, EntityId, ResolvedProse } from '../model/types.js';
import type { LocaleCode } from '../../i18n/locales.js';
import { runAllInvariants } from './rules.js';
import type {
  EntityFileEntry,
  InvariantMessage,
  ProseFileEntry,
  RunContext,
  ViewFileEntry,
  ViewProseFileEntry,
} from './types.js';
import type { EntityTypesVocab, PredicateFamiliesVocab, PredicatesVocab, SimpleVocab } from '../model/vocab.js';

export interface ValidationInput {
  entityFiles: EntityFileEntry[];
  entityBodies: Map<EntityId, string>;
  proseFiles: ProseFileEntry[];
  viewFiles: ViewFileEntry[];
  viewProseFiles: ViewProseFileEntry[];
  entityTypesVocab: EntityTypesVocab;
  predicatesVocab: PredicatesVocab;
  tagsVocab: SimpleVocab;
  disciplinesVocab: SimpleVocab;
  statusesVocab: SimpleVocab;
  predicateFamiliesVocab?: PredicateFamiliesVocab;
  /** Defaults to lenient (false); scripts/validate.ts passes the resolved policy from config.ts. */
  requireFullI18n?: boolean;
  locales: readonly LocaleCode[];
  defaultLocale: LocaleCode;
  now?: Date;
}

export interface ValidationResult {
  messages: InvariantMessage[];
  errors: InvariantMessage[];
  warnings: InvariantMessage[];
  entityCount: number;
  edgeCount: number;
  translationCoverage: Record<LocaleCode, { present: number; missing: readonly EntityId[] }>;
}

function buildProseMap(
  proseFiles: ProseFileEntry[],
  locales: readonly LocaleCode[],
): Map<LocaleCode, Map<EntityId, ResolvedProse>> {
  const map = new Map<LocaleCode, Map<EntityId, ResolvedProse>>();
  for (const locale of locales) map.set(locale, new Map());
  for (const p of proseFiles) {
    if (!map.has(p.locale)) map.set(p.locale, new Map());
    map.get(p.locale)!.set(p.id, {
      summary: p.prose.summary,
      name: p.prose.name,
      aka: p.prose.aka,
      relationNotes: p.prose.relationNotes,
      localNote: p.prose.localNote,
      body: p.prose.body,
    });
  }
  return map;
}

export function runValidation(input: ValidationInput): ValidationResult {
  const entities: Entity[] = input.entityFiles.map((e) => e.entity);
  const proseMap = buildProseMap(input.proseFiles, input.locales);
  const index = buildIndex(entities, proseMap, input.predicatesVocab, input.entityTypesVocab);

  const ctx: RunContext = {
    entityFiles: input.entityFiles,
    proseFiles: input.proseFiles,
    viewFiles: input.viewFiles,
    viewProseFiles: input.viewProseFiles,
    entityTypesVocab: input.entityTypesVocab,
    predicatesVocab: input.predicatesVocab,
    tagsVocab: input.tagsVocab,
    disciplinesVocab: input.disciplinesVocab,
    statusesVocab: input.statusesVocab,
    predicateFamiliesVocab: input.predicateFamiliesVocab,
    // Programmatic callers opt in; scripts/validate.ts always passes the resolved policy (config.ts).
    requireFullI18n: input.requireFullI18n ?? false,
    locales: input.locales,
    defaultLocale: input.defaultLocale,
    index,
    now: input.now ?? new Date(),
  };

  const messages = runAllInvariants(ctx, { now: ctx.now, entityBodies: input.entityBodies });
  const errors = messages.filter((m) => m.level === 'ERROR');
  const warnings = messages.filter((m) => m.level === 'WARN');

  return {
    messages,
    errors,
    warnings,
    entityCount: index.stats.entityCount,
    edgeCount: index.stats.edgeCount,
    translationCoverage: index.stats.translationCoverage,
  };
}

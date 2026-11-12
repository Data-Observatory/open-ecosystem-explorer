// Cached loaders for the vocab YAML files that aren't already reachable off
// GraphIndex (predicates are — index.predicates; entity-types/tags/
// disciplines are not, since buildIndex only needs entity-types internally
// to derive `layer`). Mirrors site-index.ts's own loadVocab() (not imported
// from there — that function is private to that module's build step).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  parseEntityTypesVocab,
  parsePredicateFamiliesVocab,
  parseSimpleVocab,
  type EntityTypesVocab,
  type PredicateFamiliesVocab,
  type SimpleVocab,
} from '../lib/model/vocab.js';

const ROOT = process.cwd();
const VOCAB_DIR = join(ROOT, 'src/content/vocab');

let entityTypesCache: EntityTypesVocab | undefined;
let tagsCache: SimpleVocab | undefined;
let disciplinesCache: SimpleVocab | undefined;
let statusesCache: SimpleVocab | undefined;
let predicateFamiliesCache: PredicateFamiliesVocab | undefined;

export async function getEntityTypesVocab(): Promise<EntityTypesVocab> {
  if (!entityTypesCache) {
    const raw = parseYaml(readFileSync(join(VOCAB_DIR, 'entity-types.yaml'), 'utf-8'));
    entityTypesCache = parseEntityTypesVocab(raw);
  }
  return entityTypesCache;
}

export async function getTagsVocab(): Promise<SimpleVocab> {
  if (!tagsCache) {
    const raw = parseYaml(readFileSync(join(VOCAB_DIR, 'tags.yaml'), 'utf-8'));
    tagsCache = parseSimpleVocab(raw);
  }
  return tagsCache;
}

export async function getDisciplinesVocab(): Promise<SimpleVocab> {
  if (!disciplinesCache) {
    const raw = parseYaml(readFileSync(join(VOCAB_DIR, 'disciplines.yaml'), 'utf-8'));
    disciplinesCache = parseSimpleVocab(raw);
  }
  return disciplinesCache;
}

export async function getStatusesVocab(): Promise<SimpleVocab> {
  if (!statusesCache) {
    const raw = parseYaml(readFileSync(join(VOCAB_DIR, 'statuses.yaml'), 'utf-8'));
    statusesCache = parseSimpleVocab(raw);
  }
  return statusesCache;
}

/** Display families for predicates (vocab/predicate-families.yaml); `PredicateDef.family` keys into this. */
export async function getPredicateFamiliesVocab(): Promise<PredicateFamiliesVocab> {
  if (!predicateFamiliesCache) {
    const raw = parseYaml(readFileSync(join(VOCAB_DIR, 'predicate-families.yaml'), 'utf-8'));
    predicateFamiliesCache = parsePredicateFamiliesVocab(raw);
  }
  return predicateFamiliesCache;
}

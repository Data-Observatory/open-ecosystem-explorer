// Test-only helper (impure, filesystem — fine outside src/lib/**, rule A1
// only constrains the library itself). Loads the real vocab files so fixture
// tests exercise the actual predicate/type tables rather than a parallel copy
// that could silently drift from them.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { parseEntityTypesVocab, parsePredicatesVocab, parseSimpleVocab, parsePredicateFamiliesVocab } from '../../src/lib/model/vocab.js';

const ROOT = join(import.meta.dirname, '../..');

export function loadRealVocab() {
  const dir = join(ROOT, 'src/content/vocab');
  const entityTypesRaw = parseYaml(readFileSync(join(dir, 'entity-types.yaml'), 'utf-8'));
  const predicatesRaw = parseYaml(readFileSync(join(dir, 'predicates.yaml'), 'utf-8'));
  const tagsRaw = parseYaml(readFileSync(join(dir, 'tags.yaml'), 'utf-8'));
  const disciplinesRaw = parseYaml(readFileSync(join(dir, 'disciplines.yaml'), 'utf-8'));
  const statusesRaw = parseYaml(readFileSync(join(dir, 'statuses.yaml'), 'utf-8'));
  const familiesRaw = parseYaml(readFileSync(join(dir, 'predicate-families.yaml'), 'utf-8'));

  return {
    entityTypesVocab: parseEntityTypesVocab(entityTypesRaw),
    predicatesVocab: parsePredicatesVocab(predicatesRaw),
    tagsVocab: parseSimpleVocab(tagsRaw),
    disciplinesVocab: parseSimpleVocab(disciplinesRaw),
    statusesVocab: parseSimpleVocab(statusesRaw),
    predicateFamiliesVocab: parsePredicateFamiliesVocab(familiesRaw),
  };
}

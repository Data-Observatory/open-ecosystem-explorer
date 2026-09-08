// Pure parsers turning already-loaded YAML objects (raw JS values — the
// caller does the file IO, per rule A1) into typed vocab maps.
import type { EntityType, Layer, CrossCuttingLayer, PredicateDef, PredicateId } from './types.js';
import { ENTITY_TYPES, PREDICATE_IDS } from './types.js';

export interface EntityTypeVocabEntry {
  layer: Layer | CrossCuttingLayer;
  label: Record<string, string>;
  definition?: Record<string, string>;
}

export type EntityTypesVocab = Map<EntityType, EntityTypeVocabEntry>;
export type PredicatesVocab = Map<PredicateId, PredicateDef>;
export type SimpleVocab = Map<string, { label: Record<string, string>; definition?: Record<string, string> }>;

export function parseEntityTypesVocab(raw: Record<string, unknown>): EntityTypesVocab {
  const map: EntityTypesVocab = new Map();
  for (const type of ENTITY_TYPES) {
    const entry = raw[type] as EntityTypeVocabEntry | undefined;
    if (entry) map.set(type, entry);
  }
  return map;
}

export function parsePredicatesVocab(raw: Record<string, unknown>): PredicatesVocab {
  const map: PredicatesVocab = new Map();
  for (const id of PREDICATE_IDS) {
    const entry = raw[id] as Record<string, unknown> | undefined;
    if (!entry) continue;
    map.set(id, {
      id,
      label: entry.label as PredicateDef['label'],
      inverseLabel: entry.inverseLabel as PredicateDef['inverseLabel'],
      domain: entry.domain as EntityType[],
      range: entry.range as EntityType[],
      symmetric: Boolean(entry.symmetric),
      acyclic: Boolean(entry.acyclic),
      sameTypeOnly: Boolean(entry.sameTypeOnly),
      crossTypePairs: entry.crossTypePairs as PredicateDef['crossTypePairs'],
      maxOutDegree: entry.maxOutDegree as number | undefined,
      style: entry.style as PredicateDef['style'],
    });
  }
  return map;
}

export function parseSimpleVocab(raw: Record<string, unknown>): SimpleVocab {
  const map: SimpleVocab = new Map();
  for (const [key, value] of Object.entries(raw)) {
    map.set(key, value as { label: Record<string, string>; definition?: Record<string, string> });
  }
  return map;
}

export function layerForType(vocab: EntityTypesVocab, type: EntityType): Layer | CrossCuttingLayer {
  const entry = vocab.get(type);
  if (!entry) throw new Error(`entity type '${type}' is not declared in vocab/entity-types.yaml`);
  return entry.layer;
}

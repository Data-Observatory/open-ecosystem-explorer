// The data model diagram (specs.md §6.3 "Data model" row, §7 `/{loc}/model`
// row): `erDiagram` generated directly from vocab/predicates.yaml and
// vocab/entity-types.yaml, so published documentation cannot drift from the
// enforced validation rules. PURE (rule A1). No node/edge legibility budget
// applies here (§6.4's caps are for relation-instance diagrams over real
// content; this is the fixed 12-type schema itself, meant to be exhaustive).
import type { EntityType, PredicateDef, PredicateId } from '../model/types.js';
import { ENTITY_TYPES, PREDICATE_IDS } from '../model/types.js';

type PredicatesMap = ReadonlyMap<PredicateId, PredicateDef>;

function erName(type: EntityType): string {
  return type.toUpperCase().replace(/-/g, '_');
}

/** A (domainType, rangeType) pair is only real for a sameTypeOnly predicate
 *  when the types match or the pair is explicitly whitelisted in
 *  crossTypePairs (I8's rule) — otherwise the cartesian domain x range loop
 *  below would draw/document combinations I8 actually rejects. */
function pairIsLegal(def: PredicateDef, d: EntityType, r: EntityType): boolean {
  if (!def.sameTypeOnly) return true;
  if (d === r) return true;
  return (def.crossTypePairs ?? []).some(([x, y]) => (x === d && y === r) || (x === r && y === d));
}

/** One relationship line per (predicate, domainType, rangeType) triple.
 *  Generic zero-or-many cardinality both sides (`}o--o{`) since the schema
 *  states domain/range sets, not per-pair cardinality constraints. */
export function buildModelErDiagram(predicates: PredicatesMap): string {
  const lines: string[] = ['erDiagram'];
  for (const id of PREDICATE_IDS) {
    const def = predicates.get(id);
    if (!def) continue;
    for (const d of def.domain) {
      for (const r of def.range) {
        if (!pairIsLegal(def, d, r)) continue;
        lines.push(`  ${erName(d)} }o--o{ ${erName(r)} : "${id}"`);
      }
    }
  }
  // Every declared type appears as an entity even if it has no relationship
  // line yet in a smaller test vocab (real content always satisfies I12).
  for (const type of ENTITY_TYPES) {
    lines.push(`  ${erName(type)} { string id }`);
  }
  return lines.join('\n');
}

export interface ModelDescription {
  caption: string;
  description: string;
  rows: { subjectName: string; subjectType: string; predicateLabel: string; objectName: string; objectType: string }[];
}

/** Accessible-table equivalent (§9): every (predicate, domainType,
 *  rangeType) triple the erDiagram draws, in the same subject/predicate/
 *  object shape Diagram.astro already expects — "type" stands in for a
 *  concrete entity, since this diagram documents the schema, not instances. */
export function describeModel(predicates: PredicatesMap, locale: 'es' | 'en'): ModelDescription {
  const rows: ModelDescription['rows'] = [];
  for (const id of PREDICATE_IDS) {
    const def = predicates.get(id);
    if (!def) continue;
    for (const d of def.domain) {
      for (const r of def.range) {
        if (!pairIsLegal(def, d, r)) continue;
        rows.push({ subjectName: d, subjectType: 'type', predicateLabel: def.label[locale] ?? id, objectName: r, objectType: 'type' });
      }
    }
  }
  return {
    caption: locale === 'es' ? 'El modelo de datos' : 'The data model',
    description:
      locale === 'es'
        ? `${ENTITY_TYPES.length} tipos, ${PREDICATE_IDS.length} predicados, ${rows.length} combinaciones dominio-rango declaradas.`
        : `${ENTITY_TYPES.length} types, ${PREDICATE_IDS.length} predicates, ${rows.length} declared domain-range combinations.`,
    rows,
  };
}

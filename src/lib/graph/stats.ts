import type { EntityId, EntityStats, EntityType, GraphEdge, Layer, CrossCuttingLayer, PredicateId } from '../model/types.js';
import { ENTITY_TYPES } from '../model/types.js';
import type { LocaleCode } from '../../i18n/locales.js';

function compareIds(a: EntityId, b: EntityId): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function computeStats(params: {
  entityIds: readonly EntityId[];
  byType: ReadonlyMap<EntityType, readonly EntityId[]>;
  byLayer: ReadonlyMap<Layer | CrossCuttingLayer, readonly EntityId[]>;
  edges: readonly GraphEdge[];
  degree: ReadonlyMap<EntityId, { in: number; out: number }>;
  predicateIds: readonly PredicateId[];
  prose: ReadonlyMap<LocaleCode, ReadonlyMap<EntityId, unknown>>;
}): EntityStats {
  const { entityIds, byType, byLayer, edges, degree, predicateIds, prose } = params;

  const orphans = entityIds
    .filter((id) => (degree.get(id)?.in ?? 0) + (degree.get(id)?.out ?? 0) === 0)
    .sort(compareIds);

  const byTypeCount = Object.fromEntries(ENTITY_TYPES.map((t) => [t, byType.get(t)?.length ?? 0])) as Record<
    EntityType,
    number
  >;

  const layerKeys: (Layer | CrossCuttingLayer)[] = [
    'identifier',
    'agency',
    'index',
    'institutional-system',
    'regional',
    'cross-cutting',
  ];
  const byLayerCount = Object.fromEntries(layerKeys.map((l) => [l, byLayer.get(l)?.length ?? 0])) as Record<
    Layer | CrossCuttingLayer,
    number
  >;

  const byPredicateCount: Record<string, number> = {};
  for (const id of predicateIds) byPredicateCount[id] = 0;
  for (const edge of edges) byPredicateCount[edge.predicate] = (byPredicateCount[edge.predicate] ?? 0) + 1;

  const translationCoverage: Record<string, { present: number; missing: EntityId[] }> = {};
  for (const [locale, localeProse] of prose) {
    const missing: EntityId[] = [];
    let present = 0;
    for (const id of entityIds) {
      if (localeProse.has(id)) present++;
      else missing.push(id);
    }
    translationCoverage[locale] = { present, missing: missing.sort(compareIds) };
  }

  const maxDegree = Math.max(0, ...[...degree.values()].map((d) => d.in + d.out));

  return {
    entityCount: entityIds.length,
    edgeCount: edges.length,
    maxDegree,
    generatedAt: new Date().toISOString(),
    byType: byTypeCount,
    byLayer: byLayerCount,
    byPredicate: byPredicateCount as Record<PredicateId, number>,
    orphans,
    translationCoverage: translationCoverage as EntityStats['translationCoverage'],
  };
}

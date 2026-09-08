// Predicate map diagram (specs.md §6.3 "Predicate map" row): every edge of
// one predicate. `/relations/owned-by` is the vertical-integration picture
// (§5.3) — the flagship diagram the project's thesis rests on. PURE (rule
// A1). Flat flowchart (no subgraphs, unlike type-map.ts), so this reuses
// flowchart.ts's shared renderer directly.
import type { EntityId, GraphIndex, PredicateId } from '../model/types.js';
import type { LocaleCode } from '../../i18n/locales.js';
import { renderMermaidSource, type EdgeSpec, type NodeSpec } from './flowchart.js';
import { GLOBAL_NODE_CAP } from './budget.js';

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function displayName(index: GraphIndex, id: EntityId, locale: LocaleCode): string {
  return index.prose.get(locale)?.get(id)?.name ?? index.entities.get(id)?.name ?? id;
}

export interface PredicateMapView {
  nodes: Map<EntityId, NodeSpec>;
  edges: EdgeSpec[];
  /** §6.3: "60 nodes, else table-first" — over budget, the diagram is not
   *  rendered at all for this diagram type (unlike Focus's collapsing or
   *  Type-map's degree-based trim); the accessible table becomes the only
   *  representation, per the registry's explicit wording for this row. */
  overBudget: boolean;
}

export function computePredicateMapView(index: GraphIndex, predicate: PredicateId, locale: LocaleCode): PredicateMapView {
  const edgesOfPredicate = index.edges.filter((e) => e.predicate === predicate).slice().sort((a, b) => compareIds(a.from, b.from) || compareIds(a.to, b.to));

  const nodes = new Map<EntityId, NodeSpec>();
  for (const e of edgesOfPredicate) {
    for (const id of [e.from, e.to]) {
      if (nodes.has(id)) continue;
      const entity = index.entities.get(id);
      if (!entity) continue;
      nodes.set(id, { id, type: entity.type, name: displayName(index, id, locale) });
    }
  }

  const overBudget = nodes.size > GLOBAL_NODE_CAP;
  const def = index.predicates.get(predicate);
  const label = def?.label[locale] ?? predicate;
  const edges: EdgeSpec[] = overBudget
    ? []
    : edgesOfPredicate.map((e) => ({
        from: e.from,
        to: e.to,
        predicate: e.predicate,
        style: def?.style.line === 'thick' ? 'thick' : def?.style.line === 'dashed' ? 'dashed' : 'solid',
        label,
        since: e.since,
        until: e.until,
        note: e.note,
      }));

  return { nodes: overBudget ? new Map() : nodes, edges, overBudget };
}

export function buildPredicateMapDiagram(index: GraphIndex, predicate: PredicateId, locale: LocaleCode): string | undefined {
  const view = computePredicateMapView(index, predicate, locale);
  if (view.overBudget) return undefined;
  return renderMermaidSource(index, view.nodes, view.edges, locale);
}

export interface PredicateMapDescription {
  caption: string;
  description: string;
  rows: { subjectName: string; subjectType: string; predicateLabel: string; objectName: string; objectType: string; since?: string; note?: string }[];
}

function typeOf(index: GraphIndex, id: EntityId): string {
  return index.entities.get(id)?.type ?? 'unknown';
}

/**
 * Accessible-table equivalent (§9) — computed from the SAME filtered edge
 * list computePredicateMapView builds, independent of the overBudget gate,
 * so the table is always the complete edge set even on predicates too large
 * to diagram (that's precisely the "table-first" fallback's point).
 */
export function describePredicateMap(index: GraphIndex, predicate: PredicateId, locale: LocaleCode): PredicateMapDescription {
  const allEdges = index.edges.filter((e) => e.predicate === predicate).slice().sort((a, b) => compareIds(a.from, b.from) || compareIds(a.to, b.to));
  const def = index.predicates.get(predicate);
  const label = def?.label[locale] ?? predicate;

  const caption = locale === 'es' ? `Mapa de predicado — ${label}` : `Predicate map — ${label}`;
  const description =
    locale === 'es'
      ? `${allEdges.length} relaciones '${label}' en el grafo.`
      : `${allEdges.length} '${label}' relationships in the graph.`;

  const rows = allEdges.map((e) => ({
    subjectName: displayName(index, e.from, locale),
    subjectType: typeOf(index, e.from),
    predicateLabel: label,
    objectName: displayName(index, e.to, locale),
    objectType: typeOf(index, e.to),
    since: e.since,
    note: e.note,
  }));

  return { caption, description, rows };
}

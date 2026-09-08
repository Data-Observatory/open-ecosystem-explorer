// Type map diagram (specs.md §6.3 "Type map" row): all entities of one type
// and their immediate connections, `flowchart TB` with one `subgraph` per
// related type. PURE (rule A1). Reuses flowchart.ts's generic renderer and
// NodeSpec/EdgeSpec shapes so no second rendering convention is invented.
import type { EntityId, EntityType, GraphEdge, GraphIndex } from '../model/types.js';
import type { LocaleCode } from '../../i18n/locales.js';
import type { EdgeSpec, NodeSpec } from './flowchart.js';
import { GLOBAL_NODE_CAP, trimToCap } from './budget.js';
import { toNodeId, quoteLabel } from './ids.js';
import { shapeForLayer, wrapShape, classDefLine, classNameForType } from './palette.js';
import type { EntityTypesVocab } from '../model/vocab.js';
import { layerForType } from '../model/vocab.js';

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function displayName(index: GraphIndex, id: EntityId, locale: LocaleCode): string {
  return index.prose.get(locale)?.get(id)?.name ?? index.entities.get(id)?.name ?? id;
}

function predicateLabel(index: GraphIndex, predicate: GraphEdge['predicate'], locale: LocaleCode): string {
  return index.predicates.get(predicate)?.label[locale] ?? predicate;
}

function edgeStyle(index: GraphIndex, predicate: GraphEdge['predicate']): 'solid' | 'dashed' | 'thick' {
  const line = index.predicates.get(predicate)?.style.line;
  return line === 'thick' ? 'thick' : line === 'dashed' ? 'dashed' : 'solid';
}

export interface TypeMapView {
  nodes: Map<EntityId, NodeSpec>;
  edges: EdgeSpec[];
  /** true when the full connected set exceeded GLOBAL_NODE_CAP and had to be
   *  trimmed to the highest-degree members (§6.4's over-budget rule, I28). */
  truncated: boolean;
  totalMembers: number;
  shownMembers: number;
}

/**
 * Members of `type` with ≥1 edge, plus every entity they connect to (any
 * type, any predicate). Zero-degree members of `type` are omitted from the
 * DIAGRAM (an isolated node conveys nothing in a relation map) but remain
 * listed on the page's plain entity list, which is not diagram-derived.
 * Over GLOBAL_NODE_CAP, keeps the highest-degree members of `type` first —
 * the most illustrative connections — and reports the truncation (I28).
 */
export function computeTypeMapView(index: GraphIndex, type: EntityType, locale: LocaleCode): TypeMapView {
  const members = (index.byType.get(type) ?? []).slice().sort(compareIds);
  const connected = members.filter((id) => {
    const d = index.degree.get(id);
    return (d?.in ?? 0) + (d?.out ?? 0) > 0;
  });

  const byDegreeDesc = connected.slice().sort((a, b) => {
    const da = index.degree.get(a)!;
    const db = index.degree.get(b)!;
    return db.in + db.out - (da.in + da.out) || compareIds(a, b);
  });
  const { kept, droppedCount } = trimToCap(byDegreeDesc, GLOBAL_NODE_CAP);
  const shownIds = new Set(kept);

  const nodes = new Map<EntityId, NodeSpec>();
  const edges: EdgeSpec[] = [];
  const seenEdgeKeys = new Set<string>();

  for (const id of shownIds) {
    const e = index.entities.get(id)!;
    nodes.set(id, { id, type: e.type, name: displayName(index, id, locale) });
  }

  function addEdge(edge: GraphEdge): void {
    const key = `${edge.from}|${edge.predicate}|${edge.to}`;
    if (seenEdgeKeys.has(key)) return;
    seenEdgeKeys.add(key);
    if (!nodes.has(edge.to)) {
      const e = index.entities.get(edge.to);
      if (!e) return;
      nodes.set(edge.to, { id: edge.to, type: e.type, name: displayName(index, edge.to, locale) });
    }
    if (!nodes.has(edge.from)) {
      const e = index.entities.get(edge.from);
      if (!e) return;
      nodes.set(edge.from, { id: edge.from, type: e.type, name: displayName(index, edge.from, locale) });
    }
    edges.push({
      from: edge.from,
      to: edge.to,
      predicate: edge.predicate,
      style: edgeStyle(index, edge.predicate),
      label: predicateLabel(index, edge.predicate, locale),
      since: edge.since,
      until: edge.until,
      note: edge.note,
    });
  }

  for (const id of shownIds) {
    for (const e of index.outgoing.get(id) ?? []) if (!e.derived) addEdge(e);
    for (const e of index.incoming.get(id) ?? []) if (!e.derived) addEdge(e);
  }

  return { nodes, edges, truncated: droppedCount > 0, totalMembers: members.length, shownMembers: shownIds.size };
}

function entityUrl(locale: LocaleCode, id: EntityId): string {
  return `/${locale}/entity/${id}`;
}

/** `flowchart TB`, one subgraph for `type` itself and one per distinct
 *  related type (§6.3). Node shape/fill/click/classDef conventions match
 *  flowchart.ts's shared renderer exactly (same palette helpers), but
 *  subgraph grouping is genuinely different output shape, so this is its
 *  own renderer rather than a delegate call. */
export function buildTypeMapDiagram(index: GraphIndex, typeVocab: EntityTypesVocab, type: EntityType, locale: LocaleCode): string {
  const view = computeTypeMapView(index, type, locale);
  const lines: string[] = ['flowchart TB'];

  const byType = new Map<EntityType, EntityId[]>();
  for (const [id, n] of view.nodes) {
    if (!byType.has(n.type)) byType.set(n.type, []);
    byType.get(n.type)!.push(id);
  }
  const orderedTypes = [type, ...[...byType.keys()].filter((t) => t !== type).sort()];

  for (const t of orderedTypes) {
    const ids = (byType.get(t) ?? []).slice().sort(compareIds);
    if (ids.length === 0) continue;
    lines.push(`  subgraph sg_${t.replace(/-/g, '_')} ["${t}"]`);
    for (const id of ids) {
      const n = view.nodes.get(id)!;
      const shape = shapeForLayer(layerForType(typeVocab, n.type));
      lines.push(`    ${wrapShape(shape, toNodeId(id), quoteLabel(n.name))}:::${classNameForType(n.type)}`);
    }
    lines.push('  end');
  }

  lines.push('');
  const sortedEdges = view.edges
    .slice()
    .sort((a, b) => compareIds(a.from, b.from) || a.predicate.localeCompare(b.predicate) || compareIds(a.to, b.to));
  for (const e of sortedEdges) {
    const arrow = e.style === 'thick' ? '==>' : e.style === 'dashed' ? '-.->' : '-->';
    lines.push(`  ${toNodeId(e.from)} ${arrow}|${e.label}| ${toNodeId(e.to)}`);
  }

  lines.push('');
  for (const id of [...view.nodes.keys()].sort(compareIds)) {
    lines.push(`  click ${toNodeId(id)} href "${entityUrl(locale, id)}"`);
  }

  const typesUsed = [...new Set([...view.nodes.values()].map((n) => n.type))].sort();
  for (const t of typesUsed) lines.push(`  ${classDefLine(t)}`);

  return lines.join('\n');
}

export interface TypeMapDescription {
  caption: string;
  description: string;
  rows: { subjectName: string; subjectType: string; predicateLabel: string; objectName: string; objectType: string; since?: string; note?: string }[];
}

function name(index: GraphIndex, id: EntityId, locale: LocaleCode): string {
  return displayName(index, id, locale);
}
function typeOf(index: GraphIndex, id: EntityId): string {
  return index.entities.get(id)?.type ?? 'unknown';
}

/** Accessible-table equivalent (§9, A9.2): includes every edge among the
 *  diagram's shown members, even ones the diagram's own node cap trimmed
 *  away would not appear in — the table reflects exactly the rendered
 *  view's edge set, and the page reports total-vs-shown counts separately. */
export function describeTypeMap(index: GraphIndex, type: EntityType, locale: LocaleCode): TypeMapDescription {
  const view = computeTypeMapView(index, type, locale);
  const typeLabelText = index.entities.get([...view.nodes.keys()][0] ?? '')?.type ?? type;
  void typeLabelText;
  const caption = locale === 'es' ? `Mapa de tipo — ${type}` : `Type map — ${type}`;
  const description =
    locale === 'es'
      ? `${view.shownMembers} de ${view.totalMembers} entidades de tipo '${type}' con relaciones, y sus conexiones inmediatas.${view.truncated ? ' Truncado por presupuesto de legibilidad (I28).' : ''}`
      : `${view.shownMembers} of ${view.totalMembers} '${type}' entities with relations, and their immediate connections.${view.truncated ? ' Truncated to fit the legibility budget (I28).' : ''}`;

  const rows = view.edges.map((e) => ({
    subjectName: name(index, e.from, locale),
    subjectType: typeOf(index, e.from),
    predicateLabel: e.label,
    objectName: name(index, e.to, locale),
    objectType: typeOf(index, e.to),
    since: e.since,
    note: e.note,
  }));

  return { caption, description, rows };
}

// Global map diagram (specs.md §6.2 "Global map" row, §6.3): the whole
// graph, Mermaid-only tier (<=120 entities), one subgraph per layer. PURE
// (rule A1). Reuses flowchart.ts's NodeSpec/EdgeSpec shapes and the same
// palette/id helpers as type-map.ts/layers.ts — subgraph grouping by LAYER
// rather than by type is the only genuinely new shape here.
import type { EntityId, GraphEdge, GraphIndex, Layer, CrossCuttingLayer } from '../model/types.js';
import type { LocaleCode } from '../../i18n/locales.js';
import type { EdgeSpec, NodeSpec } from './flowchart.js';
import { MAP_NODE_CAP, MAP_EDGE_CAP, trimToCap, collapseByPredicate, clusterLabel, type CollapsibleEdge } from './budget.js';
import { toNodeId, quoteLabel } from './ids.js';
import { shapeForLayer, wrapShape, classDefLine, classNameForType } from './palette.js';
import type { EntityTypesVocab } from '../model/vocab.js';
import { layerForType } from '../model/vocab.js';
import { LAYER_ORDER } from './layers.js';

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

export interface GlobalMapView {
  nodes: Map<EntityId, NodeSpec>;
  edges: EdgeSpec[];
  clusters: { ownerId: EntityId; predicate: GraphEdge['predicate']; count: number }[];
  totalEntities: number;
  shownEntities: number;
  truncated: boolean;
}

/**
 * All entities (up to MAP_NODE_CAP — §6.2's documented ≤120 tier; at more
 * entities than that, `/map` moves to the Cytoscape tier per the plan's
 * "not building yet" list, which this function does not implement).
 * Highest-degree entities are kept first if a future content set ever
 * exceeds the cap, matching type-map.ts's truncation policy.
 */
export function computeGlobalMapView(index: GraphIndex, locale: LocaleCode): GlobalMapView {
  const allIds = [...index.entities.keys()].sort(compareIds);
  const byDegreeDesc = allIds.slice().sort((a, b) => {
    const da = index.degree.get(a)!;
    const db = index.degree.get(b)!;
    return db.in + db.out - (da.in + da.out) || compareIds(a, b);
  });
  const { kept, droppedCount } = trimToCap(byDegreeDesc, MAP_NODE_CAP);
  const shown = new Set(kept);

  const nodes = new Map<EntityId, NodeSpec>();
  for (const id of shown) {
    const e = index.entities.get(id)!;
    nodes.set(id, { id, type: e.type, name: displayName(index, id, locale) });
  }

  // Collapse by (owner, predicate) when out-degree exceeds the predicate's
  // maxOutDegree (§6.4) — the same rule Focus applies, needed here because a
  // global view is exactly where a handful of hub nodes (owned-by parents,
  // LA Referencia's network) would otherwise blow past MAP_EDGE_CAP.
  type Payload = GraphEdge;
  const clusters: GlobalMapView['clusters'] = [];
  const edges: EdgeSpec[] = [];
  const seenKeys = new Set<string>();

  for (const id of shown) {
    const outgoing = (index.outgoing.get(id) ?? []).filter((e) => !e.derived && shown.has(e.to));
    const collapsible: CollapsibleEdge<Payload>[] = outgoing.map((e) => ({ predicate: e.predicate, neighbour: e.to, payload: e }));
    const { visible, collapsed } = collapseByPredicate(collapsible, (p) => index.predicates.get(p)?.maxOutDegree ?? 5);

    for (const v of visible) {
      const key = `${id}|${v.predicate}|${v.neighbour}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      const e = v.payload;
      edges.push({
        from: id,
        to: v.neighbour,
        predicate: e.predicate,
        style: edgeStyle(index, e.predicate),
        label: predicateLabel(index, e.predicate, locale),
        since: e.since,
        until: e.until,
        note: e.note,
      });
    }
    for (const group of collapsed) {
      clusters.push({ ownerId: id, predicate: group.predicate, count: group.hidden.length });
    }
  }

  const { kept: keptEdges } = trimToCap(edges, MAP_EDGE_CAP);

  return {
    nodes,
    edges: keptEdges,
    clusters,
    totalEntities: allIds.length,
    shownEntities: shown.size,
    truncated: droppedCount > 0 || keptEdges.length < edges.length,
  };
}

function layerNodeId(layer: Layer | CrossCuttingLayer): string {
  return `maplayer_${layer.replace(/-/g, '_')}`;
}

export function buildGlobalMapDiagram(index: GraphIndex, typeVocab: EntityTypesVocab, locale: LocaleCode): string {
  const view = computeGlobalMapView(index, locale);
  const lines: string[] = ['flowchart TB'];

  for (const layer of LAYER_ORDER) {
    const idsInLayer = [...view.nodes.keys()].filter((id) => layerForType(typeVocab, index.entities.get(id)!.type) === layer).sort(compareIds);
    if (idsInLayer.length === 0) continue;
    lines.push(`  subgraph ${layerNodeId(layer)} ["${layer}"]`);
    for (const id of idsInLayer) {
      const n = view.nodes.get(id)!;
      const shape = shapeForLayer(layer);
      lines.push(`    ${wrapShape(shape, toNodeId(id), quoteLabel(n.name))}:::${classNameForType(n.type)}`);
    }
    lines.push('  end');
  }

  // Cluster nodes for collapsed groups, one per (owner, predicate).
  for (const c of view.clusters) {
    const clusterId = `${toNodeId(c.ownerId)}__cluster__${c.predicate}`;
    const label = clusterLabel(c.count, c.predicate);
    lines.push(`  ${clusterId.replace(/-/g, '_')}[${quoteLabel(label)}]`);
  }

  lines.push('');
  const sortedEdges = view.edges
    .slice()
    .sort((a, b) => compareIds(a.from, b.from) || a.predicate.localeCompare(b.predicate) || compareIds(a.to, b.to));
  for (const e of sortedEdges) {
    const arrow = e.style === 'thick' ? '==>' : e.style === 'dashed' ? '-.->' : '-->';
    lines.push(`  ${toNodeId(e.from)} ${arrow}|${e.label}| ${toNodeId(e.to)}`);
  }
  for (const c of view.clusters) {
    const clusterId = `${toNodeId(c.ownerId)}__cluster__${c.predicate}`.replace(/-/g, '_');
    lines.push(`  ${toNodeId(c.ownerId)} -.-> ${clusterId}`);
    lines.push(`  click ${clusterId} href "/${locale}/relations/${c.predicate}/"`);
  }

  lines.push('');
  for (const id of [...view.nodes.keys()].sort(compareIds)) {
    lines.push(`  click ${toNodeId(id)} href "/${locale}/entity/${id}/"`);
  }

  const typesUsed = [...new Set([...view.nodes.values()].map((n) => n.type))].sort();
  for (const t of typesUsed) lines.push(`  ${classDefLine(t)}`);

  return lines.join('\n');
}

export interface GlobalMapDescription {
  caption: string;
  description: string;
  rows: { subjectName: string; subjectType: string; predicateLabel: string; objectName: string; objectType: string; since?: string; note?: string }[];
}

/** Accessible-table equivalent (§9, A9.2) — every edge among shown nodes,
 *  including ones collapsed into a cluster node in the diagram (expanded
 *  back to individual rows, same principle as describe.ts's expandRow). */
export function describeGlobalMap(index: GraphIndex, locale: LocaleCode): GlobalMapDescription {
  const view = computeGlobalMapView(index, locale);
  const caption = locale === 'es' ? 'Mapa global del ecosistema' : 'Global ecosystem map';
  const description =
    locale === 'es'
      ? `${view.shownEntities} de ${view.totalEntities} entidades.${view.truncated ? ' Algunas relaciones se agrupan por presupuesto de legibilidad (I28).' : ''}`
      : `${view.shownEntities} of ${view.totalEntities} entities.${view.truncated ? ' Some relationships are grouped to fit the legibility budget (I28).' : ''}`;

  const shown = new Set(view.nodes.keys());
  const rows: GlobalMapDescription['rows'] = [];
  const seen = new Set<string>();
  for (const id of shown) {
    for (const e of index.outgoing.get(id) ?? []) {
      if (e.derived || !shown.has(e.to)) continue;
      const key = `${e.from}|${e.predicate}|${e.to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        subjectName: displayName(index, e.from, locale),
        subjectType: index.entities.get(e.from)?.type ?? 'unknown',
        predicateLabel: predicateLabel(index, e.predicate, locale),
        objectName: displayName(index, e.to, locale),
        objectType: index.entities.get(e.to)?.type ?? 'unknown',
        since: e.since,
        note: e.note,
      });
    }
  }
  rows.sort((a, b) => a.subjectName.localeCompare(b.subjectName) || a.objectName.localeCompare(b.objectName));

  return { caption, description, rows };
}

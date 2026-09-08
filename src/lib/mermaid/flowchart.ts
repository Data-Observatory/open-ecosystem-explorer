// Focus diagram generator (specs.md §6.3 "Focus" row, §6.4, §6.5, Appendix
// B.2). PURE: only reads the already-built GraphIndex plus a locale code, no
// file IO, no Astro (rule A1). Deterministic (A3): every collection below is
// walked in a stable sort order, so calling this twice for the same inputs
// produces byte-identical output.
import type { CrossCuttingLayer, EntityId, EntityType, GraphEdge, GraphIndex, Layer, PredicateId } from '../model/types.js';
import type { LocaleCode } from '../../i18n/locales.js';
import { toNodeId, quoteLabel } from './ids.js';
import { shapeForLayer, wrapShape, classDefLine, classNameForType } from './palette.js';
import { collapseByPredicate, clusterLabel, FOCUS_NEIGHBOUR_CAP, trimToCap, type CollapsibleEdge } from './budget.js';

export interface FocusDiagramOptions {
  /** 1 = direct neighbourhood only (default); 2 = the prerendered ?depth=2 variant (§6.3 "Neighbourhood"). */
  depth?: 1 | 2;
}

export interface NodeSpec {
  id: EntityId;
  type: EntityType;
  name: string;
  cluster?: { count: number; ofType: EntityType };
}

export interface EdgeSpec {
  from: EntityId;
  to: EntityId;
  predicate: PredicateId;
  style: 'solid' | 'dashed' | 'thick';
  label: string;
  since?: string;
  until?: string;
  note?: string;
  /** A "sibling" edge: not incident on the focus entity, shown for context
   *  because it shares a (predicate, neighbour) pair with one of the focus
   *  entity's own edges (Appendix B.2 — Dimensions/Symplectic Elements shown
   *  as siblings of Figshare under their shared owner, Digital Science). */
  sibling?: boolean;
}

export interface FocusView {
  nodes: Map<EntityId, NodeSpec>;
  edges: EdgeSpec[];
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function displayName(index: GraphIndex, id: EntityId, locale: LocaleCode): string {
  const prose = index.prose.get(locale)?.get(id);
  return prose?.name ?? index.entities.get(id)?.name ?? id;
}

function predicateLabel(index: GraphIndex, predicate: PredicateId, locale: LocaleCode): string {
  const def = index.predicates.get(predicate);
  return def?.label[locale] ?? predicate;
}

function entityUrl(locale: LocaleCode, id: EntityId): string {
  return `/${locale}/entity/${id}`;
}

/**
 * Entity + 1-hop neighbourhood (in and out), plus the "sibling" extension
 * from Appendix B.2: for each outgoing edge (focus -> neighbour, predicate P),
 * any *other* entity that also reaches that same neighbour via the same P is
 * pulled in as a dashed-edge sibling, since it shares the same edge's real
 * "read" — that a neighbour is a shared parent/target, not unique to the
 * focus entity. Scoped to the outgoing side only (deliberate — see report).
 *
 * Exported separately from rendering (A9.3): `describeFocusEntity` in
 * src/lib/a11y/describe.ts calls this SAME function so the diagram and its
 * mandatory accessible table can never show a different edge set.
 */
export function computeFocusView(index: GraphIndex, entityId: EntityId, locale: LocaleCode, opts: FocusDiagramOptions = {}): FocusView {
  const entity = index.entities.get(entityId);
  if (!entity) throw new Error(`computeFocusView: unknown entity '${entityId}'`);
  const depth = opts.depth ?? 1;

  const outgoing = (index.outgoing.get(entityId) ?? []).slice().sort(compareEdges);
  const incoming = (index.incoming.get(entityId) ?? []).slice().sort(compareEdges);

  const nodes = new Map<EntityId, NodeSpec>();
  const edges: EdgeSpec[] = [];
  nodes.set(entityId, { id: entityId, type: entity.type, name: displayName(index, entityId, locale) });

  function addNode(id: EntityId): void {
    if (nodes.has(id)) return;
    const e = index.entities.get(id);
    if (!e) return; // dangling refs are an I3 build error elsewhere; a diagram must still degrade, not throw
    nodes.set(id, { id, type: e.type, name: displayName(index, id, locale) });
  }

  // --- Direct 1-hop edges, with per-predicate collapsing (§6.4) ---
  const outCollapsible: CollapsibleEdge<GraphEdge>[] = outgoing.map((e) => ({ predicate: e.predicate, neighbour: e.to, payload: e }));
  const { visible: outVisible, collapsed: outCollapsed } = collapseByPredicate(outCollapsible, (p) => index.predicates.get(p)?.maxOutDegree ?? 5);

  for (const { payload: e } of outVisible) {
    addNode(e.to);
    const def = index.predicates.get(e.predicate);
    edges.push({
      from: entityId,
      to: e.to,
      predicate: e.predicate,
      style: def?.style.line === 'thick' ? 'thick' : def?.style.line === 'dashed' ? 'dashed' : 'solid',
      label: predicateLabel(index, e.predicate, locale),
      since: e.since,
      until: e.until,
      note: e.note,
    });
  }
  for (const group of outCollapsed) {
    const ofType = index.entities.get(group.hidden[0]!.neighbour)?.type ?? entity.type;
    const clusterId = `${entityId}__cluster__${group.predicate}`;
    nodes.set(clusterId, { id: clusterId, type: ofType, name: clusterLabel(group.hidden.length, ofType), cluster: { count: group.hidden.length, ofType } });
    const def = index.predicates.get(group.predicate);
    edges.push({
      from: entityId,
      to: clusterId,
      predicate: group.predicate,
      style: def?.style.line === 'thick' ? 'thick' : def?.style.line === 'dashed' ? 'dashed' : 'solid',
      label: predicateLabel(index, group.predicate, locale),
    });
  }

  const inCollapsible: CollapsibleEdge<GraphEdge>[] = incoming.map((e) => ({ predicate: e.predicate, neighbour: e.from, payload: e }));
  const { visible: inVisible } = collapseByPredicate(inCollapsible, (p) => index.predicates.get(p)?.maxOutDegree ?? 5);
  for (const { payload: e } of inVisible) {
    addNode(e.from);
    const def = index.predicates.get(e.predicate);
    edges.push({
      from: e.from,
      to: entityId,
      predicate: e.predicate,
      style: def?.style.line === 'thick' ? 'thick' : def?.style.line === 'dashed' ? 'dashed' : 'solid',
      label: predicateLabel(index, e.predicate, locale),
      since: e.since,
      until: e.until,
      note: e.note,
    });
  }

  // --- Sibling extension (Appendix B.2), outgoing side only ---
  if (depth === 1 || depth === 2) {
    for (const { payload: e } of outVisible) {
      const siblingEdges = (index.incoming.get(e.to) ?? [])
        .filter((sib) => sib.from !== entityId && sib.predicate === e.predicate)
        .sort(compareEdges);
      for (const sib of siblingEdges) {
        addNode(sib.from);
        edges.push({
          from: sib.from,
          to: e.to,
          predicate: sib.predicate,
          style: 'dashed',
          label: predicateLabel(index, sib.predicate, locale),
          since: sib.since,
          until: sib.until,
          note: sib.note,
          sibling: true,
        });
      }
    }
  }

  // --- Budget: Focus diagram's own tighter neighbour cap (§6.3) ---
  const neighbourIds = [...nodes.keys()].filter((id) => id !== entityId);
  if (neighbourIds.length > FOCUS_NEIGHBOUR_CAP) {
    const sorted = neighbourIds.slice().sort(compareIds);
    const { kept } = trimToCap(sorted, FOCUS_NEIGHBOUR_CAP);
    const keepSet = new Set([entityId, ...kept]);
    for (const id of [...nodes.keys()]) if (!keepSet.has(id)) nodes.delete(id);
    for (let i = edges.length - 1; i >= 0; i--) {
      if (!keepSet.has(edges[i]!.from) || !keepSet.has(edges[i]!.to)) edges.splice(i, 1);
    }
  }

  return { nodes, edges };
}

/** Renders the Focus diagram's Mermaid source (§6.3). Thin wrapper over
 *  `computeFocusView` — see that function for the actual neighbourhood/
 *  sibling/collapsing logic shared with the accessible-table generator. */
export function buildFocusDiagram(index: GraphIndex, entityId: EntityId, locale: LocaleCode, opts: FocusDiagramOptions = {}): string {
  const view = computeFocusView(index, entityId, locale, opts);
  return renderMermaidSource(index, view.nodes, view.edges, locale);
}

function compareEdges(a: GraphEdge, b: GraphEdge): number {
  return compareIds(a.from, b.from) || a.predicate.localeCompare(b.predicate) || compareIds(a.to, b.to);
}

/**
 * Generic node/edge -> Mermaid `flowchart` source renderer. Exported for
 * reuse by every other flowchart-shaped diagram (layer stack, type map,
 * predicate map, §6.3) so the shape/fill/line-style/click-directive
 * conventions live in exactly one place, per the Phase 2 rule that no new
 * diagram type invents its own rendering.
 */
export function renderMermaidSource(index: GraphIndex, nodes: Map<EntityId, NodeSpec>, edges: EdgeSpec[], locale: LocaleCode): string {
  const lines: string[] = ['flowchart LR'];

  // GraphIndex stores layer only as the already-derived byLayer bucket (types
  // are never re-derived outside buildIndex, per A5) — recover a per-id layer
  // lookup from it once, rather than threading the vocab through every call site.
  const layerById = new Map<EntityId, Layer | CrossCuttingLayer>();
  for (const [layer, ids] of index.byLayer) for (const id of ids) layerById.set(id, layer);
  // Cluster nodes are synthetic (never in byLayer) — they inherit their
  // constituent entities' layer, computed when they were created.
  for (const [id, n] of nodes) {
    if (n.cluster && !layerById.has(id)) {
      const sampleLayer = [...index.byLayer.entries()].find(([, ids]) => ids.some((i) => index.entities.get(i)?.type === n.cluster!.ofType))?.[0];
      layerById.set(id, sampleLayer ?? 'cross-cutting');
    }
  }

  const sortedNodeIds = [...nodes.keys()].sort(compareIds);
  for (const id of sortedNodeIds) {
    const n = nodes.get(id)!;
    const shape = shapeForLayer(layerById.get(id) ?? 'cross-cutting');
    const label = quoteLabel(n.name);
    lines.push(`  ${wrapShape(shape, toNodeId(id), label)}:::${classNameForType(n.type)}`);
  }

  lines.push('');
  const sortedEdges = edges.slice().sort((a, b) => compareIds(a.from, b.from) || a.predicate.localeCompare(b.predicate) || compareIds(a.to, b.to));
  for (const e of sortedEdges) {
    const arrow = e.style === 'thick' ? '==>' : e.style === 'dashed' ? '-.->' : '-->';
    lines.push(`  ${toNodeId(e.from)} ${arrow}|${e.label}| ${toNodeId(e.to)}`);
  }

  lines.push('');
  for (const id of sortedNodeIds) {
    lines.push(`  click ${toNodeId(id)} href "${entityUrl(locale, id)}"`);
  }

  const typesUsed = [...new Set(sortedNodeIds.map((id) => nodes.get(id)!.type))].sort();
  for (const type of typesUsed) {
    lines.push(`  ${classDefLine(type)}`);
  }

  return lines.join('\n');
}

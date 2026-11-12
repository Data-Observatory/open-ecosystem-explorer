// Accessible-equivalent generator (specs.md §9.1 A9.1-A9.3, A9.6). Pure.
// A9.3 requires the caption/description/table to come from the SAME edge
// list that produced the diagram, so it cannot drift — this module consumes
// `computeFocusView` from the Mermaid generator directly rather than
// re-deriving the neighbourhood/sibling/collapsing logic independently.
import type { EntityId, GraphIndex } from '../model/types.js';
import type { LocaleCode } from '../../i18n/locales.js';
import { computeFocusView, type EdgeSpec, type FocusDiagramOptions } from '../mermaid/flowchart.js';

export interface AccessibleRow {
  subjectId: EntityId;
  subjectName: string;
  subjectType: string; // A9.6 — type named in text, since a diagram encodes it by colour
  predicateLabel: string;
  objectId: EntityId;
  objectName: string;
  objectType: string;
  since?: string;
  until?: string;
  note?: string;
}

export interface DiagramDescription {
  caption: string; // <figcaption>
  description: string; // aria-describedby text
  rows: AccessibleRow[]; // A9.2 — complete set, including anything the diagram collapsed into a cluster node
}

function name(index: GraphIndex, id: EntityId, locale: LocaleCode): string {
  return index.prose.get(locale)?.get(id)?.name ?? index.entities.get(id)?.name ?? id;
}

function typeLabel(index: GraphIndex, id: EntityId): string {
  return index.entities.get(id)?.type ?? 'unknown';
}

/**
 * A9.2: cluster nodes are a diagram-only economy — this expands each
 * collapsed cluster back into one row per real hidden edge, so the table is
 * never a lossy subset of what the diagram (before collapsing) represents.
 */
function expandRow(index: GraphIndex, edge: EdgeSpec, locale: LocaleCode): AccessibleRow[] {
  const targetIsCluster = edge.to.includes('__cluster__');
  const sourceIsCluster = edge.from.includes('__cluster__');
  if (!targetIsCluster && !sourceIsCluster) {
    return [
      {
        subjectId: edge.from,
        subjectName: name(index, edge.from, locale),
        subjectType: typeLabel(index, edge.from),
        predicateLabel: edge.label,
        objectId: edge.to,
        objectName: name(index, edge.to, locale),
        objectType: typeLabel(index, edge.to),
        since: edge.since,
        until: edge.until,
        note: edge.note,
      },
    ];
  }
  // Re-expand the cluster from the index directly: a cluster node only ever
  // appears on the outgoing side of `computeFocusView` (see flowchart.ts),
  // one predicate at a time, so the real edges are exactly the source's
  // outgoing edges of that predicate.
  const [ownerId, predicate] = edge.from.includes('__cluster__') ? edge.from.split('__cluster__') : edge.to.split('__cluster__');
  const owner = ownerId!;
  const real = (index.outgoing.get(owner) ?? []).filter((e) => e.predicate === (predicate as typeof e.predicate));
  return real.map((e) => ({
    subjectId: e.from,
    subjectName: name(index, e.from, locale),
    subjectType: typeLabel(index, e.from),
    predicateLabel: edge.label,
    objectId: e.to,
    objectName: name(index, e.to, locale),
    objectType: typeLabel(index, e.to),
    since: e.since,
    until: e.until,
    note: e.note,
  }));
}

/** Focus-entity caption + description + the complete accessible table (Appendix B.3). */
export function describeFocusEntity(index: GraphIndex, entityId: EntityId, locale: LocaleCode, opts: FocusDiagramOptions = {}): DiagramDescription {
  const view = computeFocusView(index, entityId, locale, opts);
  const rows = view.edges.flatMap((e) => expandRow(index, e, locale));

  const subjectName = name(index, entityId, locale);
  const es = locale === 'es';
  const caption = es ? `${subjectName} — relaciones` : `${subjectName} — relationships`;

  const outgoing = index.outgoing.get(entityId) ?? [];
  const incoming = index.incoming.get(entityId) ?? [];
  const ownedByEdge = outgoing.find((e) => e.predicate === 'owned-by');
  let description = es
    ? `${subjectName} tiene ${outgoing.length} relaciones salientes y ${incoming.length} entrantes.`
    : `${subjectName} has ${outgoing.length} outgoing and ${incoming.length} incoming relationships.`;
  if (ownedByEdge) {
    const ownerName = name(index, ownedByEdge.to, locale);
    const ownerSiblings = (index.incoming.get(ownedByEdge.to) ?? []).filter((e) => e.predicate === 'owned-by' && e.from !== entityId);
    if (ownerSiblings.length > 0) {
      const siblingNames = ownerSiblings.map((e) => `${name(index, e.from, locale)} (${typeLabel(index, e.from)})`).join(es ? ' y ' : ' and ');
      description += es ? ` Su propietario, ${ownerName}, también posee ${siblingNames}.` : ` Its owner, ${ownerName}, also owns ${siblingNames}.`;
    }
  }

  return { caption, description, rows };
}

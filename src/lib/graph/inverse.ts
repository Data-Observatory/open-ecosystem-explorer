import type { GraphEdge, GraphIndex, LocaleMap } from '../model/types.js';

/** The label to draw on an edge from the perspective of its `to` entity (the inverse view). */
export function inverseLabelFor(index: GraphIndex, edge: GraphEdge, locale: string): string {
  const def = index.predicates.get(edge.predicate);
  const map: LocaleMap | undefined = def?.inverseLabel;
  return map?.[locale as keyof LocaleMap] ?? edge.predicate;
}

/** The label to draw on an edge from the perspective of its `from` entity (the authored, active-voice view). */
export function labelFor(index: GraphIndex, edge: GraphEdge, locale: string): string {
  const def = index.predicates.get(edge.predicate);
  const map: LocaleMap | undefined = def?.label;
  return map?.[locale as keyof LocaleMap] ?? edge.predicate;
}

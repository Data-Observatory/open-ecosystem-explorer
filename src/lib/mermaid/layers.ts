// Layer-stack diagram (specs.md §6.3 "Layer stack" row): the memo's own
// four-layer model plus the regional layer, the cross-cutting band [M§1]
// and the concept layer (omitted while it has no entities) — the site's primary orientation diagram. PURE (rule A1):
// structural only (layer -> type -> count), no individual entities or
// edges, since this diagram answers "what lives where", not "who relates
// to whom" (that's Focus/Predicate-map's job).
import type { EntityType, GraphIndex, Layer, CrossCuttingLayer } from '../model/types.js';
import { LAYERS } from '../model/types.js';
import type { LocaleCode } from '../../i18n/locales.js';
import { toNodeId, quoteLabel } from './ids.js';
import { classDefLine, classNameForType } from './palette.js';
import type { EntityTypesVocab } from '../model/vocab.js';

/** Display order matches the memo's own layer stack [M§1] plus regional and
 *  the cross-cutting band last, per §6.3. */
export const LAYER_ORDER: readonly (Layer | CrossCuttingLayer)[] = LAYERS;

/** The memo's own name for each layer [M§1] — a grouping concept, not an
 *  authorable vocabulary term, so it lives here rather than in a vocab file.
 *  Single copy: taxonomy.ts and the pages import it. */
export const LAYER_LABELS: Record<Layer | CrossCuttingLayer, Record<LocaleCode, string>> = {
  identifier: { es: 'Identificadores', en: 'Identifiers' },
  agency: { es: 'Agencias de registro', en: 'Registration agencies' },
  index: { es: 'Índices', en: 'Indices' },
  'institutional-system': { es: 'Sistemas institucionales', en: 'Institutional systems' },
  regional: { es: 'Capa regional', en: 'Regional layer' },
  'cross-cutting': { es: 'Banda transversal', en: 'Cross-cutting band' },
  concept: { es: 'Conceptos', en: 'Concepts' },
};

export interface LayerRow {
  layer: Layer | CrossCuttingLayer;
  layerLabel: string;
  type: EntityType;
  typeLabel: string;
  count: number;
}

function layerLabel(vocab: EntityTypesVocab, layer: Layer | CrossCuttingLayer, locale: LocaleCode, index: GraphIndex): string {
  void vocab;
  void index;
  return LAYER_LABELS[layer][locale];
}

function typeLabel(vocab: EntityTypesVocab, type: EntityType, locale: LocaleCode): string {
  return vocab.get(type)?.label[locale] ?? type;
}

/** One row per (layer, type) that has ≥1 entity — types with zero instances
 *  are omitted (I12 guarantees every non-`pending` type has ≥1 — `concept` may
 *  have none yet — and a diagram must still degrade against a smaller/test index). */
export function computeLayerRows(index: GraphIndex, vocab: EntityTypesVocab, locale: LocaleCode): LayerRow[] {
  const rows: LayerRow[] = [];
  for (const layer of LAYER_ORDER) {
    const typesInLayer = [...vocab.entries()].filter(([, e]) => e.layer === layer).map(([t]) => t);
    typesInLayer.sort();
    for (const type of typesInLayer) {
      const count = index.byType.get(type)?.length ?? 0;
      if (count === 0) continue;
      rows.push({ layer, layerLabel: layerLabel(vocab, layer, locale, index), type, typeLabel: typeLabel(vocab, type, locale), count });
    }
  }
  return rows;
}

function layerNodeId(layer: Layer | CrossCuttingLayer): string {
  return `layer_${layer.replace(/-/g, '_')}`;
}

/** `flowchart TB` with one `subgraph` per layer, one node per type in that
 *  layer, labelled "Type (N)". Click targets go to /{locale}/entities/{type}. */
export function buildLayerStackDiagram(index: GraphIndex, vocab: EntityTypesVocab, locale: LocaleCode): string {
  const rows = computeLayerRows(index, vocab, locale);
  const lines: string[] = ['flowchart TB'];

  for (const layer of LAYER_ORDER) {
    const layerRows = rows.filter((r) => r.layer === layer);
    if (layerRows.length === 0) continue;
    lines.push(`  subgraph ${layerNodeId(layer)} ["${layerRows[0]!.layerLabel}"]`);
    for (const row of layerRows) {
      lines.push(`    ${toNodeId(row.type)}[${quoteLabel(`${row.typeLabel} (${row.count})`)}]:::${classNameForType(row.type)}`);
    }
    lines.push('  end');
  }

  lines.push('');
  for (const row of rows) {
    lines.push(`  click ${toNodeId(row.type)} href "/${locale}/entities/${row.type}/"`);
  }

  const typesUsed = [...new Set(rows.map((r) => r.type))].sort();
  for (const type of typesUsed) lines.push(`  ${classDefLine(type)}`);

  return lines.join('\n');
}

export interface LayerStackDescription {
  caption: string;
  description: string;
  rows: { subjectName: string; subjectType: string; predicateLabel: string; objectName: string; objectType: string; note?: string }[];
}

/** Accessible-table equivalent (§9): same (layer, type, count) facts as the
 *  diagram, reusing Diagram.astro's row shape ("Contains" as a stand-in
 *  predicate label) unchanged — no second accessibility pattern invented. */
export function describeLayerStack(index: GraphIndex, vocab: EntityTypesVocab, locale: LocaleCode): LayerStackDescription {
  const rows = computeLayerRows(index, vocab, locale);
  const contains = locale === 'es' ? 'contiene' : 'contains';
  return {
    caption: locale === 'es' ? 'El modelo de cuatro capas' : 'The four-layer model',
    description:
      locale === 'es'
        ? `${rows.length} tipos de entidad agrupados en ${new Set(rows.map((r) => r.layer)).size} capas.`
        : `${rows.length} entity types grouped into ${new Set(rows.map((r) => r.layer)).size} layers.`,
    rows: rows.map((r) => ({
      subjectName: r.layerLabel,
      subjectType: 'layer',
      predicateLabel: contains,
      objectName: `${r.typeLabel} (${r.count})`,
      objectType: 'type',
    })),
  };
}

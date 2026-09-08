// Taxonomy mindmap (specs.md §6.3 "Taxonomy" row): layer -> type -> subtype
// -> tag groups, drilling into filtered indexes. PURE (rule A1). Mermaid
// `mindmap` syntax uses indentation for hierarchy, not node-id/shape/click
// directives like flowchart — Mermaid's mindmap renderer does not support
// `click` directives, so real navigation lives entirely in the paired
// accessible table below the diagram (§9's "no information is diagram-only"
// rule is satisfied by the table carrying working links, not the diagram
// itself).
//
// root -> layer -> type -> subtype -> tag is 4 levels under the root (5 with
// root), within the spec's 5-level cap. The subtype level (via
// `model/subtypes.ts`) is omitted for a type when it has no dedicated Kind
// field (`identifier`, `agency` — §5.2) or an instance leaves it unset.
import type { EntityType, GraphIndex } from '../model/types.js';
import type { LocaleCode } from '../../i18n/locales.js';
import { LAYER_ORDER } from './layers.js';
import type { EntityTypesVocab, SimpleVocab } from '../model/vocab.js';
import { subtypeOf, humanizeSubtype } from '../model/subtypes.js';

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function mindmapEscape(text: string): string {
  // Mermaid mindmap node text is plain (no quoting syntax); parentheses and
  // brackets are shape delimiters, so strip characters that would otherwise
  // be misread as shape syntax rather than label text.
  return text.replace(/[()[\]{}]/g, '');
}

export interface TaxonomyRow {
  layerLabel: string;
  typeLabel: string;
  type: EntityType;
  subtypeLabel?: string;
  subtype?: string;
  tagLabel: string;
  tag: string;
  count: number;
}

export function computeTaxonomyRows(
  index: GraphIndex,
  typeVocab: EntityTypesVocab,
  tagsVocab: SimpleVocab,
  locale: LocaleCode,
): TaxonomyRow[] {
  const LAYER_LABELS: Record<string, Record<LocaleCode, string>> = {
    identifier: { es: 'Identificadores', en: 'Identifiers' },
    agency: { es: 'Agencias de registro', en: 'Registration agencies' },
    index: { es: 'Índices', en: 'Indices' },
    'institutional-system': { es: 'Sistemas institucionales', en: 'Institutional systems' },
    regional: { es: 'Capa regional', en: 'Regional layer' },
    'cross-cutting': { es: 'Banda transversal', en: 'Cross-cutting band' },
  };

  const rows: TaxonomyRow[] = [];
  for (const layer of LAYER_ORDER) {
    const typesInLayer = [...typeVocab.entries()].filter(([, e]) => e.layer === layer).map(([t]) => t).sort();
    for (const type of typesInLayer) {
      const ids = index.byType.get(type) ?? [];
      if (ids.length === 0) continue;
      // Group by subtype first (undefined subtype -> one bucket, same as
      // the pre-subtype behaviour) so tag counts stay scoped per subtype.
      const bySubtype = new Map<string | undefined, string[]>();
      for (const id of ids) {
        const subtype = subtypeOf(index.entities.get(id)!);
        if (!bySubtype.has(subtype)) bySubtype.set(subtype, []);
        bySubtype.get(subtype)!.push(id);
      }
      const sortedSubtypes = [...bySubtype.keys()].sort((a, b) => compareIds(a ?? '', b ?? ''));
      for (const subtype of sortedSubtypes) {
        const idsInSubtype = bySubtype.get(subtype)!;
        const tagCounts = new Map<string, number>();
        for (const id of idsInSubtype) {
          for (const tag of index.entities.get(id)?.tags ?? []) {
            tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
          }
        }
        const sortedTags = [...tagCounts.entries()].sort((a, b) => compareIds(a[0], b[0]));
        for (const [tag, count] of sortedTags) {
          rows.push({
            layerLabel: LAYER_LABELS[layer]![locale],
            typeLabel: typeVocab.get(type)?.label[locale] ?? type,
            type,
            subtypeLabel: subtype ? humanizeSubtype(subtype) : undefined,
            subtype,
            tagLabel: tagsVocab.get(tag)?.label[locale] ?? tag,
            tag,
            count,
          });
        }
      }
    }
  }
  return rows;
}

/** `mindmap`: root -> layer -> type -> tag (label only, count in parens
 *  stripped of mindmap-unsafe characters). */
export function buildTaxonomyMindmap(
  index: GraphIndex,
  typeVocab: EntityTypesVocab,
  tagsVocab: SimpleVocab,
  locale: LocaleCode,
): string {
  const rows = computeTaxonomyRows(index, typeVocab, tagsVocab, locale);
  const lines: string[] = ['mindmap', `  root((${mindmapEscape(locale === 'es' ? 'Ecosistema' : 'Ecosystem')}))`];

  const byLayer = new Map<string, Map<string, Map<string | undefined, TaxonomyRow[]>>>();
  for (const row of rows) {
    if (!byLayer.has(row.layerLabel)) byLayer.set(row.layerLabel, new Map());
    const byType = byLayer.get(row.layerLabel)!;
    if (!byType.has(row.typeLabel)) byType.set(row.typeLabel, new Map());
    const bySubtype = byType.get(row.typeLabel)!;
    if (!bySubtype.has(row.subtypeLabel)) bySubtype.set(row.subtypeLabel, []);
    bySubtype.get(row.subtypeLabel)!.push(row);
  }

  for (const [layerLabel, byType] of byLayer) {
    lines.push(`    ${mindmapEscape(layerLabel)}`);
    for (const [typeLabel, bySubtype] of byType) {
      lines.push(`      ${mindmapEscape(typeLabel)}`);
      for (const [subtypeLabel, subtypeRows] of bySubtype) {
        if (subtypeLabel) {
          lines.push(`        ${mindmapEscape(subtypeLabel)}`);
          for (const row of subtypeRows) {
            lines.push(`          ${mindmapEscape(row.tagLabel)} ${row.count}`);
          }
        } else {
          // No subtype field for this type (e.g. identifier, agency) — tags
          // sit directly under the type, same as before this level existed.
          for (const row of subtypeRows) {
            lines.push(`        ${mindmapEscape(row.tagLabel)} ${row.count}`);
          }
        }
      }
    }
  }

  return lines.join('\n');
}

export interface TaxonomyDescription {
  caption: string;
  description: string;
  rows: { subjectName: string; subjectType: string; predicateLabel: string; objectName: string; objectType: string; note?: string; href: string }[];
}

/** Accessible-table equivalent (§9): unlike the mindmap, this table carries
 *  REAL working links (mindmap has no click-directive support), so it is
 *  not merely a description of the diagram but the diagram's sole means of
 *  navigation — satisfying "no information is diagram-only" by construction. */
export function describeTaxonomy(
  index: GraphIndex,
  typeVocab: EntityTypesVocab,
  tagsVocab: SimpleVocab,
  locale: LocaleCode,
): TaxonomyDescription {
  const rows = computeTaxonomyRows(index, typeVocab, tagsVocab, locale);
  const layerOf = locale === 'es' ? 'contiene' : 'contains';
  return {
    caption: locale === 'es' ? 'Taxonomía: capa, tipo y etiqueta' : 'Taxonomy: layer, type and tag',
    description:
      locale === 'es'
        ? `${new Set(rows.map((r) => r.type)).size} tipos, ${new Set(rows.map((r) => r.tag)).size} etiquetas distintas.`
        : `${new Set(rows.map((r) => r.type)).size} types, ${new Set(rows.map((r) => r.tag)).size} distinct tags.`,
    rows: rows.map((r) => ({
      subjectName: r.subtypeLabel ? `${r.typeLabel} — ${r.subtypeLabel}` : r.typeLabel,
      subjectType: r.subtypeLabel ? 'subtype' : 'type',
      predicateLabel: layerOf,
      objectName: `${r.tagLabel} (${r.count})`,
      objectType: 'tag',
      href: `/${locale}/entities/${r.type}/?tag=${encodeURIComponent(r.tag)}`,
    })),
  };
}

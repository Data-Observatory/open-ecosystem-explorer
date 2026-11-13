// Loads the view facts (src/content/views) and their per-locale prose
// (src/content/i18n/<locale>/views) into simple maps (specs.md
// §5.6). Small enough not to warrant folding into site-index.ts's GraphIndex
// — views are never nodes/edges, so they don't belong in the graph index.
import { loadYamlCollection } from './loaders.js';
import { zView, zViewProseFile } from '../lib/model/schema.js';
import type { Source, ViewQuery } from '../lib/model/types.js';
import { locales, defaultLocale, type LocaleCode } from '../i18n/locales.js';

export interface ViewFacts {
  id: string;
  query: ViewQuery;
  render: 'diagram' | 'table' | 'both';
  sources: Source[];
  lastReviewed: string;
}

export interface ViewProse {
  title: string;
  question: string;
  body: string;
}

export interface ViewsData {
  views: ReadonlyMap<string, ViewFacts>;
  prose: ReadonlyMap<LocaleCode, ReadonlyMap<string, ViewProse>>;
}

let cached: Promise<ViewsData> | undefined;

export function getViewsData(): Promise<ViewsData> {
  if (!cached) cached = build();
  return cached;
}

async function build(): Promise<ViewsData> {
  const entries = loadYamlCollection({ base: 'src/content/views', schema: zView.omit({ id: true }) });
  const views = new Map<string, ViewFacts>();
  for (const e of entries) {
    const data = e.data as unknown as Omit<ViewFacts, 'id'>;
    views.set(e.id, { id: e.id, ...data });
  }

  // View prose: src/content/i18n/<locale>/views/<id>.yaml.
  const proseEntries = loadYamlCollection({
    base: 'src/content/i18n',
    schema: zViewProseFile,
    match: (rel) => {
      const parts = rel.split('/');
      return parts.length === 3 && parts[1] === 'views';
    },
    localeAwareId: true,
  });
  const prose = new Map<LocaleCode, Map<string, ViewProse>>();
  for (const { code } of locales) prose.set(code, new Map());
  for (const e of proseEntries) {
    // id is `<locale>/views/<viewId>` (loaders.ts's localeAwareId).
    const parts = e.id.split('/');
    const locale = parts[0] as LocaleCode;
    const viewId = parts[2] as string;
    prose.get(locale)?.set(viewId, e.data as unknown as ViewProse);
  }

  return { views, prose };
}

export interface ResolvedViewProse {
  prose: ViewProse;
  localeUsed: LocaleCode;
  fallback: boolean;
}

/** Same fallback shape as src/lib/i18n/resolve.ts's resolveProse, for views. */
export function resolveViewProse(data: ViewsData, viewId: string, locale: LocaleCode): ResolvedViewProse {
  const requested = data.prose.get(locale)?.get(viewId);
  if (requested) return { prose: requested, localeUsed: locale, fallback: false };
  const fallback = data.prose.get(defaultLocale)?.get(viewId);
  if (!fallback) throw new Error(`resolveViewProse: no ${defaultLocale} prose for view '${viewId}'`);
  return { prose: fallback, localeUsed: defaultLocale, fallback: locale !== defaultLocale };
}

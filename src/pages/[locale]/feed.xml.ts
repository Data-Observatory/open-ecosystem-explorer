// specs.md §7 `/{loc}/feed.xml` row: "one feed per locale carrying dataset
// changes." No per-entity change history exists yet beyond `lastReviewed`
// (§12 Q6: git history + CHANGELOG.md is the confirmed v1 versioning story) —
// judgment call: the most-recently-reviewed entities stand in for "recent
// changes" until a real changelog-per-entity mechanism exists.
import type { APIRoute } from 'astro';
import { getSiteIndex } from '../../content/site-index.js';
import { resolveProse } from '../../lib/i18n/resolve.js';
import { locales, type LocaleCode } from '../../i18n/locales.js';

export async function getStaticPaths() {
  return locales.map(({ code: locale }) => ({ params: { locale } }));
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const GET: APIRoute = async ({ params }) => {
  const locale = params.locale as LocaleCode;
  const index = await getSiteIndex();

  const items = [...index.entities.values()]
    .slice()
    .sort((a, b) => b.lastReviewed.localeCompare(a.lastReviewed))
    .slice(0, 30)
    .map((e) => {
      const { prose } = resolveProse(index, e.id, locale);
      return `  <item>\n    <title>${esc(prose.name ?? e.name)}</title>\n    <link>/${locale}/entity/${e.id}/</link>\n    <guid>/${locale}/entity/${e.id}/</guid>\n    <pubDate>${new Date(e.lastReviewed).toUTCString()}</pubDate>\n    <description>${esc(prose.summary)}</description>\n  </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>\n  <title>openscience-ecosystem (${locale})</title>\n  <link>/${locale}/</link>\n  <description>${locale === 'es' ? 'Cambios recientes en el conjunto de datos' : 'Recent dataset changes'}</description>\n${items}\n</channel></rss>\n`;

  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml' } });
};

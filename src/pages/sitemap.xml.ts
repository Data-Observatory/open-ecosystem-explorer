// specs.md §7 `/sitemap.xml` row: "lists every locale with hreflang
// alternates." Built from the real content set rather than a static list,
// so it can't drift from what the site actually generates.
import type { APIRoute } from 'astro';
import { getSiteIndex } from '../content/site-index.js';
import { getViewsData } from '../content/views-index.js';
import { locales } from '../i18n/locales.js';
import { PREDICATE_IDS, ENTITY_TYPES } from '../lib/model/types.js';

const STATIC_PATHS = ['', 'layers', 'map', 'entities', 'relations', 'taxonomy', 'model', 'views', 'search', 'about', 'contribute', 'changelog'];

export const GET: APIRoute = async () => {
  const index = await getSiteIndex();
  const viewsData = await getViewsData();

  const paths: string[] = [
    ...STATIC_PATHS,
    ...[...index.entities.keys()].map((id) => `entity/${id}`),
    ...ENTITY_TYPES.map((t) => `entities/${t}`),
    ...PREDICATE_IDS.map((p) => `relations/${p}`),
    ...[...viewsData.views.keys()].map((id) => `views/${id}`),
  ];

  const urls = paths
    .map((path) => {
      const alternates = locales.map((l) => `    <xhtml:link rel="alternate" hreflang="${l.code}" href="/${l.code}/${path}"/>`).join('\n');
      return locales
        .map(
          (l) =>
            `  <url>\n    <loc>/${l.code}/${path}</loc>\n${alternates}\n  </url>`,
        )
        .join('\n');
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;

  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
};

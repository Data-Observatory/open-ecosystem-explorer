// specs.md §7 `/data/graph.json` row: full dump, locale-free, all locales'
// prose in a `prose: { es, en }` map. Stable, documented shape (buildGraphExport).
import type { APIRoute } from 'astro';
import { getSiteIndex } from '../../content/site-index.js';
import { buildGraphExport } from '../../lib/export/build-export.js';

export const GET: APIRoute = async () => {
  const index = await getSiteIndex();
  const body = JSON.stringify(buildGraphExport(index), null, 2);
  return new Response(body, { headers: { 'Content-Type': 'application/json' } });
};

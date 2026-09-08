import type { APIRoute } from 'astro';
import { getSiteIndex } from '../../content/site-index.js';
import { buildGraphExport, toRelationsCsv } from '../../lib/export/build-export.js';

export const GET: APIRoute = async () => {
  const index = await getSiteIndex();
  const csv = toRelationsCsv(buildGraphExport(index));
  return new Response(csv, { headers: { 'Content-Type': 'text/csv' } });
};

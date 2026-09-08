// specs.md §7 `/entity/[id].json` row: per-entity record including derived
// inverse relations, locale-free (top-level, not under [locale]).
import type { APIRoute } from 'astro';
import { getSiteIndex } from '../../content/site-index.js';
import { exportEntity } from '../../lib/export/build-export.js';

export async function getStaticPaths() {
  const index = await getSiteIndex();
  return [...index.entities.keys()].map((id) => ({ params: { id } }));
}

export const GET: APIRoute = async ({ params }) => {
  const index = await getSiteIndex();
  const entity = exportEntity(index, params.id!);
  if (!entity) return new Response('Not found', { status: 404 });
  return new Response(JSON.stringify(entity, null, 2), { headers: { 'Content-Type': 'application/json' } });
};

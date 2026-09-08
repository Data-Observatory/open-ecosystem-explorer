// Per-locale search index (specs.md §6.6/§7 `/{loc}/search` row): "client-side
// fuzzy match over name, aka, summary, tags from a prebuilt index (<=80 KB),
// built per locale from that locale's resolved prose." A static Astro
// endpoint, not a page — fetched by the search page's inline script.
import type { APIRoute } from 'astro';
import { getSiteIndex } from '../content/site-index.js';
import { resolveProse } from '../lib/i18n/resolve.js';
import { locales, type LocaleCode } from '../i18n/locales.js';

export async function getStaticPaths() {
  return locales.map(({ code: locale }) => ({ params: { locale } }));
}

export const GET: APIRoute = async ({ params }) => {
  const locale = params.locale as LocaleCode;
  const index = await getSiteIndex();

  const entries = [...index.entities.values()].map((e) => {
    const { prose } = resolveProse(index, e.id, locale);
    return {
      id: e.id,
      name: prose.name ?? e.name,
      aka: prose.aka ?? e.aka ?? [],
      summary: prose.summary,
      tags: e.tags,
      type: e.type,
    };
  });

  return new Response(JSON.stringify(entries), {
    headers: { 'Content-Type': 'application/json' },
  });
};

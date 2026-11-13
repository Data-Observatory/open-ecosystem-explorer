import { graphJson } from '$lib/server/feeds';

// Full dump, locale-free, all locales' prose in a `prose: { es, en }` map (buildGraphExport).
export const prerender = true;

export const GET = async () =>
	new Response(await graphJson(), { headers: { 'Content-Type': 'application/json' } });

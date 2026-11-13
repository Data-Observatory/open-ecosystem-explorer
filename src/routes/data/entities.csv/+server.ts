import { entitiesCsv } from '$lib/server/feeds';

export const prerender = true;

export const GET = async () =>
	new Response(await entitiesCsv(), { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });

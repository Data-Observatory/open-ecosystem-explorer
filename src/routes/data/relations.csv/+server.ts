import { relationsCsv } from '#lib/server/feeds.ts';

export const prerender = true;

export const GET = async () =>
	new Response(await relationsCsv(), { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });

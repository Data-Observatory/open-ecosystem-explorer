import { robotsTxt } from '#lib/server/feeds.ts';
import { basePath } from '#lib/paths.ts';

export const prerender = true;
export const GET = () =>
	new Response(robotsTxt(basePath(), __SITE_URL__), { headers: { 'Content-Type': 'text/plain' } });

import { base } from '$app/paths';
import { robotsTxt } from '$lib/server/feeds';

export const prerender = true;

export const GET = () =>
	new Response(robotsTxt(base, __SITE_URL__), { headers: { 'Content-Type': 'text/plain' } });

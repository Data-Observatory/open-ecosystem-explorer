import { base } from '$app/paths';
import { sitemapXml } from '$lib/server/feeds';

export const prerender = true;

export const GET = async () =>
	new Response(await sitemapXml(base, __SITE_URL__), {
		headers: { 'Content-Type': 'application/xml' }
	});

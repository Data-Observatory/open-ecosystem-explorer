import { sitemapXml } from '#lib/server/feeds.ts';
import { basePath } from '#lib/paths.ts';

export const prerender = true;
export const GET = async () =>
	new Response(await sitemapXml(basePath(), __SITE_URL__), {
		headers: { 'Content-Type': 'application/xml' }
	});

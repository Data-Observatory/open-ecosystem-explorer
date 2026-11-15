import { feedXml } from '#lib/server/feeds.ts';
import { LOCALES, type Locale } from '#lib/locale.ts';
import * as m from '#lib/paraglide/messages.js';
import type { EntryGenerator } from './$types';
import { basePath } from '#lib/paths.ts';

// One feed per locale: the most recently reviewed entries stand in for "recent changes".
export const prerender = true;
export const trailingSlash = 'never';

export const entries: EntryGenerator = () => LOCALES.map((locale) => ({ locale }));

export const GET = async ({ params }) => {
	const locale = params.locale as Locale;
	const xml = await feedXml(locale, basePath(), __SITE_URL__, {
		title: m.site_name({}, { locale }),
		description: m.feed_description({}, { locale })
	});
	return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml' } });
};

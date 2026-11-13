import { searchIndexJson } from '$lib/server/feeds';
import { LOCALES, type Locale } from '$lib/locale';
import type { EntryGenerator } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => LOCALES.map((locale) => ({ locale }));

export const GET = async ({ params }) =>
	new Response(await searchIndexJson(params.locale as Locale), {
		headers: { 'Content-Type': 'application/json' }
	});

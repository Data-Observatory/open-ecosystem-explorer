import { error } from '@sveltejs/kit';
import { legacyPaths, legacyTarget } from '$lib/legacy-routes';
import { legacyVocab } from '$lib/server/legacy';
import { LOCALES } from '$lib/locale';
import type { EntryGenerator } from './$types';

// Redirect pages for the Astro-era routes folded into the new pages (glossary, about, home).
export const entries: EntryGenerator = async () => {
	const paths = legacyPaths(await legacyVocab());
	return LOCALES.flatMap((locale) => paths.map((legacy) => ({ locale, legacy })));
};

export const load = async ({ params }) => {
	const target = legacyTarget(params.legacy, await legacyVocab());
	if (!target) error(404, 'Not found');
	return { target };
};

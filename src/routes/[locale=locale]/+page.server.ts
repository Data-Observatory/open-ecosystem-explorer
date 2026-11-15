import { mapGraph } from '#lib/server/map.ts';
import { stories } from '#lib/server/site.ts';
import type { Locale } from '#lib/locale.ts';

export const load = async ({ params }) => ({
	stories: await stories(params.locale as Locale),
	graph: await mapGraph(params.locale as Locale)
});

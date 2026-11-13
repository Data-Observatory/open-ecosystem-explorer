import { mapGraph } from '$lib/server/map';
import { stories } from '$lib/server/site';
import type { Locale } from '$lib/locale';

export const load = async ({ params }) => ({
	stories: await stories(params.locale as Locale),
	graph: await mapGraph(params.locale as Locale)
});

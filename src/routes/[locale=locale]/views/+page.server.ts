import { questions, stories } from '$lib/server/site';
import type { Locale } from '$lib/locale';

export const load = async ({ params }) => ({
	stories: await stories(params.locale as Locale),
	questions: await questions(params.locale as Locale)
});

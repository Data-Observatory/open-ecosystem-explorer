import { questions } from '$lib/server/site';
import type { Locale } from '$lib/locale';

export const load = async ({ params }) => ({
	questions: await questions(params.locale as Locale)
});

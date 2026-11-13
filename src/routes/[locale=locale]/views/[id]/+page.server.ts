import { error } from '@sveltejs/kit';
import { questionPage } from '$lib/server/site';
import { governanceLabel } from '$lib/labels';
import type { Locale } from '$lib/locale';

export const load = async ({ params }) => {
	const question = await questionPage(params.id, params.locale as Locale, governanceLabel);
	if (!question) error(404, 'Not found');
	return { question };
};

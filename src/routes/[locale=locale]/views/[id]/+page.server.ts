import { error } from '@sveltejs/kit';
import { questionPage } from '#lib/server/site.ts';
import { governanceLabel } from '#lib/labels.ts';
import type { Locale } from '#lib/locale.ts';

export const load = async ({ params }) => {
	const question = await questionPage(params.id, params.locale as Locale, governanceLabel);
	if (!question) error(404, 'Not found');
	return { question };
};

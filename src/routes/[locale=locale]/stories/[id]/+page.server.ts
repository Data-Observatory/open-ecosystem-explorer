import { error } from '@sveltejs/kit';
import { storyPage } from '#lib/server/site.ts';
import type { Locale } from '#lib/locale.ts';

// Placeholder for the map's story player: the same steps as an ordered list (also the
// no-JavaScript and screen-reader structure the map port keeps).
export const load = async ({ params }) => {
	const story = await storyPage(params.id, params.locale as Locale);
	if (!story) error(404, 'Not found');
	return { story };
};

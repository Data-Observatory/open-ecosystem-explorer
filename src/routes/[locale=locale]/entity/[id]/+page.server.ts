import { error } from '@sveltejs/kit';
import { entityPage } from '$lib/server/site';
import { governanceLabel } from '$lib/labels';
import type { Locale } from '$lib/locale';
import * as m from '$lib/paraglide/messages';

export const load = async ({ params }) => {
	const entity = await entityPage(params.id, params.locale as Locale, {
		yes: m.entity_yes(),
		no: m.entity_no(),
		governance: governanceLabel
	});
	if (!entity) error(404, 'Not found');
	return { entity };
};

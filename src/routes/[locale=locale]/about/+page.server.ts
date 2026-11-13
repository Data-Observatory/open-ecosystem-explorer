import { about } from '$lib/server/site';
import type { Locale } from '$lib/locale';

export const load = async ({ params }) => ({ about: await about(params.locale as Locale) });

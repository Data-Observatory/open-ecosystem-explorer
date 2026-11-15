import { about } from '#lib/server/site.ts';
import type { Locale } from '#lib/locale.ts';

export const load = async ({ params }) => ({ about: await about(params.locale as Locale) });

import { glossary } from '$lib/server/site';
import type { Locale } from '$lib/locale';

export const load = async ({ params }) => glossary(params.locale as Locale);

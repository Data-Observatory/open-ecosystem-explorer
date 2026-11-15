import { glossary } from '#lib/server/site.ts';
import type { Locale } from '#lib/locale.ts';

export const load = async ({ params }) => glossary(params.locale as Locale);

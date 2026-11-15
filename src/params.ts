import { defineParams } from '@sveltejs/kit/params';
import { isLocale } from '#lib/paraglide/runtime.js';

/** `[locale=locale]`: only the configured locales (project.inlang/settings.json) match. */
const matchLocale = (param: string): param is 'es' | 'en' => isLocale(param);

export const params = defineParams({
	locale: (param) => (matchLocale(param) ? param : undefined)
});

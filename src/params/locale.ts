import type { ParamMatcher } from '@sveltejs/kit';
import { isLocale } from '$lib/paraglide/runtime';

/** `[locale=locale]`: only the configured locales (project.inlang/settings.json) match. */
export const match = ((param: string): param is 'es' | 'en' =>
	isLocale(param)) satisfies ParamMatcher;

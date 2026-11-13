/**
 * Locale list and URL helpers shared by server and client code. Pure: no SvelteKit or Paraglide
 * import, so unit tests and server modules can use it.
 *
 * The locale codes are the ones in src/i18n/locales.ts (the content model's single locale
 * list, rule A9) and in project.inlang/settings.json (Paraglide). tests/unit/i18n/messages.test.ts
 * checks that the two lists agree.
 */
import { locales as contentLocales, defaultLocale as contentDefault } from '../i18n/locales.js';

export type Locale = (typeof contentLocales)[number]['code'];

export const LOCALES: readonly Locale[] = contentLocales.map((l) => l.code);
export const DEFAULT_LOCALE: Locale = contentDefault;

/** Language names in their own language, for the switcher's accessible names. */
export const LOCALE_NAMES: Record<Locale, string> = Object.fromEntries(
	contentLocales.map((l) => [l.code, l.label])
) as Record<Locale, string>;

export function isLocale(value: string): value is Locale {
	return (LOCALES as readonly string[]).includes(value);
}

/**
 * Root-relative URL of a localized page, with the trailing slash every page URL carries
 * (`/es/entity/doi/`). `path` is the part after the locale, with or without slashes;
 * `''` is the locale home page. `base` is SvelteKit's `paths.base`.
 */
export function pagePath(base: string, locale: Locale, path = ''): string {
	const clean = path.replace(/^\/+|\/+$/g, '');
	return `${base}/${locale}/${clean === '' ? '' : `${clean}/`}`;
}

/**
 * The same page in another locale: swaps the locale segment right after `base`. Returns the
 * other locale's home page when `pathname` carries no locale segment.
 */
export function switchLocalePath(base: string, pathname: string, target: Locale): string {
	const rest = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
	const match = /^\/([a-z]{2})(\/.*)?$/.exec(rest);
	if (!match || !isLocale(match[1] ?? '')) return pagePath(base, target);
	return `${base}/${target}${match[2] ?? '/'}`;
}

/** Absolute URL when a public origin is configured (SITE_URL), else the root-relative path. */
export function absoluteUrl(siteUrl: string, path: string): string {
	return `${siteUrl.replace(/\/+$/, '')}${path}`;
}

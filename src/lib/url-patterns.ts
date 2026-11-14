/**
 * The Paraglide `urlPatterns` option for a SvelteKit `paths.base` (`''` or e.g. `'/ecosystem'`).
 *
 * Copied from the sister sites (Data-Observatory/fairness). Every locale is prefixed,
 * including the base one (es): `/es/...` and `/en/...`, the URL shape of the site since its first release.
 * Unlike the sisters, routes here carry an explicit `[locale=locale]` segment instead of a
 * `reroute` hook, so Paraglide only *reads* the locale from the URL (see hooks.server.ts).
 * A path without a locale prefix (the root gateway, data exports, sitemap) resolves to the
 * base locale.
 *
 * No import from Paraglide or SvelteKit here, so vite.config.ts and unit tests can use it.
 */
export const URL_PATTERN_LOCALES = ['es', 'en'] as const;

export type UrlPattern = {
	pattern: string;
	localized: [locale: string, pattern: string][];
};

export function buildUrlPatterns(base: string): UrlPattern[] {
	const prefix = base.replace(/\/+$/, '');
	return [
		{
			pattern: prefix === '' ? '/' : prefix,
			localized: URL_PATTERN_LOCALES.map((locale) => [locale, `${prefix}/${locale}`])
		},
		{
			pattern: `${prefix}/:path(.*)?`,
			localized: URL_PATTERN_LOCALES.map((locale) => [locale, `${prefix}/${locale}/:path(.*)?`])
		}
	];
}

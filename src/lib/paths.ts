import { base } from '$app/paths';
import type { ResolvedPathname } from '$app/types';
import { pagePath, type Locale } from '$lib/locale';

/**
 * Internal links, typed as `ResolvedPathname` so `svelte/no-navigation-without-resolve`
 * recognises them (the rule checks the expression's type). Both include `paths.base`.
 */

/** A localized page: `/es/entity/doi/` (trailing slash, like every page URL). */
export function localeHref(locale: Locale, path = ''): ResolvedPathname {
	return pagePath(base, locale, path) as ResolvedPathname;
}

/** A locale-free file: `/data/graph.json`, `/es/feed.xml`. `path` starts with '/'. */
export function fileHref(path: string): ResolvedPathname {
	return `${base}${path}` as ResolvedPathname;
}

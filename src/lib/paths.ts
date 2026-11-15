import { resolve } from '$app/paths';
import type { ResolvedPathname } from '$app/types';
import { pagePath, type Locale } from '#lib/locale.ts';

/**
 * Internal links, typed as `ResolvedPathname` so `svelte/no-navigation-without-resolve`
 * recognises them (the rule checks the expression's type). Both include `paths.base`.
 */

/** The configured base path without a trailing slash: `''` at the root, `'/sub'` under a sub-path. */
export function basePath(): string {
	return resolve('').replace(/\/$/, '');
}

/** A localized page: `/es/entity/doi/` (trailing slash, like every page URL). */
export function localeHref(locale: Locale, path = ''): ResolvedPathname {
	return pagePath(basePath(), locale, path) as ResolvedPathname;
}

/** A locale-free file: `/data/graph.json`, `/es/feed.xml`. `path` starts with '/'. */
export function fileHref(path: string): ResolvedPathname {
	// `resolve` types its pathnames as literals; a runtime path is checked by the tests, not the type.
	return (resolve as (pathname: string) => ResolvedPathname)(path.slice(1));
}

/**
 * Routes of the Astro site that the new information architecture folds into fewer pages
 * (review report §3.1). Each keeps a prerendered redirect page so old links and bookmarks do
 * not 404. Pure: no SvelteKit import (unit-tested).
 *
 * Paths are below the locale (`/es/<path>/`), without slashes.
 */
export interface LegacyTarget {
	/** Page path below the locale ('' = home), as for `pagePath`. */
	path: string;
	/** Query string for the target, without '?'. */
	query?: string;
	/** Fragment for the target, without '#'. */
	hash?: string;
	/** Carry the visitor's own query string over (e.g. `/search/?q=doi`). */
	keepQuery?: boolean;
}

const STATIC: Record<string, LegacyTarget> = {
	entities: { path: 'glossary' },
	layers: { path: 'glossary' },
	taxonomy: { path: 'glossary' },
	tags: { path: 'glossary' },
	search: { path: 'glossary', keepQuery: true },
	relations: { path: 'about', hash: 'model' },
	model: { path: 'about', hash: 'model' },
	contribute: { path: 'about', hash: 'contribute' },
	map: { path: '' },
	map2: { path: '' },
	map3: { path: '' }
};

export interface LegacyVocab {
	entityTypes: readonly string[];
	tags: readonly string[];
	predicates: readonly string[];
}

/** Every legacy path (below the locale) that gets a redirect page. Sorted, deterministic. */
export function legacyPaths(vocab: LegacyVocab): string[] {
	return [
		...Object.keys(STATIC),
		...vocab.entityTypes.map((type) => `entities/${type}`),
		...vocab.tags.map((tag) => `tags/${tag}`),
		...vocab.predicates.map((predicate) => `relations/${predicate}`)
	].sort();
}

/** Where a legacy path now lives, or undefined when it is not a legacy path. */
export function legacyTarget(path: string, vocab: LegacyVocab): LegacyTarget | undefined {
	const clean = path.replace(/^\/+|\/+$/g, '');
	const direct = STATIC[clean];
	if (direct) return direct;
	const [section, value, ...rest] = clean.split('/');
	if (!value || rest.length > 0) return undefined;
	if (section === 'entities' && vocab.entityTypes.includes(value)) {
		return { path: 'glossary', query: `type=${encodeURIComponent(value)}` };
	}
	if (section === 'tags' && vocab.tags.includes(value)) return { path: 'glossary' };
	if (section === 'relations' && vocab.predicates.includes(value)) {
		return { path: 'about', hash: 'model' };
	}
	return undefined;
}

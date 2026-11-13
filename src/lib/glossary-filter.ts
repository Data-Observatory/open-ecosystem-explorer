/**
 * Client-side glossary filter. Pure (no Svelte, no DOM) so it is unit-tested and shared by the
 * page and its tests. The searchable text of each entry is pre-folded at build time with
 * `fold` (same function), so matching ignores case and accents: "metadatos" matches "Metadatos",
 * "indice" matches "Índice".
 */
export function fold(text: string): string {
	return text
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase();
}

export interface FilterableEntry {
	type: string;
	/** Pre-folded name, aliases and summary. */
	search: string;
}

export interface GlossaryFilter {
	query: string;
	types: readonly string[];
}

/** Every whitespace-separated term of the query must occur; an empty type list means any type. */
export function matchesFilter(entry: FilterableEntry, filter: GlossaryFilter): boolean {
	if (filter.types.length > 0 && !filter.types.includes(entry.type)) return false;
	const terms = fold(filter.query).split(/\s+/).filter(Boolean);
	return terms.every((term) => entry.search.includes(term));
}

export function isFilterActive(filter: GlossaryFilter): boolean {
	return filter.query.trim() !== '' || filter.types.length > 0;
}

/** Reads `?q=` and `?type=a,b` (unknown types are dropped). */
export function filterFromQuery(params: URLSearchParams, knownTypes: readonly string[]): GlossaryFilter {
	const types = (params.get('type') ?? '')
		.split(',')
		.map((t) => t.trim())
		.filter((t) => knownTypes.includes(t));
	return { query: params.get('q') ?? '', types: [...new Set(types)] };
}

/** Inverse of `filterFromQuery`; empty values are left out so a cleared filter has a clean URL. */
export function filterToQuery(filter: GlossaryFilter): URLSearchParams {
	const params = new URLSearchParams();
	if (filter.query.trim() !== '') params.set('q', filter.query);
	if (filter.types.length > 0) params.set('type', [...filter.types].sort().join(','));
	return params;
}

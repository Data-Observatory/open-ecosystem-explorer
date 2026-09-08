// Search-as-you-type scoring for /map (specs.md §6.6: "client-side fuzzy
// match over name, aka, summary, tags"). Extracted as its own pure function
// (mirrors the inline scorer in /{locale}/search/index.astro, which stays a
// plain `is:inline` script and isn't touched by this change) so /map's
// version is independently unit-testable.
export interface SearchableEntry {
  name: string;
  aka?: string[];
  tags?: string[];
  summary?: string;
}

/** Higher is a better match; -1 means "no match, hide this result." */
export function scoreSearchEntry(entry: SearchableEntry, query: string): number {
  const needle = query.trim().toLowerCase();
  if (!needle) return 0;
  const name = entry.name.toLowerCase();
  if (name.startsWith(needle)) return 3;
  if (name.includes(needle)) return 2;
  const aka = (entry.aka ?? []).join(' ').toLowerCase();
  const tags = (entry.tags ?? []).join(' ').toLowerCase();
  if (aka.includes(needle) || tags.includes(needle)) return 1.5;
  if ((entry.summary ?? '').toLowerCase().includes(needle)) return 1;
  return -1;
}

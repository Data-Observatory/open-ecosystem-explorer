// Plain filesystem YAML loader for the content collections (replaces the
// Astro content-layer loader of the pre-SvelteKit site; no `astro:content`).
// Runs only at build time, inside server `load` functions and prerendered
// endpoints, so nothing here ships to the browser.
//
// Same two transforms the Astro loader applied before schema validation:
//   1. Entity and view facts files don't repeat `id` in the file: it's
//      derived from the filename (I1) and injected here.
//   2. `normalizeDates` is defensive insurance against a parser change that
//      would turn ISO-looking scalars into `Date` instances.
// Deterministic: files are read in sorted path order, so every build sees the
// same collection order regardless of filesystem iteration order.
//
// Intentionally NOT under src/lib/** (rule A1 is about the pure library, not
// the content-loading glue).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { ZodType, ZodTypeDef } from 'zod';

/** Repository root. Builds and tests run from it (`npm run ...`). */
export const ROOT = process.cwd();

function normalizeDates<T>(value: T): T {
  if (value instanceof Date) return value.toISOString().slice(0, 10) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => normalizeDates(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalizeDates(v);
    return out as unknown as T;
  }
  return value;
}

function walk(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.yaml')) out.push(full);
  }
  return out.sort();
}

export interface YamlCollectionOptions<T> {
  /** Base directory, relative to the project root. */
  base: string;
  /** Zod schema every file must satisfy (after id injection and date normalisation). */
  schema: ZodType<T, ZodTypeDef, unknown>;
  /** Called with the file's path relative to `base` (posix separators); return false to skip it. */
  match?: (relPath: string) => boolean;
  /** Inject `id` (derived from the filename stem) into the data before validation. */
  injectId?: boolean;
  /** Use the full relative path (minus `.yaml`) as the entry id, e.g. `es/doi`, instead of the stem. */
  localeAwareId?: boolean;
}

export interface YamlEntry<T> {
  id: string;
  data: T;
  /** Path relative to `base`, posix separators. */
  filePath: string;
}

/** Reads, validates and returns every matching YAML file under `base`, in sorted path order. */
export function loadYamlCollection<T>(options: YamlCollectionOptions<T>): YamlEntry<T>[] {
  const baseDir = join(ROOT, options.base);
  const out: YamlEntry<T>[] = [];
  for (const absPath of walk(baseDir)) {
    const relPath = relative(baseDir, absPath).split('\\').join('/');
    if (options.match && !options.match(relPath)) continue;

    const raw = parseYaml(readFileSync(absPath, 'utf-8')) as Record<string, unknown>;
    const slug = relPath.replace(/\.yaml$/, '');
    const stem = slug.split('/').pop()!;
    const id = options.localeAwareId ? slug : stem;

    const normalized = normalizeDates(raw ?? {}) as Record<string, unknown>;
    if (options.injectId) normalized.id = stem;

    const parsed = options.schema.safeParse(normalized);
    if (!parsed.success) {
      throw new Error(`content loader: ${options.base}/${relPath} is invalid (run npm run validate): ${parsed.error.message}`);
    }
    out.push({ id, data: parsed.data, filePath: relPath });
  }
  return out;
}

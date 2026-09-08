// A thin custom Astro content loader over plain `.yaml` files, needed because
// the built-in `glob()` loader has no hook to transform data before schema
// validation. Two transforms are required for every collection in this
// project:
//   1. Entity and view facts files don't repeat `id` in the file — it's
//      derived from the filename (I1) — so it's injected here before the
//      schema (which requires it) sees the data.
//   2. `normalizeDates` is defensive: nothing in the current pipeline
//      produces `Date` instances (the `yaml` package's core schema parses
//      ISO-looking scalars as plain strings), but it's cheap insurance
//      against a future parser/config change silently reintroducing them.
// This is intentionally NOT under src/lib/** (rule A1 is about the pure
// library, not the Astro-specific content layer wiring). No external glob
// dependency: a plain recursive directory walk plus a `match` predicate.
import type { Loader } from 'astro/loaders';
import { parse as parseYaml } from 'yaml';
import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

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

async function walk(dir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if ((await stat(full)).isDirectory()) {
      out.push(...(await walk(full)));
    } else if (entry.endsWith('.yaml')) {
      out.push(full);
    }
  }
  return out;
}

export interface FrontmatterLoaderOptions {
  /** Base directory, relative to the project root. */
  base: string;
  /** Called with the file's path relative to `base` (posix separators); return false to skip it. */
  match?: (relPath: string) => boolean;
  /** Inject `id` (derived from the filename stem) into the data before validation. */
  injectId?: boolean;
  /** Use the full relative path (minus `.yaml`) as the collection id, e.g. `es/doi`, instead of just the filename stem. */
  localeAwareId?: boolean;
}

export function frontmatterLoader(options: FrontmatterLoaderOptions): Loader {
  return {
    name: 'frontmatter-loader',
    load: async ({ config, store, parseData, generateDigest, logger, watcher }) => {
      const baseUrl = new URL(options.base.endsWith('/') ? options.base : `${options.base}/`, config.root);
      const baseDir = fileURLToPath(baseUrl);

      async function syncOne(absPath: string): Promise<void> {
        const relPath = relative(baseDir, absPath).split('\\').join('/');
        if (options.match && !options.match(relPath)) return;

        const raw = await readFile(absPath, 'utf-8');
        const data = parseYaml(raw) as Record<string, unknown>;
        const slug = relPath.replace(/\.yaml$/, '');
        const stem = slug.split('/').pop()!;
        const id = options.localeAwareId ? slug : stem;

        const normalized = normalizeDates(data) as Record<string, unknown>;
        if (options.injectId) normalized.id = stem;

        const digest = generateDigest({ data: normalized });
        const parsedData = await parseData({ id, data: normalized, filePath: absPath });
        store.set({ id, data: parsedData, filePath: relPath, digest });
      }

      store.clear();
      const files = await walk(baseDir);
      for (const file of files) {
        try {
          await syncOne(file);
        } catch (e) {
          logger.error(`frontmatter-loader: failed to load ${relative(baseDir, file)}: ${(e as Error).message}`);
        }
      }

      if (watcher) {
        watcher.add(baseDir);
        const onChange = async (changedPath: string) => {
          if (changedPath.startsWith(baseDir) && changedPath.endsWith('.yaml')) {
            await syncOne(changedPath);
            logger.info(`frontmatter-loader: reloaded ${relative(baseDir, changedPath)}`);
          }
        };
        watcher.on('change', onChange);
        watcher.on('add', onChange);
      }
    },
  };
}

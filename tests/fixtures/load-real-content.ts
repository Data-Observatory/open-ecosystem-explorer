// Test-only helper (impure, filesystem — fine outside src/lib/**, rule A1
// only constrains the library). Loads the real seed entities/prose so the
// Phase 2 diagram tests exercise Appendix B's actual worked example rather
// than a parallel synthetic copy. Mirrors scripts/validate.ts's loading
// logic deliberately (not imported from there — that file is a CLI entry
// point, not a library module).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { zEntity, zProseFile } from '../../src/lib/model/schema.js';
import { locales } from '../../src/i18n/locales.js';
import type { Entity, EntityId, ResolvedProse } from '../../src/lib/model/types.js';
import type { LocaleCode } from '../../src/i18n/locales.js';

const ROOT = join(import.meta.dirname, '../..');

function listFiles(dir: string, ext: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full, ext));
    else if (entry.endsWith(ext)) out.push(full);
  }
  return out.sort();
}

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

export function loadRealEntities(onlyIds?: readonly EntityId[]): Entity[] {
  const dir = join(ROOT, 'src/content/entities');
  const allow = onlyIds ? new Set(onlyIds) : undefined;
  const entities: Entity[] = [];
  for (const full of listFiles(dir, '.yaml')) {
    const id = full.split('/').pop()!.replace(/\.yaml$/, '');
    if (allow && !allow.has(id)) continue;
    const raw = readFileSync(full, 'utf-8');
    const data = parseYaml(raw) as Record<string, unknown>;
    entities.push(zEntity.parse(normalizeDates({ ...data, id })) as unknown as Entity);
  }
  return entities;
}

export function loadRealProseMap(onlyIds?: readonly EntityId[]): Map<LocaleCode, Map<EntityId, ResolvedProse>> {
  const allow = onlyIds ? new Set(onlyIds) : undefined;
  const map = new Map<LocaleCode, Map<EntityId, ResolvedProse>>();
  for (const { code } of locales) {
    const dir = join(ROOT, 'src/content/i18n', code);
    const localeMap = new Map<EntityId, ResolvedProse>();
    const files = listFiles(dir, '.yaml').filter((f) => !f.includes(join(dir, 'views')));
    for (const full of files) {
      const id = full.split('/').pop()!.replace(/\.yaml$/, '');
      if (allow && !allow.has(id)) continue;
      const raw = readFileSync(full, 'utf-8');
      const data = parseYaml(raw) as Record<string, unknown>;
      const parsed = zProseFile.parse(normalizeDates(data));
      localeMap.set(id, { summary: parsed.summary, name: parsed.name, shortName: parsed.shortName, aka: parsed.aka, relationNotes: parsed.relationNotes, body: parsed.body });
    }
    map.set(code, localeMap);
  }
  return map;
}

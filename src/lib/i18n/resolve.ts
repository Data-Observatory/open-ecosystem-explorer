// Locale-fallback resolution over an already-built GraphIndex (specs.md
// §5.7, §7.2). Pure — GraphIndex.prose already holds each locale's raw,
// unfallen-back prose map (see build-index.ts); this is where "what do we
// actually show for locale L" gets decided, so page templates never branch
// on presence/absence themselves.
//
// Real fallback chain (§5.7): try the requested `locale` first; if that
// locale has no prose file for this entity (I30 — a warning, not an error,
// since every link still resolves per §7.2), fall back to `defaultLocale`,
// which I29 guarantees exists for every entity that passed `npm run
// validate`. Callers already use the full return shape from Phase 3, so
// this change is scoped to this function's body only.
import type { EntityId, GraphIndex, ResolvedProse } from '../model/types.js';
import type { LocaleCode } from '../../i18n/locales.js';
import { defaultLocale } from '../../i18n/locales.js';

export interface ResolvedProseResult {
  prose: ResolvedProse;
  localeUsed: LocaleCode;
  /** True when `localeUsed` differs from the requested `locale` (§5.7's untranslated-fallback notice). */
  fallback: boolean;
}

export function resolveProse(index: GraphIndex, id: EntityId, locale: LocaleCode): ResolvedProseResult {
  const requested = index.prose.get(locale)?.get(id);
  if (requested) {
    return { prose: requested, localeUsed: locale, fallback: false };
  }

  const fallbackProse = index.prose.get(defaultLocale)?.get(id);
  if (!fallbackProse) {
    // I29 (default-locale prose required) should make this unreachable for
    // any entity that passed `npm run validate` — fail loudly rather than
    // render a blank page if it somehow isn't.
    throw new Error(`resolveProse: no ${defaultLocale} prose for entity '${id}' — I29 should have caught this at validate time`);
  }
  return { prose: fallbackProse, localeUsed: defaultLocale, fallback: locale !== defaultLocale };
}

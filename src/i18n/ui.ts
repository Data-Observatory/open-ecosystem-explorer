// UI chrome strings (specs.md §5.7 "Vocabulary, chrome and diagrams" —
// "UI chrome lives in src/i18n/ui/<locale>.json ... covered by a
// locale-completeness test (§11) rather than an invariant, because a missing
// UI string is a rendering defect, not a data defect").
import es from './ui/es.json' with { type: 'json' };
import en from './ui/en.json' with { type: 'json' };
import type { LocaleCode } from './locales.js';

export type UiStrings = typeof es;

const bundles: Record<LocaleCode, UiStrings> = { es, en };

export function getUiStrings(locale: LocaleCode): UiStrings {
  return bundles[locale];
}

export function getAllUiBundles(): Record<LocaleCode, UiStrings> {
  return bundles;
}

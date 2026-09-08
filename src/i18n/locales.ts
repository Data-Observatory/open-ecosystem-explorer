// The open locale list — the single declaration referenced by the Zod locale
// enum, Astro's i18n routing config, the language switcher, hreflang
// alternates, and the sitemap (specs.md §5.7, rule A9). Adding a language is
// one more entry here plus prose files — never a schema change.
export const locales = [
  { code: 'es', label: 'Español', dir: 'ltr', default: true },
  { code: 'en', label: 'English', dir: 'ltr' },
] as const;

export type LocaleCode = (typeof locales)[number]['code'];

export const defaultLocale: LocaleCode = locales.find((l) => 'default' in l && l.default)!.code;

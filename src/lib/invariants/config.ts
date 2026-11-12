// Validator switches. Pure (no fs); the one place a policy knob lives.
//
// REQUIRE_FULL_I18N
//   false (default): a missing non-default-locale prose file is a WARN,
//     aggregated into one line per locale (I30).
//   true: every entity must have a prose file in EVERY locale; each missing
//     one is an ERROR (I30), so `npm run validate` / `npm run build` fail.
//
// To flip it without editing code:   REQUIRE_FULL_I18N=1 npm run validate
// To flip it for good (once the translations have landed): set the constant
// below to `true`. The env var, when set, always wins over the constant
// (REQUIRE_FULL_I18N=0 forces the lenient mode, =1/true/yes the strict one).

export const REQUIRE_FULL_I18N = true;

export function resolveRequireFullI18n(env: Record<string, string | undefined> = {}): boolean {
  const raw = env.REQUIRE_FULL_I18N?.trim().toLowerCase();
  if (raw === undefined || raw === '') return REQUIRE_FULL_I18N;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

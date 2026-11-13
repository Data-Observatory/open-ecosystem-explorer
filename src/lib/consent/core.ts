/**
 * The visitor's analytics choice: stored format, parsing and the "ask again" rule. Pure: no DOM,
 * no SvelteKit import. static/consent-loader.js cannot import this file, so
 * tests/unit/consent/consent-loader.test.ts keeps the two in step.
 */

/** localStorage key that holds the visitor's analytics choice. */
export const CONSENT_STORAGE_KEY = 'oee-consent';

/** Version of the stored format. A stored value with another version counts as not stored. */
export const CONSENT_VERSION = 1;

/** Calendar days after which the visitor is asked again. */
export const CONSENT_MAX_AGE_DAYS = 365;

export type ConsentChoice = 'granted' | 'denied';

export type StoredConsent = { version: number; choice: ConsentChoice; date: string };

/** The part of `Storage` that is used. A missing storage (null or undefined) is tolerated. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const pad = (n: number) => String(n).padStart(2, '0');

/** The local calendar date as `YYYY-MM-DD`. */
export function localIsoDate(date: Date): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** True for a real calendar date written as `YYYY-MM-DD`. */
export function isIsoDate(value: string): boolean {
	const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!parts) return false;
	const [year, month, day] = [Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])];
	const date = new Date(year, month, day);
	return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
}

/** Whole calendar days from `iso` (a valid `YYYY-MM-DD`) to the local date of `today`. */
export function daysSince(iso: string, today: Date): number {
	const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
	const then = Date.UTC(year, month - 1, day);
	const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
	return Math.round((now - then) / 86_400_000);
}

/** Stored form: `{"v":1,"choice":"granted","date":"YYYY-MM-DD"}` (local calendar date). */
export function serializeConsent(choice: ConsentChoice, date: Date): string {
	return JSON.stringify({ v: CONSENT_VERSION, choice, date: localIsoDate(date) });
}

/** Parses a stored value. Anything unknown or malformed gives null. */
export function parseStoredConsent(raw: string | null | undefined): StoredConsent | null {
	if (typeof raw !== 'string') return null;
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		return null;
	}
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
	const { v, choice, date } = value as Record<string, unknown>;
	if (v !== CONSENT_VERSION) return null;
	if (choice !== 'granted' && choice !== 'denied') return null;
	if (typeof date !== 'string' || !isIsoDate(date)) return null;
	return { version: CONSENT_VERSION, choice, date };
}

/** The choice in a stored value, or null when the value is unknown or malformed. */
export function parseConsent(raw: string | null | undefined): ConsentChoice | null {
	return parseStoredConsent(raw)?.choice ?? null;
}

/**
 * True when the visitor has to be asked: nothing stored, another stored version, or a choice
 * made more than `maxAgeDays` calendar days before `today`.
 */
export function needsPrompt(
	stored: StoredConsent | null,
	today: Date,
	maxAgeDays: number = CONSENT_MAX_AGE_DAYS
): boolean {
	if (stored === null || stored.version !== CONSENT_VERSION) return true;
	if (!isIsoDate(stored.date)) return true;
	return daysSince(stored.date, today) > maxAgeDays;
}

/** Reads the stored consent. Returns null when storage is missing, blocked or holds no valid value. */
export function readConsent(storage: StorageLike | null | undefined): StoredConsent | null {
	try {
		return parseStoredConsent(storage?.getItem(CONSENT_STORAGE_KEY));
	} catch {
		return null;
	}
}

/** Stores the choice. Does nothing when storage is missing or blocked. */
export function writeConsent(
	storage: StorageLike | null | undefined,
	choice: ConsentChoice,
	date: Date
): void {
	try {
		storage?.setItem(CONSENT_STORAGE_KEY, serializeConsent(choice, date));
	} catch {
		// Blocked or full storage: the choice then only lasts for the page view.
	}
}

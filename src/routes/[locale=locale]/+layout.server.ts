import { siteSummary } from '$lib/server/site';
import type { Locale } from '$lib/locale';

// Server load functions, not universal ones: a universal load would ship the content pipeline
// (YAML parser, schema validation) to the browser.
export const load = async ({ params }) => ({
	locale: params.locale as Locale,
	summary: await siteSummary()
});

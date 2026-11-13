import type { Handle } from '@sveltejs/kit';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';

/**
 * Sets the Paraglide locale for the request from its URL prefix (`/es/...`, `/en/...`; no
 * prefix means the base locale) and writes it into `<html lang dir>`.
 *
 * Differs from the sister sites on purpose: routes here have an explicit `[locale=locale]`
 * segment, so the request is NOT de-localized, and Paraglide must never redirect (a locale-free
 * path such as `/data/graph.json` or the root gateway is valid as it is). The middleware only
 * gets a bare copy of the URL: without a `Sec-Fetch-Dest: document` header it never redirects.
 */
const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(new Request(event.request.url), ({ locale }) =>
		resolve(event, {
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale))
		})
	);

export const handle: Handle = handleParaglide;

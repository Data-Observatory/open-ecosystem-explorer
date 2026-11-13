# Analytics and consent

The site loads one third-party script: Google Tag Manager, container `GTM-M9NXQLBC` (a public id).
Analytics are **on by default** and the visitor can turn them off. This is the only exception to
"the site makes no third-party runtime requests"; with analytics turned off there are none.

## How it works

- `static/consent-loader.js` runs synchronously in the `<head>` of every page (`src/app.html`), as
  plain JavaScript. It is the only code that can load the container.
- Without a stored choice, or with a stored "granted" choice, it sets Consent Mode v2 and then
  runs the standard Tag Manager bootstrap (`dataLayer.push({'gtm.start': ..., event: 'gtm.js'})`
  and the `gtm.js` script).
- With a stored, current "denied" choice it sets Consent Mode to denied and loads nothing: no
  request to `googletagmanager.com` at all.
- The bare root page `/` (the language redirect) and any URL without a locale segment never load
  the container, so the redirect does not count a second page view.
- Consent Mode v2: `analytics_storage` follows the choice; `ad_storage`, `ad_user_data` and
  `ad_personalization` are always `denied`. The default is pushed before the container loads.
- The notice (`ConsentBanner.svelte`) has two buttons of equal weight, "keep" and "turn off". It
  appears only after mount, so the prerendered HTML and the page without JavaScript have neither
  the notice nor the "Analytics settings" control (footer and About page).
- The choice is stored in `localStorage` under `oee-consent`:
  `{"v":1,"choice":"granted"|"denied","date":"YYYY-MM-DD"}` (local date). It expires after 365
  days, when the notice is shown again. `src/lib/consent/core.ts` and the loader implement the same
  format; `tests/unit/consent/consent-loader.test.ts` keeps them in step.
- Turning analytics off in a page view where the container already loaded cannot unload it. The
  loader pushes `consent update` with everything denied, and expires the Google Analytics cookies.

## What the container must do

The container decides which tags fire (for example a GA4 configuration tag). For turning analytics
off to be honoured, **every tag in the container must respect Consent Mode**:

- In Tag Manager, require `analytics_storage` for the GA4 tags (built-in consent checks), and do not
  add tags that need `ad_storage`, `ad_user_data` or `ad_personalization`.
- Turn on "Enable consent overview" in the container admin to see which tags have no consent
  checks, and fix them. A tag without a consent check fires whatever the visitor chose.
- In the GA4 tag, set the cookie domain to the exact host (or leave it unset and accept the
  default). With the default, Google sets `_ga` on the registrable parent domain, which the
  loader cannot delete (see below).

## Cookies on turning off

The loader expires `_ga`, `_ga_<id>`, `_gid` and `_gat*` without a domain attribute and on the exact
host. It never writes cookies on a parent domain, because a parent domain may belong to another
property. Because the container hides the measurement id, the loader cannot tell which `_ga_<id>`
cookie is this property's. If you want that one also expired on parent domains, and the
documented `ga-disable-<id>` switch set, put the GA4 measurement id in `GA_MEASUREMENT_ID` at the top
of `static/consent-loader.js` (empty by default; covered by a unit test).

## Legal note for the owner

Analytics on by default, without prior opt-in, may not satisfy the ePrivacy rules and the GDPR for
visitors in the EU/EEA (and the UK), which expect opt-in consent before non-essential cookies. The
site follows the sister site "fairness": audience in South America, opt-out, equal-weight buttons,
choice remembered. If EU/EEA visitors matter, ask counsel. Switching to opt-in is a small change in
the loader: default `analytics_storage` to `denied` and load the container only after "keep".

## Testing

Unit tests: `tests/unit/consent/`. End-to-end: `tests/e2e/consent.e2e.ts`. The Google hosts are
stubbed with `page.route`, and `playwright.config.ts` also makes them unresolvable in the browser,
so no test run ever reaches Google.

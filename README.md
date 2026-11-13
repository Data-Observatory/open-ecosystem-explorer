# openscience-ecosystem

Static SvelteKit site mapping the open-science research-information ecosystem
(identifiers, registration agencies, indices, institutional systems,
standards, communities/coalitions) as a validated, navigable knowledge graph.
See `specs.md` for the full spec and `MIGRATION.md` for the move from Astro
(what changed, what is not ported yet).

## Running locally

```bash
npm install
npm run dev -- --port 4991
```

To serve a production build instead (what the e2e tests run against):

```bash
npm run build     # validates content and the map layout, then builds to build/
npm run preview   # serves build/
```

Optional build-time settings: `SITE_URL=https://example.org` (absolute URLs in
sitemap, feeds, canonical links) and `BASE_PATH=/sub-path`.

## Other scripts

- `npm run validate` — standalone content/graph validator (invariants, stories), no build needed
- `npm run check` — svelte-check (TypeScript strict)
- `npm run lint` / `npm run format` — Prettier + ESLint
- `npm test` — unit tests (vitest)
- `npm run test:e2e` — Playwright e2e and accessibility tests against the build
  (`PW_PORT` sets the port, `PLAYWRIGHT_CHROME_PATH` a system Chrome)
- `npm run schema:generate`, `npm run layout:generate`, `npm run layout:check`

## Licences

Code: MIT (`LICENSE`). Data: CC-BY-4.0 (`LICENSE-DATA`). Fonts: SIL OFL 1.1 (`LICENSE-FONTS`).

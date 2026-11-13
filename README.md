# Open Ecosystem Explorer

*Explorador del ecosistema abierto* (Spanish). A map of open science, open data
and good data practice, and of the open software and licences they depend on.

Static SvelteKit site that shows who issues, maintains and governs the
identifiers, standards, repositories, licences and tools that open research
and data rely on, and how they connect (identifiers, registration agencies,
indices, institutional systems, standards, licences, open software,
communities and coalitions), as a validated, navigable knowledge graph with an
interactive map on the home page. See `specs.md` for the full spec and
`MIGRATION.md` for the move from Astro and the design of the map.

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

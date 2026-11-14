# Open Ecosystem Explorer

*Explorador del ecosistema abierto* (Spanish). A map of open science, open data
and good data practice, and of the open software and licences they depend on.

Static SvelteKit site that shows who issues, maintains and governs the
identifiers, standards, repositories, licences and tools that open research
and data rely on, and how they connect (identifiers, registration agencies,
indices, institutional systems, standards, licences, open software,
communities and coalitions), as a validated, navigable knowledge graph with an
interactive map on the home page. It is bilingual (Spanish and English), with a
focus on Chile and Latin America, and is meant first for newcomers, with an
opt-in expert mode for practitioners.

Status: in development, not deployed yet. There is no hosting decision or public URL.
Owner: Data Observatory (Chile).

## Running locally

You need Node 22 or newer (`.nvmrc`) and npm.

```bash
npm install
npm run dev -- --port 4991
```

Pick any free port; the dev server caches the YAML content, so restart it after
editing content. To serve a production build instead (what the e2e tests run against):

```bash
npm run build     # validates content and the map layout, then builds to build/
npm run preview   # serves build/
```

Optional build-time settings: `SITE_URL=https://example.org` (absolute URLs in
sitemap, feeds, canonical links) and `BASE_PATH=/sub-path`.

## Scripts

- `npm run validate`: standalone content/graph validator (schema, invariants, stories), no build needed; run it after every content edit
- `npm run layout:generate` / `npm run layout:check`: regenerate or check the committed map layout (`src/generated/graph-layout.json`); regenerate and commit it whenever entities or relations change
- `npm run check`: svelte-check (TypeScript strict)
- `npm run lint` / `npm run format`: Prettier + ESLint
- `npm test`: unit tests (vitest); `npm run test:coverage` enforces 100% coverage of `src/lib/graph` and `src/lib/invariants`
- `npm run test:e2e`: Playwright e2e and accessibility tests against the build. Run `npm run build` first, and `npx playwright install chromium` once, or set `PLAYWRIGHT_CHROME_PATH` to a system Chrome. `PW_PORT` sets the preview port.
- `npm run schema:generate`: regenerate the JSON Schemas in `schema/` used for editor autocomplete
- `npm run review -- <id>`, `npm run watch:validate`: print an entity's facts and both prose files side by side; re-run validate on save

## Repository layout

- `src/content/entities/`: one facts file per entity (`<id>.yaml`, flat)
- `src/content/i18n/{es,en}/`: translated prose for each entity, plus `views/`
- `src/content/vocab/`: closed vocabularies (entity types, predicates, tags, disciplines, statuses)
- `src/content/stories/`, `src/content/views/`: guided stories and saved queries
- `src/lib/`: model, graph, invariants and exports (framework-free TypeScript), the map (`explorer/`, `map/`), shared components, consent, build-time server helpers
- `src/routes/`: SvelteKit routes, under `[locale=locale]/` (`/es/...`, `/en/...`)
- `messages/`: UI strings (Paraglide), `es.json` and `en.json`
- `scripts/`, `tests/`, `static/`, `schema/`, `prompts/`, `docs/`

## Contributing content

Content is plain YAML, checked by `npm run validate`. `CONTRIBUTING.md` has the
workflow (add an entity, check loop, commit conventions) and `prompts/add-entity.md`
is a prompt for an LLM agent to do the same. The rules in short: one source per
claim, neutral wording, both languages, and if in doubt, leave it out.

## Documentation

- `specs.md`: the full specification (scope, data model, invariants, map, accessibility, testing)
- `docs/architecture.md`: site structure, routes and the design of the map
- `docs/analytics.md`: analytics and consent
- `docs/known-issues.md`: unverified claims, dead sources and open work
- `CHANGELOG.md`: history of changes

## Analytics

The site loads Google Tag Manager (container `GTM-M9NXQLBC`) by default, with a notice that lets
the visitor turn it off; nothing else leaves the site. How it works, what the container must
respect and the legal note for the owner are in `docs/analytics.md`. Tests block the Google hosts,
so no test run reaches them.

## Licences

Code: MIT (`LICENSE`). Data: CC-BY-4.0 (`LICENSE-DATA`). Fonts: SIL OFL 1.1 (`LICENSE-FONTS`).

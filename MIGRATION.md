# Migration from Astro to SvelteKit

Branch `feat/sveltekit`. The site now runs on the Data Observatory sister-site stack: SvelteKit 2,
Svelte 5 (runes only), Tailwind 4, `@sveltejs/adapter-static`, Vite 8, Paraglide for UI strings,
self-hosted Inter and Space Grotesk. The Astro site remains in git history (last Astro commit on
`main` before the merge into this branch).

## What changed

- **Content loading.** `src/content/{loaders,site-index,views-index,stories-index}.ts` read the YAML
  with plain `fs` (sorted file order, same id injection, date normalisation and Zod validation).
  `src/content.config.ts` and every `astro:content` import are gone. `src/lib/**` is unchanged apart
  from the removed `src/lib/mermaid/render.ts` (build-time Mermaid rendering, Astro pages only).
- **Routes.** Explicit `src/routes/[locale=locale]/...` segment (not the sisters' `reroute` hook),
  `trailingSlash: 'always'`: URLs keep the Astro shape `/es/entity/doi/`. `/` is a meta-refresh
  gateway to `/es/` (as before). Locale-free files keep their URLs: `/data/entities.csv`,
  `/data/relations.csv`, `/data/graph.json`, `/entity/<id>.json`, `/sitemap.xml`, `/robots.txt`,
  `/search-index-<locale>.json`, `/<locale>/feed.xml`.
- **Information architecture** (review report §3.1): four nav items.
  - Explorar `/{loc}/`: intro, story question chips, map placeholder.
  - Glosario `/{loc}/glossary/`: A-Z list, text filter, type chips (`?q=`, `?type=`), full list
    without JavaScript.
  - Preguntas `/{loc}/views/`: the five stories (`/{loc}/stories/<id>/`, an ordered step list for
    now) and the existing views (`/{loc}/views/<id>/`).
  - Acerca de `/{loc}/about/`: scope, how to read the map, data model and predicates, downloads,
    contribute, changelog (full changelog at `/{loc}/changelog/`).
  - Entity page `/{loc}/entity/<id>/`: type, one-sentence definition, local note, relations as
    sentences grouped by predicate family, external links (official site, Wikipedia via the
    Wikidata QID, Wikidata, ROR), everything else in a collapsed "Detalles".
- **Old routes** (`/entities`, `/entities/<type>`, `/layers`, `/taxonomy`, `/tags`, `/tags/<tag>`,
  `/search`, `/relations`, `/relations/<predicate>`, `/model`, `/contribute`, `/map`, `/map2`,
  `/map3`) are prerendered redirect pages (`src/lib/legacy-routes.ts`).
- **UI strings.** `src/i18n/ui/{es,en}.json` moved to `messages/{es,en}.json` (Paraglide, flat
  snake_case keys). Map strings are kept as `map_*` for the port. `tests/unit/i18n/messages.test.ts`
  checks ES/EN key and placeholder parity, that every non-`map_` key is used, and that Paraglide and
  `src/i18n/locales.ts` agree. Entity, view and story prose stays in YAML.
- **Site URL** is configurable: `SITE_URL=https://... npm run build` makes sitemap, feed, robots
  and canonical/hreflang URLs absolute. `BASE_PATH` sets a sub-path, as on the sisters.
- **Light theme only**, like the sister sites (they do not ship a dark mode).

## Not ported yet

1. **The interactive map.** Sources kept untouched for the port: `src/components/MapExplorer.astro`,
   `src/components/MapExplorer.client.ts`, `src/components/MapExplorerV2.astro` (not compiled, not
   linted; `MapExplorer.astro` still imports the removed `src/i18n/ui.ts`), `src/lib/map/**`
   (unit-tested), `src/generated/graph-layout.json` (`npm run layout:check` runs before every build).
   What the port needs:
   - a Svelte-native SVG component on the home route (`src/routes/[locale=locale]/+page.svelte`
     has the placeholder `data-testid="map-placeholder"`), positions from `graph-layout.json`;
   - its strings from `m.map_*`;
   - stories played on the map (`?historia=<id>&paso=<n>`); the chips (`QuestionChips.svelte`) then
     link there instead of `/{loc}/stories/<id>/`, which can stay as the no-JS/screen-reader view;
   - a 1-hop mini-graph on the entity page (review report §3.1);
   - its own e2e suite (the Cytoscape-based `tests/e2e/map2|map3|keyboard` specs were removed);
   - then drop `cytoscape`, `cytoscape-fcose`, `src/types/cytoscape-fcose.d.ts` and the
     `src/components` ignores in `eslint.config.js` / `.prettierignore`.
2. **Infra, deploy and domain** (`infra/`, CDK, DNS). Domain undecided (idea:
   `open-ecosystem.dataobservatory.net`); set `SITE_URL` at build time when decided.
3. **Formatting of pre-migration TypeScript.** `src/lib/**` (except new files), `scripts/`,
   `tests/unit`, `tests/fixtures` keep their 2-space style and are excluded from Prettier and ESLint
   so the merge with content/schema work on `main` stays conflict-free. Reformat in one commit after
   that work lands, then remove the exclusions.
4. **Smaller gaps.** The 404 near-match suggestions of the Astro 404 page (static `404.html` now
   links to both homes and glossaries); attribute keys in "Detalles" are raw field names; specs.md
   still describes the Astro routes (§7) and needs a pass.

## Commands

```sh
npm install
npm run dev            # vite dev (never on port 4321: owner's dev server)
npm run check          # svelte-check
npm run lint           # prettier --check + eslint
npm test               # vitest (unit)
npm run validate       # content schema and invariants
npm run build          # validate + layout:check, then static build into build/
npm run preview        # serves build/
PW_PORT=4991 PLAYWRIGHT_CHROME_PATH=/usr/bin/google-chrome npm run test:e2e
```

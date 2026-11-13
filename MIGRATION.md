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
  - Explorar `/{loc}/`: one-line intro, story question chips, the map (see "The map").
  - Glosario `/{loc}/glossary/`: A-Z list, text filter, type chips (`?q=`, `?type=`), full list
    without JavaScript.
  - Preguntas `/{loc}/views/`: the five stories (`/{loc}/stories/<id>/`, the ordered step
    list) and the existing views (`/{loc}/views/<id>/`).
  - Acerca de `/{loc}/about/`: scope, how to read the map, data model and predicates, downloads,
    contribute, changelog (full changelog at `/{loc}/changelog/`).
  - Entity page `/{loc}/entity/<id>/`: type, one-sentence definition, local note, relations as
    sentences grouped by predicate family, external links (official site, Wikipedia via the
    Wikidata QID, Wikidata, ROR), everything else in a collapsed "Detalles".
- **Old routes** (`/entities`, `/entities/<type>`, `/layers`, `/taxonomy`, `/tags`, `/tags/<tag>`,
  `/search`, `/relations`, `/relations/<predicate>`, `/model`, `/contribute`, `/map`, `/map2`,
  `/map3`) are prerendered redirect pages (`src/lib/legacy-routes.ts`).
- **UI strings.** `src/i18n/ui/{es,en}.json` moved to `messages/{es,en}.json` (Paraglide, flat
  snake_case keys). `tests/unit/i18n/messages.test.ts`
  checks ES/EN key and placeholder parity, that every key is used, and that Paraglide and
  `src/i18n/locales.ts` agree. Entity, view and story prose stays in YAML.
- **Site URL** is configurable: `SITE_URL=https://... npm run build` makes sitemap, feed, robots
  and canonical/hreflang URLs absolute. `BASE_PATH` sets a sub-path, as on the sisters.
- **Light theme only**, like the sister sites (they do not ship a dark mode).

## The map

The home page (`/{loc}/`) is the interactive map: `src/lib/explorer/`, Svelte-native SVG, no
Cytoscape, no layout library, no new dependency. Design brief: the "map ideas" report (v1 package).

- **One renderer, four scenes** (`scene.ts`, pure): *start* (the anchors of `src/lib/map/anchors.ts`
  hand-composed around open science, `compose.ts`, landscape and portrait), *focus* (a selected
  node with its neighbours on a fixed-radius ring, `geometry.ts`), *story* (a radial tree of the
  path revealed so far, `story.ts`) and *expert* (the whole corpus at the build-time positions of
  `src/generated/graph-layout.json`, format unchanged). Adding an anchor to `anchors.ts` requires
  placing it in `compose.ts` (a unit test fails otherwise).
- **Components**: `MapExplorer.svelte` (shell, keyboard, pan/zoom), `MapCanvas.svelte` (the SVG;
  also used statically by `MiniGraph.svelte` on the entity page), `MapCard.svelte`,
  `StoryBar.svelte`, `MapPalette.svelte`, `MapList.svelte`, `NodeGlyph.svelte`, and the state in
  `store.svelte.ts`. Payload built at build time in `src/lib/server/map.ts`.
- **The URL is the state** (`url.ts`): `?n=<id>` selected node, `?historia=<id>&paso=<n>` story
  step, `?modo=experto` (`&vista=lista`, `&tipo=`, `&rel=`). Every action is a SvelteKit navigation
  to the next URL: selections and story starts push a history entry (Back works, the breadcrumb
  trail follows), story steps, filters and the expert toggle replace it. Expert mode is also
  remembered in `localStorage` (`ose:map-mode`, inside try/catch).
- **Reading**: the card is the primary reading mode (relations as sentences grouped by predicate
  family; hovering or focusing a sentence highlights its edge; no edge labels on the canvas). The
  camera centres the selected node in the area the card leaves free. One 280 ms ease-out tween
  moves camera and nodes together; under `prefers-reduced-motion` changes are immediate.
- **Encoding**: three node sizes (entry point, theme hub, member; size marks where to start, not hierarchy: open science, open data and open access share the largest), five node families with shape and
  colour (`palette.ts`, `NodeGlyph.svelte`), one accent (blue-600), labels from `shortName` when
  present. No legend, no physics, no minimap.
- **Stories**: the question chips are links to `/{loc}/stories/<id>/` (the ordered step list: the
  no-JS and screen-reader version, with a "play on the map" link); with JavaScript a click plays
  the story on the map instead (`/{loc}/?historia=<id>&paso=1`).
- **Phone** (container narrower than 768 px): list first. A 38vh sticky map strip, and under it
  the themes as rows, or the card, or the story caption, as the page itself.
- **Accessibility**: every node is a real `<a>` to its entity page (so the map is a static picture
  of links without JavaScript, and the entity mini-graph needs no JavaScript at all); the canvas is
  one tab stop with arrow-key movement between nodes; `/` opens search, Escape steps back; a live
  region announces selections; axe WCAG 2.2 AA in `tests/e2e/map.e2e.ts`.
- **Full screen**: a button on the frame (Fullscreen API plus a fixed overlay, which is also the
  fallback where the API is missing); Escape leaves it and focus returns to the button. Local state,
  not in the URL. The frame is up to 1600 px wide on large screens.
- **Expert mode**: type and relation-family filters, list (table) view, drag to pan, Ctrl + wheel
  or the buttons to zoom (a plain wheel keeps scrolling the page), labels by zoom, off-canvas
  nodes culled.
- **Removed**: `cytoscape`, `cytoscape-fcose`, `src/components/` (the Astro map sources),
  `src/types/cytoscape-fcose.d.ts`, and the pre-migration map helpers nothing imported any more
  (`src/lib/map/{hierarchy,curated,facets,graph-state,node-svg,palette-overrides,url-state,search-score}.ts`
  with their unit tests). `src/lib/map/` keeps `anchors.ts`, `layout.ts` and `color-distance.ts`.
- **Not built** (by design or deferred): hover tooltip (idea 9), entrance animation (idea 10),
  copy-link/print (idea 12), touch pinch-zoom (buttons instead), autoplay of stories.

## Not ported yet

1. **Infra, deploy and domain** (`infra/`, CDK, DNS). Domain undecided (idea:
   `open-ecosystem.dataobservatory.net`); set `SITE_URL` at build time when decided.
2. **Formatting of pre-migration TypeScript.** `src/lib/**` (except new files), `scripts/`,
   `tests/unit`, `tests/fixtures` keep their 2-space style and are excluded from Prettier and ESLint
   so the merge with content/schema work on `main` stays conflict-free. Reformat in one commit after
   that work lands, then remove the exclusions.
3. **Smaller gaps.** The 404 near-match suggestions of the Astro 404 page (static `404.html` now
   links to both homes and glossaries); attribute keys in "Detalles" are raw field names.

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
PW_PORT=4993 PLAYWRIGHT_CHROME_PATH=/usr/bin/google-chrome npm run test:e2e
```

# Changelog

## [Unreleased]

### Clean-up after the SvelteKit migration (2026-11-14)

- Removed the unused Mermaid generators (`src/lib/mermaid/`), the diagram description helper (`src/lib/a11y/`), the unused subtype-label helper and their tests (the invariants test keeps everything not about diagrams).
- `specs.md` rewritten where it still described Astro, Mermaid and Cytoscape: §4 stack and structure, §6 (now "Graph presentation"), §7.1, §9.1, §10, §11, Appendix B, and the I28 description. `MIGRATION.md` became `docs/architecture.md`.
- Older TypeScript is formatted with Prettier and linted; the exclusions are gone. Outdated Astro wording removed from comments and the licence text.

### CARE, TRUST and POSI retyped from `standard` to `concept` (2026-11-13)

- Same decision as FAIR: all three are principles or criteria, not specifications with conformance testing or certification. Sources fetched: GIDA (gida-global.org/careprinciples: "CARE Principles for Indigenous Data Governance", people- and purpose-oriented principles that complement FAIR, drafted at the Gaborone workshop of 8 November 2018) and the CARE/FAIR paper in *Scientific Data* 2021 (via Europe PMC: four principles, released by GIDA in September 2019, produced by the RDA International Indigenous Data Sovereignty Interest Group); Lin et al. 2020, *Scientific Data*, doi 10.1038/s41597-020-0486-7 (via Europe PMC: "a set of guiding principles to demonstrate digital repository trustworthiness", a common framework) and the RDA news item of 18 May 2020; openscholarlyinfrastructure.org (principles, v2.0 of October 2025, 20 principles in governance, sustainability and insurance) and its adopters page (adoption by publishing a self-audit). `care`, `trust-principles` and `posi` are now `type: concept`, `governance: not-applicable`; `standardKind`, `requiresOpenness` and `specVersion` are gone; ES/EN summary and body say plainly that each is a set of principles, not a standard or a certification. Unverified claims were dropped: CARE "US-based nonprofit network", "co-organised with RDA", "formally affiliated"; POSI "superseding v1's 16 commitments" and "for deciding whom to depend on".
- Edges: `developed-by`, `endorsed-by`, `complies-with` and `profile-of` do not type-check with a concept, so `care endorsed-by rda` became `rda related-to care`, `trust-principles developed-by rda` became `rda related-to trust-principles` (thing to concept, authored on the thing), `coretrustseal profile-of trust-principles` became `coretrustseal related-to trust-principles` (note softened to what the TRUST paper says), and the eight `complies-with posi` edges (`wds`, `doaj`, `openaire`, `openalex`, `opencitations`, `core`, `crossref`, `datacite`) became `related-to posi`. `posi related-to open-science-infrastructure` is concept to concept, so it moved to `open-science-infrastructure` (the smaller id). No node exceeds the related-to cap of 5.
- `care` was `prominence: core`; it is now `extended` (a core concept must be a map anchor and the anchor set is deliberate). The tier unit test now uses `open-definition` as the principles standard; the `map2` curated set gains `fair4rs` (a still-standard principles entry, connected through `fair` and `force11`) so the T4 e2e checks keep a real principles standard. `specs.md` examples updated.
- `npm run validate`: 169 entities, 357 edges (unchanged), 0 errors, 87 warnings (unchanged), 100% EN/ES.

### Map hierarchy: endorsed-by is lateral (2026-11-13)

- `endorsed-by` goes from `target-higher` to `lateral` in `src/lib/map/hierarchy.ts`: a supporter neither contains nor governs the declaration it signs, and with the signatory convention the old orientation ranked Crossref, DataCite, OpenAIRE, OpenAlex and OpenCitations above the Barcelona Declaration. Same change as on the `feat/sveltekit` branch, applied by hand. The SVG map does not use this ranking; only the legacy layered view does. New unit test.

### FAIR retyped from `standard` to `concept` (2026-11-13)

- FAIR is a set of guiding principles, not a specification with conformance testing or certification. Sources fetched: Wilkinson et al. 2016, *Scientific Data* (doi 10.1038/sdata.2016.18, "FAIR Guiding Principles", guidelines to improve reuse of data); the FORCE11 page (a set of guiding principles, launched at a Lorentz workshop in 2014); GO FAIR (the FAIR Guiding Principles, a reference for guiding implementation); Wikidata Q29032644 (instance of initiative and conceptual framework, subclass of principle, not a standard). `fair` is now `type: concept`, `governance: not-applicable`; `standardKind` and `requiresOpenness` are gone; `url` points to the GO FAIR principles page (the old go-fair.org address redirects there); the ES/EN summary and body now say plainly that FAIR is not a standard or a certification.
- Edges: `developed-by` is not allowed from or to a concept, so `fair developed-by force11` became `force11 related-to fair` (authored on the community, same note and a FORCE11 source). Four inbound edges no longer type-check against a concept (`complies-with`, `mandates` and `profile-of` have `standard`/`policy` ranges) and are now `related-to`: `dataverse`, `fairsharing`, `fair4rs` (was `profile-of`) and `unesco-recommendation-open-science` (was `mandates`; the note already said it is advisory). The `what-is-fair` story follows the new edges and says FAIR is "not a standard" in its first step.
- `fair` is `prominence: extended`, not `core`: every core concept is a default map anchor (`anchors.test.ts`), and the 15 anchors are a deliberate set. The real-corpus tier test and the `map2` e2e spec used FAIR as the example of a principles standard; they now use `trust-principles` (in the legacy `map2` view FAIR, as a concept, falls to the default tier).
- `npm run validate`: 169 entities, 357 edges (unchanged), 0 errors, 87 warnings (unchanged), 100% EN/ES.

### Analytics and cookie notice (2026-11-13)

- Google Tag Manager (container `GTM-M9NXQLBC`) loads by default from `static/consent-loader.js`, with Consent Mode v2 (analytics follows the visitor's choice; ad storage, ad user data and ad personalization always denied). A stored "denied" choice (key `oee-consent`) loads nothing. Same design as the sister site "fairness".
- Notice with two equal buttons ("keep" / "turn off"), shown after mount only, again after 365 days; an "Analytics settings" control in the footer and in the new "Privacy and cookies" section of About (ES and EN). Turning off expires the Google Analytics cookies on the exact host.
- Spec rule A7 now allows this one opt-out third-party request. The map e2e test and the quality e2e test account for it; `playwright.config.ts` makes the Google hosts unresolvable so tests never reach Google. Details in `docs/analytics.md`.

### Scope expansion: open data, licences and research software (2026-11-13)

- Scope is now "a map of open science, open data and good data practice, and of the open software and licences they depend on"; site name *Open Ecosystem Explorer* / *Explorador del ecosistema abierto*. Docs only on this branch (`specs.md` title, section 1 scope line, non-goal N15 for open education, open hardware and open government, C7 criterion (d); `README.md`); the UI strings are updated separately.
- 20 new entities (ES + EN prose each, 149 -> 169): licences and definitions (`creative-commons`, `creative-commons-licences`, `open-definition`, `open-source-definition`, `open-source-initiative`, `spdx`, `linux-foundation`, `open-source-software`), open data (`open-data-charter`, `ckan`, `open-data-portal`, `data-management-plan`, `datos-gob-cl`), research software (`research-software`, `fair4rs`, `research-software-alliance`, `codemeta`, `citation-file-format`, `software-heritage`, `inria`). 43 new edges (314 -> 357), each with a fetched source; governance edges carry `verified` records. No new entity types, predicates or tags.
- Creative Commons licences are one `standard` that is `related-to` (not `is-a`) `open-license`, because only CC0, CC BY and CC BY-SA are on the Open Definition's conformant list. Open Data Charter has governance `unknown` (no page names a host). `datos-gob-cl` is the single Chile open-data portal; dataset counts are left out.
- Software Heritage facts re-checked on Internet Archive copies of softwareheritage.org (the live site fails TLS verification) and swhid.org: non-profit infrastructure launched by Inria in 2016 in collaboration with UNESCO. Claims that rested only on Wikipedia (2015 start, UNESCO headquarters opening in 2018) were dropped. The Carpentries and ILDA were considered and left out.
- `open-license` is the 15th default anchor ("Publish openly") and `prominence: core`; new edge `open-access` `related-to` `open-license` (BOAI10 recommendation 2.1 names CC BY). `anchors.ts`, the anchors unit test, the `map3` e2e spec and specs section 7 now say 15 anchors. `anid-open-access-policy` relates to `data-management-plan`. Layout regenerated.
- `npm run validate`: 0 errors, 87 warnings (was 80): I33 on `codemeta`, `citation-file-format` and `datos-gob-cl` (no governing organisation in the sources), plus I34 prose-mention hits on existing notes that name SPDX (`core`, `gbif`, `openaire`, `zenodo`) or Creative Commons (`wikidata`); the I28 disconnected-graph warning is gone (the Open Knowledge Foundation and FORCE11 are now connected).

- `related-to` cap raised from 3 to 5 (open access <-> mandate, open science <-> policy, COAR <-> research repository added); layout label separation now always converges (spiral fallback, robustness test); OSF and DSpace `persistentIdScheme`; `docs/known-issues.md` with issue drafts.

### Map: full screen, wider frame, entry-point sizes, clearer relation groups (2026-11-13, branch feat/sveltekit)

- Full screen button on the map frame (Fullscreen API with a fixed-overlay fallback; Escape exits, focus returns to the button). The frame is up to 1600 px wide and taller on large screens; the phone layout is unchanged.
- Node size marks entry points, not hierarchy: open science, open data and open access share the largest size. Open science keeps the centre and the "start here" tag.
- Relations are grouped for reading with neutral headings: the `kind` family is "Qué es" / "What it is" (was "Es un/a" / "Is a"), and `related-to` is its own last group, "Relacionado con" / "Related to", on the map card and the entity page.
- Question chips are links to the step-list pages; with JavaScript a click plays the story on the map.
- Removed the pre-migration map helpers nothing imports (`hierarchy`, `curated`, `facets`, `graph-state`, `node-svg`, `palette-overrides`, `url-state`, `search-score`) and their tests.
- `specs.md` §7 route table rewritten for the SvelteKit routes.

### Interactive map rebuilt as Svelte-native SVG (2026-11-13, branch feat/sveltekit)

- The home page is the map: the anchors composed around open science in four named themes, three node sizes, visible quiet edges, a "start here" tag and the question chips above it. No Cytoscape, no layout library; positions come from a hand composition (start), a fixed-radius ring (selection), a radial tree (stories) and the committed `graph-layout.json` (expert mode).
- The card is the reading mode: relations as sentences grouped by family, hover or focus highlights the edge, the camera keeps the selected node clear of the card. Breadcrumb trail on real history entries (`?n=<id>`), Escape and Back step back.
- Question chips play the stories on the map (`?historia=<id>&paso=<n>`, previous/next, arrow keys); `/{loc}/stories/<id>/` keeps the step list with a "play on the map" link.
- Search palette on `/` (entries and stories). Expert mode (`?modo=experto`, remembered): whole corpus, type and relation filters, list view, pan and zoom.
- Phones: list first, with a 38vh map strip on top. Entity pages get a static 1-hop mini-graph (same renderer, no JavaScript needed).
- Site renamed in the UI: *Open Ecosystem Explorer* / *Explorador del ecosistema abierto*, with the new one-line scope as intro and meta description.
- Removed `cytoscape`, `cytoscape-fcose` and `src/components/`. New unit tests (`tests/unit/explorer/`) and e2e suite (`tests/e2e/map.e2e.ts`). Details in `docs/architecture.md`.

### Site moved from Astro to SvelteKit (2026-11-13, branch feat/sveltekit)

- Stack of the Data Observatory sister sites: SvelteKit 2, Svelte 5, Tailwind 4, adapter-static, Paraglide UI strings (`messages/{es,en}.json`), self-hosted Inter and Space Grotesk. Same URL shape (`/es/...`, `/en/...`, trailing slash) and the same data export URLs; `SITE_URL` makes sitemap, feed and canonical URLs absolute.
- New information architecture with four nav items: Explorar (home with story chips and a map placeholder), Glosario (A-Z list with filter and type chips), Preguntas (stories as step lists plus the existing views), Acerca de (scope, reading guide, data model, downloads, contribute, changelog). Slim entity page with relations as sentences and a collapsed "Detalles". Old routes redirect.

### Wikidata cross-check follow-ups (2026-11-13)

- Open access and open data are now `part-of` open science (was `related-to`), sourced to paras. 6 and 7(a)/(b) of the UNESCO Recommendation; the open-access story highlights the new edges.
- New concept `open-science-infrastructure` (Wikidata Q108934881, extended, ES + EN): part of open science (UNESCO Recommendation paras. 6 and 9); DOAJ, Crossref, OpenCitations and Open Policy Finder are-a it (Wikidata P31 + para. 9); POSI relates to it. Layout regenerated.
- Signatory convention: supporters of declarations are `endorsed-by` the declaration, not `member-of`; `member-of` stays for genuine memberships. The 5 Barcelona Declaration supporters (Crossref, DataCite, OpenAIRE, OpenAlex, OpenCitations) moved from `member-of` (authored on them) to `endorsed-by` (authored on the declaration); `endorsed-by` range widened to agency, aggregator, index, repository, publishing-platform and cris; documented in specs A.2 and guarded by a test. Beware: `endorsed-by` ranks the target higher in the map hierarchy (`target-higher`), unlike before.
- `member-of` range widened to `agency` and `organization` (specs A.2, `predicates.yaml`, test). 16 memberships that were blocked, each verified on the organisation's own records: 12 DataCite members (Crossref, JaLC, arXiv, GBIF, COS, Clarivate, CERN, ARDC, Cornell, CDL, Lyrasis, PANGAEA; source: DataCite's provider API, plus the Wikidata statement) and 4 International DOI Foundation members (Crossref, DataCite, mEDRA, JaLC; source: doi.org membership and registration-agency pages).
- 24 of the 36 'safe' Wikidata edges added after checking each on the organisation's own page: 10 CoARA members (coara.org membership list, 2 Nov 2026), 5 RDA members (rd-alliance.org organisation pages), 3 COAR members (coar-repositories.org/members), 2 W3C members (w3.org/membership/list), `raid` operated-by ARDC (raid.org), `cerif` developed-by euroCRIS, `dcat` and `json-ld` governed-by W3C. Wikidata statement URLs are kept as extra sources. 12 left out (not verifiable on first-party pages, stale on Wikidata, or blocked by I19 for non-company owners); decisions in the session log.

### Map data: connected anchors, themes, short names, stories (2026-11-13)

- 16 new sourced `related-to` edges (UNESCO Recommendation, ANID policy, doi.org, ASAPbio, BOAI, Wikipedia): the 14 default anchors now form one connected graph around open science. Layout regenerated. The A9.1 focus-table test now counts a collapsed cluster as the rows it expands to.
- 14 more sourced edges from a missing-relation audit: metadata now relates to ORCID, ROR and OAI-PMH (as it already did to DOI), the DataCite schema depends on ROR (as on ORCID), OpenDOAR, LA Referencia, OpenAIRE and repository software relate to research repositories, APC to diamond open access, peer review to preprints, Plan S and the ANID policy to open access, the UNESCO Recommendation to open science, Wikidata funded by Google. Layout regenerated.
- Spanish predicate labels read as sentences: `is-a` "es un tipo de" (was "es un/a"), `issues` "emite", "es parte de", "es miembro de", "es un perfil de", inverse of `owned-by` "posee".
- Optional per-locale `shortName` (<=24 chars) in prose files for map labels, filled for 18 entities; I30 checks it is not longer than the name and is set in every locale or none.
- `anchors.ts`: each anchor has a theme (`centre`, `identify`, `publish`, `data`, `research-info`) with ES/EN labels, kept in code as a noted exception to A4.
- New `src/content/stories/` collection (schema and ST1-ST6 checks in `src/lib/stories/`, run by `npm run validate`, `schema/story.schema.json`) with 5 stories: DOI, depositing data, FAIR, open access, indexing in Latin America.

### Phase 2: minimal map at `/{loc}/map3` (2026-11-12, for owner review)

- New route `/{loc}/map3` (`MapExplorer.astro` + `MapExplorer.client.ts`): 14 anchor nodes by default, detail on click (card with summary, relations as sentences, entry and Wikipedia links), `+N` expand, keyboard navigation, `?n=` / `?modo=experto` URL state, expert mode with full corpus, filters and list view. Dark mode, reduced motion and a mobile bottom sheet. `/map` and `/map2` are unchanged.
- Build-time deterministic layout: `scripts/layout-graph.ts` writes the committed `src/generated/graph-layout.json`; `npm run build` regenerates it, `npm run layout:check` fails when it is stale.
- `src/lib/map/anchors.ts`: default anchors, five node families with distinct shapes, five predicate-family edge styles (all >= 3:1 on both canvases). Unit tests for anchors and layout, Playwright suite `tests/e2e/map3.spec.ts` (incl. axe).

### Phase 1 content: the concept layer (2026-11-12)

- 22 `concept` entities (ES + EN prose each), 2 new `policy` entities (`plan-s`, `anid-open-access-policy`); `concept` / `is-a` shed `pending`. 34 `is-a` edges (strict fits only) plus 27 `related-to` edges.
- New predicate `related-to` (21 predicates): symmetric, any type -> concept, family `kind`, `maxOutDegree` 3, each edge carries a naming `note`. I9 (smaller-id authoring) now applies only where both endpoints could legally author the edge.
- Optional per-locale `localNote` in prose files (<=30 words), rendered as a "Local context" callout on the entity page; `prose.schema.json` regenerated.
- `MAP_NODE_CAP` 150 -> 200 (159 entities). Test updates: fixture re-applies `pending` to concept/is-a/related-to; predicate count 20 -> 21; one focus-diagram row count 6 -> 7.

### Phase 1 schema: `concept` type, `is-a`, `prominence`, predicate families, strict-i18n switch (2026-11-12)

- New entity type `concept` (13 types) in a new layer `concept` (derived from type like every layer; `governance: not-applicable` added). New predicate `is-a` (any type -> concept; acyclic; transitivity not required) with ES/EN labels. Both declared `pending: true`: I12 exempts them until the first instance exists (and warns if the flag is left behind). `part-of` / `supersedes` also accept concept <-> concept.
- New optional `prominence: core | extended | detail` on every entity (default `extended`, via `prominenceOf`); ES/EN labels in `ui/*.json`.
- Every predicate carries a `family` (`behind`, `builds-on`, `connects`, `shapes`, `kind`; labels in `vocab/predicate-families.yaml`); new invariant I35.
- `REQUIRE_FULL_I18N` (`src/lib/invariants/config.ts`, env override): when on, each missing locale prose file is an I30 ERROR instead of one aggregated WARN. Default off.
- Diagram palette/legend/layer labels gained the `rounded` concept shape and `Conceptos / Concepts` layer; layer labels now have one copy (`LAYER_LABELS`). `schema/entity.schema.json` regenerated.

### Phase 0 corrections: home CTA, tags index, one relation count, Spanish UI strings (2026-11-12)

- Home button now opens the curated map (`/map2/`); the full map stays linked from the home start list and the nav.
- New `/{loc}/tags/` index (tags grouped by namespace, with entity counts); entity-page tags now link to their tag pages.
- One relation count everywhere: authored relations, symmetric `interoperates-with` counted once. `/map` had added the 10 derived mirror edges (193 vs 183).
- Hard-coded English moved to `src/i18n/ui/{es,en}.json`: "View as table (N relationships)", table headers, "this" (now the entity name), Domain/Range, nav label. Type, governance and status badges now render localised vocab labels.
- `specs.md` header updated: implemented, v0.4 draft.

### Isolate re-layout retuned tighter: "more agresive, compact more, less space between cards" (2026-09-09, twenty-first follow-up)

Direct follow-up to the twentieth round's `runIsolateLayout()` below. User feedback this round: "'Aislar' should be more agresive, compact more, less space between cards (half the space it leaves now)."

**Measurement-first approach**: a standalone Playwright harness drove the exact `enterIsolate()` flow against a real built preview (a throwaway port, never the user's own `:4321` dev server) and measured the actual RENDERED (`renderedPosition`) pixel distance between DOI and DataCite (different Tiers, a real edge between them) post-relayout, plus a real bounding-box overlap check across every kept Card and every Tier/Cluster band left visible. The shipped-before-this-round options (`nodeRepulsion: 8000, idealEdgeLength: 120, padding: 60`) measured ~184px for that pair.

**What moved, and what didn't:**
- `padding` was deliberately left at its original 60, NOT halved. Measured directly: `fcose`'s own `fit()` computes zoom as `(viewport - 2*padding) / boundingBox`, so a SMALLER padding leaves more usable canvas, `fcose` zooms IN further to fill it, and the rendered pixel gap between two Cards (their model-space separation times that larger zoom) actually GROWS, not shrinks — halving padding alone measured worse, not better.
- `nodeRepulsion` (8000 -> 600) and `idealEdgeLength` (120 -> 14) are what actually control the real inter-Card gap. A real bisection sweep (dozens of combinations, each re-measured against the built preview, not guessed) found the relationship is NOT monotonic — values both well above and well below the new 600/14 measured worse — but a stable low-distance plateau exists at `nodeRepulsion` ~550-700 / `idealEdgeLength` ~13-16, landing at ~129-130px for the same DOI/DataCite pair (~30% tighter than the old ~184px), with zero Card/Card or Card/band overlap anywhere in the swept range at these values.
- Raising `gravity`/`gravityCompound` to push further was also tried and measured to occasionally overlap two sibling Cluster sub-bands (e.g. "global" and "Norteamérica" within the same Tier) — reverted, left at fcose's own defaults.
- A full 50% reduction from the shipped baseline was not reachable without overlaps: the real classbox footprint (176px+ per Card) that feeds `fcose`'s own non-overlap forces sets a geometric floor this specific cross-Tier pair can't cross while both Tiers still contain more than one Card each. ~130px is the tightest this pair gets while staying overlap-free — a real, verified, but partial improvement toward "half," not the full number.
- Verified on a denser case too: isolating DataCite on the full `/map` corpus (degree 12, the highest-degree node in the corpus) keeps 12 visible Cards across multiple Tiers/Clusters with zero Card/Card overlaps, zero Card/band overlaps, and no Card spilling outside its own Tier/Cluster band boundary.

**Tests**: `tests/e2e/map2.spec.ts` — 1 new test pinning the actual rendered pixel distance for the DOI/DataCite pair post-relayout to a real, measured band (`>50px` and `<170px`, centered on the ~130px measurement with headroom for cross-machine font/rendering variance) plus zero Card/Card overlap and zero Card-spills-outside-its-band, so a future change drifting back toward the old ~184px spacing gets caught even though the pre-existing RELATIVE check (`after < before * 0.8`, model-space) still passes either way.

**Gates**: `npm run validate` 133 entities/183 edges/0 errors (unchanged) · `npm run typecheck` 0 errors · `npx vitest run` 287/287 · clean production build, 400 pages · `npx playwright test tests/e2e/map2.spec.ts --config=playwright.throwaway.config.ts --workers=1` 47/47, and 94/94 at `--workers=1 --repeat-each=2` — run against a throwaway preview port (4877), the user's own dev server on `:4321` never touched/started/stopped.

### Real-canvas multi-select fix, and an Isolate re-layout to shorten long distances (2026-09-09, twentieth follow-up)

Two follow-up reports against the "Aislar" round below.

**1. "i cannot select more than 1 box" — real canvas shift/ctrl/meta-click multi-select was silently broken.** Every existing multi-select test (`tests/e2e/map2.spec.ts`) drove the Layers-panel `<button class="map2-entity-btn">` list via `.click({modifiers})` — real DOM buttons, not the actual rendered `<canvas>` Cards a user visually clicks. Root-caused directly from Cytoscape's own interaction source (`node_modules/cytoscape/dist/cytoscape.cjs.js`), then reproduced live with a real Playwright mouse gesture (mousedown on a node -> a few px of movement -> mouseup, the same jitter any real mouse/trackpad click has — a frictionless `.click()`/`cy.emit('tap')` never moves the pointer at all, which is why this was invisible to every prior test): Cytoscape's default `boxSelectionEnabled: true`, combined with its default 4px `desktopTapThreshold`, means the instant such a gesture crosses that 4px threshold WHILE a multi-select modifier is held, Cytoscape reinterprets the whole thing as an additive BOX-SELECTION drag instead of firing `'tap'` on the node — so this file's own `cy.on('tap', 'node', ...)` handler (which reads `evt.originalEvent.shiftKey/metaKey/ctrlKey`) never runs. Worse, confirmed live: the empty box-selection region this opens typically ends over background, which ALSO fires a plain `'tap'` on the core (`evt.target === cy`) — this file's own "click empty canvas to deselect" handler then wipes the ENTIRE selection, not just failing to add the second card. Fixed in `MapExplorerV2.astro`'s `cy = cytoscape({...})` constructor: `boxSelectionEnabled: false` (this app's entire selection model is its own `selected` Set driven by `'tap'` events — Cytoscape's native box-select/`.selected()` API is never used anywhere in this file, confirmed via grep) plus `desktopTapThreshold: 12` (turning off box-selection alone just makes the same over-threshold gesture fall into node-dragging instead, which ALSO suppresses `'tap'` — raising the threshold gives real clicks, with or without a modifier, enough slack to absorb ordinary jitter; the existing "a node can still be dragged" regression test's deliberate 60px+ move stays comfortably clear of it).

**2. "'aislar' works perfectly, but I would like to re-arrange also, so I can reduce long distances."** `applyIsolate` hid everything outside the selection's neighbourhood but left the KEPT elements at their original hierarchy.ts-computed absolute positions, so two kept Cards that started in different Tiers still read as far apart on screen (nothing rendered in between, but still far apart). `MapExplorerV2.astro` now registers `cytoscape-fcose` (an existing dependency, previously used only by the removed `MapExplorer.astro`) and adds `runIsolateLayout()`: every `applyIsolate()` call re-runs `fcose` restricted to the currently-visible (non-`.isolated-hidden`) collection (`fit: true, padding: 60, animate: true, animationDuration: 300`), pulling the kept Cards together — measured on the real corpus (DOI/DataCite, different Tiers): 1396px apart before, 765px after (~45% tighter). Compound Tier/Cluster bands left visible are included in the same layout call and render correctly (fcose handles compound nodes natively — verified via screenshot: bands still fully contain their children, no overlaps).

Position handling: `capturePreIsolatePositions()` snapshots every real entity's `position()` ONCE per isolate session (in `enterIsolate`, before the first `applyIsolate`/fcose run — NOT inside `applyIsolate` itself, which can run many more times in one session as the selection or hop count changes) into `preIsolatePositions`; `restorePreIsolatePositions()` restores them and is called on every path that leaves isolate mode — the dedicated `exitIsolate()`, AND the mutual-exclusion branch inside `enterFocus()` when switching straight from Isolate to Focus without an explicit exit — so the graph always returns to the exact same stable hierarchy.ts layout, never wherever fcose last left it. Verified: exiting isolate restores DOI/DataCite (and an untouched third node, Zenodo) to their exact original coordinates. A single-card isolate with zero curated relations (`coalition-s`, full `/map` corpus) confirmed fcose doesn't hang/error on a near-trivial visible graph.

**Focus mode explicitly NOT given the same re-layout** (a deliberate choice, not an oversight): the user only asked about Isolate ("'aislar' works perfectly, but..."). Focus's whole design point (see the sixteenth follow-up below) is dimming rather than hiding specifically so the user can still see roughly where the rest of the map is; re-laying-out the visible neighbourhood while everything else stays on-screen-but-faded at its OLD coordinates would put dimmed and re-laid-out elements at odds with each other on the same canvas — confusing, not consistent. Isolate's hard-hide has no such conflict (nothing else is on screen to be at odds with).

**Tests**: `tests/e2e/map2.spec.ts` — 4 new tests, all against REAL rendered coordinates/gestures, not synthetic `cy.emit()`/DOM-button clicks: (1) a real mouse shift-click with a few px of jitter on two rendered canvas Cards multi-selects both without dropping the first (this test was RED before the `boxSelectionEnabled`/`desktopTapThreshold` fix — reproduced directly, including the "wipes the whole selection" failure mode, before touching production code); (2) isolating two kept-but-originally-far-apart cards measurably pulls them together (real `position()` distance, before/after); (3) exiting isolate restores the exact original positions for both relaid-out and untouched nodes; (4) isolating a single card with zero curated relations doesn't hang/error. One timing fix along the way: the canvas-click test initially flaked under `--repeat-each` because the app's own one-time initial `ResizeObserver`-driven fit/zoom-floor (`resetView`, guarded by `initialFitDone`) could land after the test read its own click coordinates but before it clicked — fixed by polling for `zoom() >= 0.4` first, the same pattern the pre-existing Tier/Cluster-overlap tests already use.

**Gates**: `npm run validate` 133 entities/183 edges/0 errors (unchanged) · `npm run typecheck` (`astro check` + `tsc --noEmit`) 0 errors · `npx vitest run` 287/287 · clean production build, 400 pages · `npx playwright test tests/e2e/map2.spec.ts` 46/46 at `--workers=1` (two independent full runs), 92/92 at `--workers=1 --repeat-each=2`, against the real `playwright.config.ts` (the user's own live dev server on :4321, reused not restarted); one pre-existing test (`the injected full record shows the entity's TRUE full relation count`) flaked once under initial contention and passed cleanly on every other run, including standalone — not a regression from this round. Verification screenshots (not committed, scratch-only) confirm: two real-canvas-clicked Cards show `state-selected` styling with both listed as chips in the inspector; the isolated-then-relaid-out view visibly pulls DOI's Tier/Cluster boxes close together with no band overlaps.

### "Aislar" (Isolate) button: hard-hide everything outside the selection + its relations, alongside the existing Focus (dim) mode (2026-09-09, nineteenth follow-up)

User feedback this round: "is is possible to make a new button called 'aislar', to hide all that is not being selected and related with what is selected?? I [s]hould be able to select multiple boxes and retain those and their relations." A new, independent control on `/map` and `/map2` (`#map2-isolate-toggle`, labelled "Aislar"/"Isolate"), living next to the existing Focus button — both share the same selection/multi-select input and the same neighbourhood computation, now factored into one `selectionNeighborhood()` helper (`MapExplorerV2.astro`) used by both, so they can never drift out of sync on what counts as "related to the selection".

**The actual difference from Focus**: Focus dims out-of-scope elements (`.focus-dimmed`, opacity) so the full map stays visible-but-faded; Isolate HARD-hides them (`.isolated-hidden`, `display: 'none'`) — genuinely removed from the render, not just faded. Also hides any now-empty Tier/Cluster compound band: Cytoscape doesn't auto-hide a compound parent just because every child got `display:none`, so without this an "isolated" view would still show empty grey boxes. Sub-bands are checked before their owning Tier band so a Tier whose only content was a fully-hidden Cluster also collapses correctly; a band with at least one surviving child always stays visible.

**Mode interaction — mutually exclusive by design**: entering Focus while Isolate is active (or vice versa) silently clears the other mode's state first, so no element ever carries both classes at once. Each toggle button hides only for its OWN active mode (not the other), so the Focus button stays visible as a direct "switch instead" affordance while Isolate is active, and vice versa — no need to exit first just to change mode. Both modes share the single existing exit control (`#map2-focus-exit`, "← Full map"/"← Todo el mapa"), plus Escape and clicking the empty canvas background, all already-existing Focus exit affordances, now updated to check/exit either mode.

**Tests**: `tests/e2e/map2.spec.ts` — 8 new tests: single-card isolate hard-hides an unrelated card and its `display` style while keeping the selected card and its real neighbour visible; multi-selecting two non-adjacent cards and isolating keeps the UNION of both neighbourhoods (their shared neighbour stays visible, an unrelated card doesn't); an invariant test asserting every Tier/Cluster band's hidden state exactly matches whether it has any visible children (content-change-proof, not hardcoded to today's curated set); the shared exit button restores every card and band; Escape and empty-canvas-click both exit an active isolate session; a dedicated test drives a direct Focus<->Isolate switch through the real UI buttons and confirms no stray class survives the switch either direction.

### Tier titles moved back outside/above and left-flush, tighter Cluster horizontal grid gap (2026-09-09, eighteenth follow-up)

Follow-up to the seventeenth round's "titles inside the border" fix. User feedback this round: "clusters are ok in terms of title, but there's too much empty space between them (horizontally primary). Tier titles are not ok. I want the title to start on the beginning of the box (left side), not ending there like is right now. And above the box. Tier text size still not the same size as Cluster titles." Three fixes — Cluster titles themselves were confirmed correct and are untouched.

**1. Cluster horizontal grid gap.** The T1/T2 Cluster grid's horizontal gap (`computeLayout`'s `gapW`, `hierarchy.ts`) was built from `options.colSpacing` (220, tuned for spacing CARDS apart WITHIN one row) plus `CLUSTER_LABEL_CLEARANCE` — a real, measured asymmetry against the vertical gap (`gapH`, built from the smaller `rowSpacing`, 114): 356px horizontal vs. 250px vertical at production spacing, with no visual justification (neither grid axis is "a row of cards"). `gapW` now uses `rowSpacing` too, same as `gapH` — 250px on both axes.

**2. Tier title position — two independent axis fixes, both empirically verified via a standalone Playwright/Cytoscape harness (`renderedBoundingBox({includeLabels})` before/after diffs on a bare node, not guesswork) before touching production code:**
- *Horizontal*: `text-halign: 'left'` anchors a label's RIGHT edge at `(node left edge + text-margin-x)`, extending LEFTWARD (outward) from there — confirmed directly, this is why the title visibly sat outside the box's left edge instead of starting flush at the border and growing right. A flat `text-margin-x` can't fix this for every label (text width varies: "Comunitaria" vs. "Principios y políticas"), so `text-margin-x` is now a per-node function: `estimateLabelWidth(label, LABEL_FONT_SIZE) + TIER_LABEL_GUTTER` (both new exports from `hierarchy.ts`) — the label's own estimated width plus a small gutter, so its right edge lands just past its own left edge sitting at the border. `estimateLabelWidth` deliberately over- rather than under-estimates (real measured widths ran ~0.46-0.54x font-size per char; the shared `AVG_CHAR_WIDTH_RATIO` stays the existing conservative `0.62`) since an overestimate only leaves a slightly bigger gap from the border, while an underestimate would push the label back outside — the exact bug being fixed.
- *Vertical — a deliberate REVERSAL of the seventeenth round's decision, Tier-only*: `text-valign: 'top'` with `text-margin-y: 0` already anchors the label's bottom edge exactly at the border, extending upward — confirmed via the same harness. The seventeenth round's large POSITIVE `text-margin-y` (`LABEL_INSET_MARGIN`) pulled it back down inside the box; that's reversed here to a small NEGATIVE margin (`-TIER_LABEL_OUTSET_GAP`, 10px) so the title floats just above the border instead. `node.sub-band` (Cluster) keeps the old positive-margin/inside behaviour untouched.

**3. `hierarchy.ts` spacing reconciliation.** Since Tier's label lives outside its box again: `TIER_PADDING` shrank from the label-sized `compoundPadding()` formula to a small label-independent gutter (`TIER_BORDER_WIDTH + TIER_LABEL_GUTTER` = 12, was 62) — `CLUSTER_PADDING` is unchanged (still label-sized; Cluster stays inside). `LABEL_CLEARANCE` (the external gap between STACKED Tier boxes) grew back a real label-height term — `2 * TIER_PADDING + TIER_LABEL_OUTSET_GAP + LABEL_LINE_HEIGHT + 12` (88, was 136) — since the gap between two stacked Tier boxes must now physically contain the lower box's own label poking up into it. `MIN_TIER_CELL_WIDTH` now reuses the same `estimateLabelWidth` function that sizes the real per-node `text-margin-x`, instead of a separately hand-maintained ratio.

**Root cause of the perceived Tier/Cluster font-size mismatch (problem 3): not a font-size bug.** Both style rules already referenced the identical `LABEL_FONT_SIZE` constant before this round (verified in source). Measured directly via Cytoscape's own internal canvas-based text metrics (`node._private.rscratch.labelHeight`, real glyph metrics, not this codebase's own width estimate) after the position fix: Tier and Cluster labels report the exact same `fontSize` (36) and the exact same `labelHeight` (36px). The mismatch the user saw was the position bug in #2 — a title sitting outside the box's visible band (partially off the padded, low-contrast area, easy to misjudge as smaller/cut off) versus a title sitting boldly inside a saturated blue box — not an actual size difference. Resolved as a side effect of the position fix; confirmed via real screenshots at real default zoom showing both reading as the same size, plus the internal-metrics check above.

**Tests**: `tests/unit/map/hierarchy.test.ts` — new `'grids two single-card Clusters using the SAME rowSpacing-based gap on both axes, not colSpacing for the horizontal one'` test (with an explicit regression guard against the old, larger colSpacing-based gap); the pre-existing cross-tier-gap formula test (`LABEL_CLEARANCE`/`CLUSTER_PADDING` imported by name, not hardcoded) needed no changes since it tracks the constants' real values automatically. `tests/e2e/map2.spec.ts` — three new tests: Tier titles float above their box with zero left/right overshoot for both a short and a long real label; Cluster titles remain fully untouched (zero extension on every axis); Tier and Cluster labels report identical `fontSize`/`labelHeight` via Cytoscape's own internal metrics.

**Gates**: `npm run validate` 133 entities/183 edges/0 errors (unchanged) · `npm run typecheck` (`astro check` + `tsc --noEmit`) 0 errors · `npx vitest run` 287/287 · clean production build, 400 pages · `npx playwright test tests/e2e/map2.spec.ts` 35/35 at `--workers=1`, 70/70 at `--workers=1 --repeat-each=2`, against a throwaway preview server (a separate port from the user's own live dev server, left untouched).

### Tier/Cluster labels moved inside the border, unified size, spacing tightened further (2026-09-09, seventeenth follow-up)

Follow-up to the sixteenth round's spacing retune: "still far away; I want the boxes a little closer. Put tier titles top left (starting from the border) and the title for the sub-tiers (blue text) on top of the box, centered. Both with the same text size."

**Label repositioning, `MapExplorerV2.astro`'s Cytoscape stylesheet.** Both compound-label style rules already had `text-halign`/`text-valign` values that LOOKED like "top-left" from reading the property names alone, but `text-margin-y: -10` (negative) actually pushed the label further OUTSIDE the box's border — verified via a real screenshot, not assumed, since Cytoscape positions a `text-valign: top` label above a node's own border by default, same for a compound parent as for any regular node. Fixed:
- `node.tier-band` (Tier titles): kept `text-halign: left`, flipped `text-margin-y` positive (now `LABEL_INSET_MARGIN`, computed — see below) so the label's own bottom edge lands just inside the border instead of hanging above it. Added a matching text-background chip (same colour as the Tier's own fill) as a legibility safety net.
- `node.sub-band` (Cluster titles, the blue text): `text-halign` changed from `left` to `center` (explicit ask: "on top of the box, centered"), same inside-the-border `text-margin-y` mechanism.
- `font-size` unified to one `LABEL_FONT_SIZE = 36` for both (was 36 Tier / 45 Cluster) — verified legible at the real default zoom (`MIN_DEFAULT_ZOOM = 0.45`) via screenshot on both `/map` and `/map2`.

**Reconciling `hierarchy.ts`'s clearance formula with where labels actually render.** Since the label now occupies space the box already reserves (its own CSS `padding`) instead of floating outside it needing a separate external gap, the whole spacing formula was reworked:
- `LABEL_INSET_MARGIN` (the `text-margin-y` value) is no longer a flat guess — it has to be at least the label's own rendered line height (`~1.15x font-size`) plus a small gutter, because Cytoscape anchors a `text-valign: top` label's BOTTOM edge at `(border + text-margin-y)`; a small margin (the first attempt used `10`) leaves most of the label still poking out above the border. Now `LABEL_LINE_HEIGHT + 6`.
- `TIER_PADDING`/`CLUSTER_PADDING` (the boxes' own CSS `padding`, imported directly into `MapExplorerV2.astro` so the stylesheet and this module's gap math can never drift) are sized to fully contain that inset label: `LABEL_INSET_MARGIN + borderWidth + 10`.
- `LABEL_CLEARANCE`/`CLUSTER_LABEL_CLEARANCE` (the EXTERNAL gap between adjacent boxes) shrank from the ~178px/190px font-derived formula to `2 * padding + 12` — no longer needs to cover the label's height at all, only the fact that two adjacent boxes each auto-expand toward each other by their own padding.
- `tierGap` (32→16): the padded border itself now reads as a clear separator, so this needed to do less work.
- New: the T1/T2 Cluster grid's own outer width/height (`computeLayout`'s `GRID_TIERS` branch) now adds `2 * CLUSTER_PADDING` on each dimension — a real bug caught via the Playwright overlap check while tightening this: the grid math accounted for padding BETWEEN adjacent Cluster cells (via `CLUSTER_LABEL_CLEARANCE`) but not at the grid's own outer edges, where the outermost row/column's Clusters still auto-expand by their own padding with nothing on the other side to have budgeted a gap against. The old, much larger clearance buffer had been silently masking this exact gap.

**Verification, not assumption**: a real Playwright bounding-box overlap check (`tests/e2e/map2.spec.ts`'s two pre-existing "no two rendered Tier/Cluster boxes overlap" tests) went through several real failures during this round — first 6 overlapping pairs once the old buffer's slack was removed, then 1 residual ~9px overlap after fixing the grid's outer-edge padding gap, finally 0 once `LABEL_INSET_MARGIN` was corrected to actually cover the label's own height (the real root cause: the margin was too small to pull the label fully inside, not the clearance buffer). Re-confirmed clean on both `/map` (full corpus) and `/map2` (curated subset) at the real default zoom, `--workers=1` and `--repeat-each=2`. Screenshots (not committed, scratch-only) confirm: Tier titles read top-left flush with the border, Cluster titles read top-center inside the blue box, both the same size, legible against their fills, with a visibly tighter gap between Tier/Cluster boundaries than the sixteenth round left.

**Tests**: `tests/unit/map/hierarchy.test.ts` — the cross-tier-gap regression test's hardcoded expected formula updated to include the new `2 * CLUSTER_PADDING` term (a single-node Tier still nests inside its own Cluster box, which now correctly reserves its own padding); `LABEL_CLEARANCE`/`CLUSTER_PADDING` still imported by name so the test tracks the constants' real values automatically. All other tests unaffected — the change is confined to `hierarchy.ts`'s exported clearance/padding constants and `MapExplorerV2.astro`'s stylesheet.

**Gates**: `npm run validate` 133 entities/183 edges/0 errors (unchanged) · `astro check` + `tsc --noEmit` 0 errors · `npx vitest run` 286/286 · clean production build, 400 pages · `npx playwright test tests/e2e/map2.spec.ts` 32/32 at `--workers=1`, 64/64 at `--workers=1 --repeat-each=2`.

### Automatic tight Cluster/Tier spacing, and a Focus mode for card selection (2026-09-09, sixteenth follow-up)

Two independent user requests against `/map`/`/map2` (shared `MapExplorerV2.astro`): "the space between cluster and tiers is too high... can we achieve this in an automatic way, so when we add/remove cards, it works well?", and "can we implement a focus, so once I select something (one or more cards), I can only see those (for if the distance is too high)".

**Tight, automatic Cluster/Tier spacing.** The prior round's `LABEL_CLEARANCE = 260` was a single flat, empirically-guessed constant applied everywhere a Tier or Cluster boundary needed clearance from its neighbour's label overhang — generous enough to never overlap, but far more than any real label needs, and, being a single number, blind to how much (or little) content a given Tier/Cluster actually holds. Two changes, both in `hierarchy.ts`:
- `LABEL_CLEARANCE` (Tier bands, 36px labels) and a new `CLUSTER_LABEL_CLEARANCE` (Cluster boxes, 45px labels — kept separate since a Cluster's bigger label needs more room than a Tier's) are now derived from a `labelClearance(fontSize, borderWidth, padding)` formula reading the actual label style constants already in `MapExplorerV2.astro`'s stylesheet, plus a safety buffer — 260px flat down to 178px/190px. Automatically stays correct if font-size/padding/border ever change in the stylesheet again, instead of needing another hand-tuned round number.
- The T1/T2 Cluster grid (`computeLayout`'s `GRID_TIERS` branch) switched from one UNIFORM cell size (sized to the single widest/tallest Cluster anywhere in the Tier, forcing every smaller Cluster into a cell sized for the biggest one) to per-row/per-column sizing, so a sparse Tier's grid is only as big as its own sparse content needs — this is the actual "automatic... when we add/remove cards" fix: dead space now scales with what's really there instead of a global worst-case.
- New `MIN_CLUSTER_CELL_WIDTH`/`MIN_TIER_CELL_WIDTH` floors on a compound box's own declared width: found empirically that a Cluster/Tier whose real CARD content is narrower than its own label's rendered TEXT WIDTH still visually auto-expands (Cytoscape's compound `boundingBox()` includes the label), which the height-only clearance formula above doesn't cover — a narrow-content-but-long-label Cluster (e.g. "Sin fines de lucro") was overlapping its neighbour even with a generous gap between declared box edges. Reserving the width up front (rather than inflating the gap for every box regardless of need) is the tighter fix.

**Verification, not assumption**: a real Playwright bounding-box overlap check (`tests/e2e/map2.spec.ts`, two new tests) confirms zero overlapping Tier/Cluster box pairs on both the full `/map` corpus and the curated `/map2` subset, at the real default zoom (waited for the zoom floor to settle first — an unrelated pre-existing timing race in this suite's `renderedBoundingBox()` reads, made newly visible by the tighter layout, fixed by polling for `zoom() >= 0.4` before measuring). Also fixed a real bug in the pre-existing "no two rendered node boxes are closer than a real, visible gap" test: its gap formula used `min(dx, dy)` for a diagonal (non-overlapping-on-either-axis) pair, which badly underestimates true separation — two cards in unrelated Tiers/columns that happen to land at a similar on-screen row height purely by coincidence reported a ~5px "gap" despite being genuinely 1000+px apart; replaced with the correct Euclidean nearest-corner distance for that case.

**Focus mode.** `MapExplorerV2.astro` gained a generic, always-present (both `/map` and `/map2` — unlike the pre-existing `showAdvanced`-only N-hop `#map2-hops` control, which stays `/map`-only and untouched) "Focus"/"← Full map" button pair. Selecting one or more Cards (click, shift-click, or now also ctrl/meta-click on the canvas — extended to match the Layers-panel buttons' own modifier handling) reveals a "Focus" button; clicking it dims every Card/edge outside the union of the selected Cards' 1-hop neighbourhoods (reusing the existing `.focus-dimmed` opacity-0.15 styling and `nHopNeighborhood` helper, extended to support more than one seed) and re-fits/zooms the camera onto just that neighbourhood — the part plain dimming doesn't solve for the actual complaint ("distance is too high"): related Cards scattered across a large layout are now brought into view together, not just visually de-emphasised in place. Exits via the "← Full map" button, the Escape key, or clicking empty canvas background (all three restore the full view and camera).

**Design decisions, explicit**: DIM (opacity), not hard `display:none` — Tier/Cluster compound bands stay visible throughout as context, and the user can still see roughly where the rest of the map is. Focus is UNION-of-neighbourhoods for multi-select (not exact-selected-set-only) — showing each selected Card's own immediate context reads better than showing only the bare selected Cards with no relations visible. Entry is an explicit button click, not automatic on every selection — the existing single-click "browse this entity" flow (immediate full-record fetch, 5-state dim-to-35%) stays undisturbed; auto-refitting the camera on every click (including every intermediate click while shift-selecting) would have fought that flow.

**Tests**: `tests/unit/map/hierarchy.test.ts` unaffected (44/44, `LABEL_CLEARANCE` is imported by name so the cross-tier-gap test tracks its new value automatically). `tests/e2e/map2.spec.ts`: 2 new Tier/Cluster overlap tests (`/map`, `/map2`) plus 5 new Focus-mode tests (button appears on selection; single-select isolates neighbour vs. unrelated; multi-select unions two neighbourhoods including their shared node; "← Full map" restores everything; Escape exits; clicking empty canvas exits) — all reusing this suite's existing multi-select/tap-simulation conventions, none touching the pre-existing tap-target/link-interception tests.

**Gates**: `npm run validate` 133 entities/183 edges/0 errors (unchanged) · `astro check` + `tsc --noEmit` 0 errors · `npx vitest run` 286/286 · clean production build, 400 pages · `npx playwright test` on `map2.spec.ts`, 32/32 reliably at `--workers=1` (also 32/32 `--repeat-each=2`); 3 pre-existing, environment-specific tests (page-scroll, Cytoscape-container-size-race, class-box LOD cycle) are flaky under this sandbox's default 8-parallel-workers preview server — confirmed identical failures against the unmodified baseline too, so not a regression from this round; not touched.

### Grid arrangement for Tiers/Clusters, corrected text scope, real Cluster visibility (2026-09-08, fifteenth follow-up)

User corrected two things from the fourteenth follow-up and asked for a real layout redesign. Nomenclature introduced this round (used going forward): **Tier** = one of the 4 big grey top-level compound boxes; **Cluster** = the nested compound box inside a Tier (by governance in T1, by region in T2); **Card** = the individual colored entity box (`node-svg.ts`'s class-box SVG).

**Correction 1 — the 3x text tripling was the wrong target.** "Increase the box text size, triple it" meant the grey Tier/Cluster labels, not the colored Cards. Reverted `node-svg.ts` (`CLASS_BOX_WIDTH` 528→176, and every other dimension/font-size back to its pre-tripling value) and everything retuned to match it: `hierarchy.ts`'s `DEFAULT_LAYOUT_OPTIONS` (rowSpacing/colSpacing/tierGap back to 114/220/32) and `MapExplorerV2.astro`'s `LOD_ZOOM_THRESHOLD`/`MIN_DEFAULT_ZOOM` back to 0.4/0.45. Tripled the Tier label (`font-size` 12→36) and Cluster label (15→45) instead, in `MapExplorerV2.astro`'s style blocks, and pushed Cluster contrast further after two prior passes were both reported invisible: `#dbe4ff` fill (fully opaque), 4px `#3949ab` border — a real, obvious nested box at a glance now, verified via headless-browser screenshots at the page's actual default zoom, not a zoomed-in crop.

**Correction 2 — 2D grid arrangement, at both the Tier and Cluster level.** User confirmed (asked directly): both the 4 Tiers and the Clusters within a Tier should tile in a 2D grid instead of one long vertical stack. Rewrote `hierarchy.ts`'s `computeLayout`: extracted the existing same-type-run-preserving sub-row packer into a reusable `layoutComposite()` returning a block's footprint relative to its own origin; T1/T2 Clusters (each one composite post-`computeRanks`, with no remaining real hierarchy signal between them — the de-dup pass exists only to keep them apart, not to rank them) now tile into a `ceil(√n)`-column grid of uniform cells instead of stacking; T3/T4 keep the original single-column stack (their composites still encode a real depth relationship worth reading top-to-bottom). The 4 Tiers themselves now arrange in 2 columns — column A = {T1 at the bottom, T2 above it}, column B = {T3 at the bottom, T4 above it} — grouping the two real adjacent pairs in the conceptual 1→2→3→4 stack (the only relationship cut is the 2/3 boundary, unavoidable when splitting 4 into 2×2) and conveniently isolating the two now-gridded, usually-widest tiers (1, 2) into their own column.

**Real bug found and fixed along the way**: the first grid pass produced overlapping Cluster/Tier boxes on the real corpus — not Cards (zero Card-to-Card overlaps at any point), but the boxes' own borders/labels. Root cause, caught via an actual Playwright bounding-box overlap check (not assumed): Cytoscape renders a compound node's label OUTSIDE its children-derived bounds (`text-valign: top`), and the tripled 36-45px labels needed far more clearance than `rowSpacing`/`colSpacing` (tuned only for Card-to-Card gaps) provided — so adjacent grid cells' and stacked tiers' label/border regions visually intruded into each other. Fixed with a new exported `LABEL_CLEARANCE = 260` constant added on top of the normal gutters at every Cluster-grid-cell boundary and every Tier-to-Tier boundary (including the inter-column gap). Re-verified via the same overlap script: zero same-class band overlaps and zero Card overlaps on both `/map` (14 bands, 133 entities) and `/map2` (10 bands, 33 entities) after the fix.

**Tests**: `hierarchy.test.ts` — the old "dense-rank spacing" test used 5 distinct T1 types/governances to get 5 stacked rows, which no longer stack (T1 is now gridded); repurposed it to T4 (one of the two tiers that kept the single-column stack) and added a new test asserting the grid property directly (5 governance buckets tile into a 3-column/2-row grid, not 5 stacked rows). `LABEL_CLEARANCE` exported specifically so the cross-tier-gap test could assert the exact real gap instead of a stale hardcoded number.

**Gates**: `npm run validate` 133/183/0 errors (unchanged) · typecheck 0 errors · `npx vitest run` 286/286 · clean production build, 400 pages · `npx playwright test` on `map2.spec.ts` + `interactivity.spec.ts` + `a11y/routes.spec.ts`, 66/66 (4 axe-core failures on unrelated routes — `/layers/`, `/entity/openalex/`, `/relations/owned-by/`, `/views/vertical-integration/` — were transient full-suite worker contention against a freshly-started preview server, not a regression: all 9 passed cleanly re-run in isolation).

### Nested sub-band boxes for T1/T2, and 3x class-box text (2026-09-08, fourteenth follow-up)

User clarified a real misunderstanding from the thirteenth follow-up: "split into more nodes" meant the 4 big grey tier-band containers themselves ("Instituciones y agencias", "Instrumentos y sistemas", etc.) should split into nested sub-boxes — not (as built) spreading entities across more rows within one shared container. That row-separation work stood as a real, necessary prerequisite, not wasted effort: it's what let this round's nested compound boxes render without their rows colliding.

**Nested sub-bands**: `MapExplorerV2.astro`'s `initMap()` now adds a second compound layer for T1 (by `governance`) and T2 (by region) only — T3/T4 keep a single flat band, unchanged. Each entity's Cytoscape `parent` becomes its sub-band's id (`__subband-<tier>-<governance-or-region>`) instead of the tier band directly; each sub-band's own `parent` is the tier band, so nesting is entity → sub-band → tier-band. Sub-band labels use the already-existing `governanceLabel` (T1) and a new server-side `regionLabel` field (T2, resolved via `tagsVocab` and stripped of its `region:`/`región:` namespace prefix — "Europa", not "región: Europa" — redundant once nested under an already-labelled tier band). Sub-bands carry their own `sub-band` class (deliberately NOT also `tier-band`, after a first pass that did and broke a test asserting exactly 4 `.tier-band` nodes) with a real border/tint (`#eef2ff` fill, `#6e7fda` 2px border, bold 15px label) — a first near-white/1px-border pass was verified via an actual headless-browser screenshot and turned out invisible at normal zoom despite being functionally correct, so contrast was deliberately pushed much higher. A new `isBandNode()` helper (`hasClass('tier-band') || hasClass('sub-band')`) replaces the 6 call sites that used to check `hasClass('tier-band')`/`.not('.tier-band')` alone, so tap/hover/dim/tooltip interactions treat sub-bands exactly like tier bands (non-selectable, never dimmed).

**Real bug found and fixed along the way**: the thirteenth follow-up's `groupKey` (`${tier}|${type}|${governance/region}`) and its depth-de-duplication pass (scoped to `${tier}|${type}`) were correct for spreading same-type entities across rows, but wrong for this feature — two DIFFERENT (type, governance) cohesion groups (e.g. `identifier|nonprofit` and `cris|commercial`) were never de-duplicated against each other, so they could and did land on the same depth, and their two nested boxes rendered visually overlapping on screen (caught via an actual Playwright screenshot, not assumed). Fixed in `hierarchy.ts`: `type` dropped from the T1/T2 `groupKey` entirely (now `${tier}|${governance}` / `${tier}|${region}`, merging every entity sharing that value regardless of type into one cohesion group — correct, since one nested box holds one governance/region value's entities, whatever type they are), and the separation pass's scope widened from `${tier}|${type}` to the whole tier for T1/T2 (every governance/region bucket now mutually exclusive tier-wide), while T3/T4 keep the original per-type scope unchanged (a no-op there regardless, since their `groupKey` has no further split dimension). Verified via a Playwright script checking every sibling sub-band pair's bounding box for real overlap: zero overlaps on both `/map` (10 sub-bands, 133 entities) and `/map2` (6 sub-bands, 33 entities).

**3x class-box text**: `node-svg.ts`'s box dimensions, padding, and both font sizes are the original values × 3 (`CLASS_BOX_WIDTH` 176→528, row/title/stereotype heights and all internal offsets scaled identically, font-size 9→27 and 12→36) — every proportion preserved, not just the two font attributes, so nothing overflows. `hierarchy.ts`'s `DEFAULT_LAYOUT_OPTIONS` (rowSpacing/colSpacing/tierGap) scaled ×3 in lockstep, since those gutters were sized relative to the old box footprint. `MapExplorerV2.astro`'s `LOD_ZOOM_THRESHOLD` and `MIN_DEFAULT_ZOOM` divided by 3 (zoom is screen-px per world-unit; the world just got 3x bigger, so the same on-screen legibility now needs a 3x-smaller zoom). Fixed a small pre-existing duplication bug found along the way: `applyLod()` hardcoded `width: 176` instead of importing `CLASS_BOX_WIDTH` like the constant's own doc comment says every consumer should — now imported and used.

**Tests**: `hierarchy.test.ts`'s dense-rank-spacing test (`identifier`/`index`/`repository`/`cris`/`aggregator`, previously relying on distinct TYPES alone to avoid cohesion) updated to also assign distinct `governance` per node, since type alone no longer guarantees separate buckets. `map2.spec.ts`: the curated-subset node-count check now filters to `:childless` (compound band/sub-band container nodes are not curated entities — the corpus-wide node count grew from 4 non-entity nodes to 4+6); the LOD dot-mode zoom trigger and the default-zoom-floor assertion both updated for the new `/3`-scaled thresholds (0.2→0.1, 0.45→0.15); the tier-band count assertion needed no change (self-healed once sub-bands stopped also carrying the `tier-band` class).

**Gates**: `npm run validate` 133/183/0 errors (unchanged) · typecheck 0 errors · `npx vitest run` 285/285 · clean production build, 400 pages · `npx playwright test` on `map2.spec.ts` + `interactivity.spec.ts` + `a11y/routes.spec.ts`, 66/66.

### T1/T2 rows split by governance/region instead of one row per type (2026-09-08, thirteenth follow-up)

User, looking at the promoted `/map`: "instituciones y agencias should split by region... instrumentos y sistemas can be split too... not sure here by what." Both tiers were the unconditional same-(tier,type) row-cohesion rule (2026-09-07) doing its job correctly but at a scale (49 and 66 entities respectively) where "everything of one type, one row" reads as visually concentrated rather than legible.

Investigated before touching code: `subtype` doesn't help split T1 ("instrumentos y sistemas") — it's null on `identifier` and `repository`, the two largest T1 types. `governance` (commercial/nonprofit/community/academic/public-agency/intergovernmental) is already populated on every entity and varies meaningfully within every T1 type (e.g. `index`: Scopus/Web of Science/Dimensions are `commercial`, OpenAlex is `nonprofit`). For T2 ("instituciones y agencias"), no `geography` field exists — only `region:*` tags (`latam`/`europe`/`global`/`chile`), and `region:north-america` didn't exist yet: US/Canada orgs (Harvard, Cornell, CDL, Allen Institute for AI, Center for Open Science, arXiv Inc., GIDA, LYRASIS, OurResearch, Schmidt Sciences, Simons Foundation, Wikimedia Foundation, International DOI Foundation) were all lumped into `region:global` alongside genuinely transnational orgs (W3C, DataCite, ISSN International Centre, ORCID, the DOI Foundation's own RAs, etc. — these have no `country` field in the corpus at all, unlike the US/CA orgs above, which do).

**Content**: added `region:north-america` to `src/content/vocab/tags.yaml`. Retagged 14 T2 entities from `region:global` (or, for `bepress`, no region tag at all) to `region:north-america`, purely on the corpus's own existing convention (a `country:` field means a real single-country domicile; its absence is how the corpus already marks an entity as genuinely transnational — International DOI Foundation, GIDA, and Wikimedia Foundation all carry a `country: US` despite their internationally-scoped mission/membership, consistent with how the corpus already treats e.g. `digital-science`/`country: GB` as UK-domiciled rather than global): `california-digital-library`, `allen-institute-for-ai`, `harvard`, `bepress`, `arxiv-inc`, `center-for-open-science`, `gida`, `cornell`, `ourresearch`, `schmidt-sciences`, `international-doi-foundation`, `lyrasis`, `simons-foundation`, `wikimedia-foundation`. No Canada-domiciled T2 entity exists in the current corpus. Entities with no single-country domicile (W3C, DataCite, ORCID, Crossref, the ISSN/ISBN international centres, RDA, CODATA, etc.) were left untouched at `region:global`.

**Code**: `src/lib/map/hierarchy.ts`'s `groupKey` (the row-cohesion key inside `computeRanks`) is now tier-specific instead of always `${tier}|${type}`: T1 groups by `${tier}|${type}|${governance}`, T2 by `${tier}|${type}|${region}` (first `region:*` tag, defaulting to `'global'` when absent), every other tier keeps the original `${tier}|${type}` key unchanged. `RankInput` gained two optional fields (`governance`, `tags`) to carry this — no change needed in `MapExplorerV2.astro`: its existing `MapNode` interface already includes both fields (used elsewhere for the class-box governance line and the facet chips), so it's structurally assignable to the widened `RankInput` as-is. `computeXSlots` (within-row ordering) untouched — it doesn't need to know about the new split, only about members that already share a row.

**Tests**: `tests/unit/map/hierarchy.test.ts` — two new synthetic-fixture tests demonstrating the split in isolation (same-governance/same-region members still snap to one row; a different-governance/different-region member is no longer dragged onto that row). The real-corpus `loadCuratedGraph()` fixture now also loads `governance`/`tags` from frontmatter; its generic "every group shares one composite" sweep now mirrors `hierarchy.ts`'s own extended key (T1 by governance, T2 by region) rather than the old type-only key, so the invariant it checks matches what the code actually guarantees post-split. Added a concrete real-corpus anchor: OpenAlex (`nonprofit`) no longer shares a row with Scopus/Web of Science (`commercial`), all three `type: index`.

**Gates**: `npm run validate` 133/183/0 errors, 67 warnings (all pre-existing, none touching the new tag or retagged files) · typecheck 0 errors · `npx vitest run` 282/282 (was 279; +3 new) · clean production build, 400 pages · `npx playwright test` on `map2.spec.ts` + `interactivity.spec.ts` (40/40) and `a11y/routes.spec.ts` (26/26, axe-core zero violations on `/map` and `/map2`, both locales).

### `/map` promoted to the full map2 rendering (hierarchical layout, class-box nodes, fetch-injected inline record) — the two routes now share one component (2026-09-07, twelfth follow-up)

User, after trying the eleventh follow-up's fixes on `/map2`: "implement this layout, to map" — clarified via a direct question to mean the FULL map2 experience (not just the layout algorithm), applied to the whole ~133-entity corpus. This lifts the "keep `/map` untouched" rule that governed every prior `/map2` round this session.

**Architecture decision**: `MapExplorerV2.astro` becomes the ONE shared component behind both `/{loc}/map` (no `entityIds` — whole corpus) and `/{loc}/map2` (curated `entityIds`, unchanged). The old `MapExplorer.astro` (fcose layout, no class-box rendering, no fetch-injected inspector) is deleted rather than kept as a second, now-permanently-diverging ~1900-line file. Its three features `/map2` never needed — a Layers-panel facet-filter block, Focus mode (N-hop dimming), and URL query-state — were ported INTO `MapExplorerV2.astro` behind a new `showAdvanced` prop (`/map`: `true`; `/map2`: omitted/`false`, unchanged behaviour, verified: no filters/focus DOM present, still exactly 33 nodes). A route-aware `data-onboarding-key` (`mapOnboardingDismissed` vs. `map2OnboardingDismissed`) keeps the two routes' onboarding-dismissal state independent even though they now share the same DOM ids.

**What `/map` gains from the promotion** (the actual `/map2` iteration this session, now applied at full scale): the tier+depth hierarchical `preset` layout (`hierarchy.ts`) replacing `fcose`'s non-guaranteed force-directed one; ER-style class-box node rendering (`node-svg.ts`) with zoom-dependent LOD; the tier-band compound grouping WITH its hover-dim fix (tier-bands excluded from the dim pass — the bug that used to wash out every node, including the hovered one, via compound-opacity multiplication); the resizable inline inspector that fetches and injects the entity's REAL standalone-page content directly on selection (no button, no new tab), with click-interception on internal relation links (selects on-canvas instead of navigating away) and a stale-fetch race guard; the app-shell viewport fix (no page-level scrollbars); normal wheel-zoom sensitivity; the in-page search restored from the graph payload.

**Promoted site-wide, not just to `/map`**: the `community` type-colour fix (was a `/map2`-only override — `#0969da` collided with `repository`/`standard`, measured via CIEDE2000). `src/lib/mermaid/palette.ts`'s `TYPE_FILL.community` is now `#bf3989` directly, so every Mermaid diagram gets the fix too, not just this one route's Cytoscape rendering. `palette-overrides.ts`'s `MAP2_TYPE_FILL_OVERRIDES` is now a documented no-op (same value), kept as a one-line escape hatch rather than removed.

**Scale, measured (not assumed)**: ran `computeLayout`/`computeRanks` against the real 133-entity/183-edge corpus before assuming anything: 7 distinct tier/depth rows result, widest single-composite group is 53 members (organization:42 + community:11) — `maxPerRow`'s existing "never split a same-type run except against itself" rule already bounds this to a max row width of ~1100px (packs into same-type sub-rows), producing a tall (~3630px) but never absurdly-wide layout — no retuning of `DEFAULT_LAYOUT_OPTIONS` was needed. `MIN_DEFAULT_ZOOM` (0.45) was originally calibrated at 33 entities but its rationale (class-box text legibility at a given zoom, not "show N% of the corpus") is corpus-size-independent — confirmed live at 133 entities: default view opens at zoom 0.45 with all 133 nodes rendered as full class boxes (not dots), same as at 33.

**Real incident during verification, fixed**: `rm -rf dist .astro node_modules/.astro` was run once while the user's own `npm run dev` (long-running, port 4321) was still active — deleting `.astro`'s live content-collection cache out from under a running dev server corrupted its routing (every entity page 404'd). Traced via a direct `curl`, not assumed. Fixed by restarting the exact same `npm run dev` command on the same port — a full recovery, not a workaround. Lesson for future rounds: `.astro`/`node_modules/.astro` are LIVE caches for a running dev server, unlike `dist` (only touched by `build`/`preview`) — don't delete them while a dev server might be using them; a build's own `rm -rf` should stick to `dist` when a dev server (as opposed to a `preview` server) is what's actually running.

**Tests**: `tests/e2e/interactivity.spec.ts`'s old `/map interactive Cytoscape canvas` describe block (14 tests against the deleted `MapExplorer.astro`'s DOM/ids) replaced with a smaller `/map (full-corpus, showAdvanced)` block (10 tests) covering only what's unique to `/map` now — full-corpus scale and the `showAdvanced`-only features (facets/Focus/URL-state) — since engine-level behaviour (hover-dim, LOD, resize, fetch-injection, click-interception) is already thoroughly covered by `map2.spec.ts` against the same shared component. One test (layer-band Y-ordering by the OLD `fcose`+`LAYER_ORDER` model) was deleted outright rather than adapted — the new hierarchy is tier/depth-based, a structurally different axis with its own dedicated unit tests in `hierarchy.test.ts`; there is no live-DOM equivalent of "layer bands in memo order" to preserve. `keyboard.spec.ts` and two existing `map2.spec.ts` tests (cross-links, onboarding independence) updated for the shared id scheme (`#map2-*` on both routes now). `tests/unit/map/palette-overrides.test.ts`'s one assertion that the override "differs from the shared palette" was updated to assert the opposite — deliberately, now that the fix lives in the shared palette. Gates: `npm run validate` 133/183/0 errors (content unchanged) · typecheck 0 errors · clean build 398 pages · `npx vitest run --coverage` 279/279, 100% statement/branch/function/line coverage · `npx playwright test` 78/78, `map2.spec.ts` and `interactivity.spec.ts` each re-run standalone twice more for flakiness (stable both times) · axe-core zero violations across the full a11y route suite, both locales, at the new full-133-entity scale.

### Relation links inside the injected full record select on-canvas instead of navigating away (2026-09-07, eleventh follow-up)

The tenth follow-up (below) flagged as a known, unfixed trade-off: relation links inside the fetched/injected full-page content are real `<a href="/${locale}/entity/${id}/">` anchors, so clicking one navigated the whole browser away from `/map2`, losing the map. User: "we lose the buttons you implemented."

Fixed with one delegated `click` listener on the stable `#map2-inspector-content` container (added once, not re-attached on every render, since the container itself persists across selections — only its `innerHTML` is replaced): it intercepts clicks on any same-locale entity-page link (`/${locale}/entity/<id>/`, matched via a small regex) inside the injected content, calls `preventDefault()`, and routes into the existing `toggleSelection(id, { additive: false })` path instead — selecting the target on the canvas and re-triggering the same fetch+inject flow for its own full record, all without leaving `/map2`. A link to an entity that isn't part of the curated `/map2` set (no `nodeById` entry — nothing to select) falls back to a real navigation rather than doing nothing. Everything else — external source URLs, the `/entity/<id>.json` raw-JSON link, any link not matching the entity-page pattern — is left completely alone and keeps its normal behaviour; the regex simply doesn't match them, so they were never intercepted in the first place.

Added to `tests/e2e/map2.spec.ts`: a test selecting `datacite-metadata-schema`, expanding its (real, native) "More detail" `<details>`, clicking its Zenodo relation link, and asserting both that the URL stays `/es/map2/` (no navigation) and that the canvas's own `.state-selected` class moved to `zenodo`; and a test confirming the raw-JSON export link and external source links are left untouched (checked by inspecting their real `href`s rather than by clicking through an external, network-dependent URL, which would be flaky in CI).

Also verified, not touched: my own hand-edit to `src/lib/map/hierarchy.ts` earlier this round (removing the union-find "keep genuinely-connected same-type members split" exception, so all same-(tier,type) members — DOI, Handle System, ORCID, ROR — now unconditionally share one row, per explicit user instruction) — confirmed coherent, typechecks, and all existing + new hierarchy tests pass.

Process note: mid-verification, the `npm run dev` server this round initially found already running on :4321 had exited on its own by the time Playwright ran (unrelated to anything in this round) — Playwright's own `webServer` config then transparently started a `preview` server against a **stale, pre-edit `dist/`**, so the very first test pass against the new interception code failed with real page navigations even though the fix was correct. A full `rm -rf dist .astro node_modules/.astro && npm run build` resolved it; all gates below are against that fresh build.

### Full record now loads immediately on selection, no button (2026-09-07, tenth follow-up)

The ninth follow-up (below) turned "open full page" into a button that fetched the real standalone page into the inspector pane on click, with a compact hand-built summary shown by default and a "back to summary" control. User's next message: "this is going too much... I first asked if a separate [page] is needed for this exact reason; is it needed to have a button? why is not displayed directly?"

Fixed: `renderSingleInspector` (`src/components/MapExplorerV2.astro`) now fetches and injects the real full-page content directly, the moment a node is selected — no button, no intermediate compact-summary view, no "back" control. Shows a `role="status"` loading message (with the entity's name) while the fetch is in flight, then replaces it with the injected `article.entity-page` content (same fetch+inject mechanism as the ninth follow-up: strip embedded `<script>`, demote headings by one level). A monotonically-increasing `inspectorRequestId`, captured per call and checked before injecting, guards against a stale fetch clobbering a newer selection's content if the user reselects before the first fetch resolves. Fetch failure now shows an inline error with a same-tab fallback link to the full page (there's no more "back to summary" to fall back to).

Removed as now-fully-dead code (no remaining call sites): `relationPill`, `relationLinkOut`, `appendRelationDirection`, the old button/back-control markup, and the compact hand-built summary block (badges/aka/description/facets/relations/extra-fields/sources/last-reviewed/raw-JSON — all superseded by the real injected page, which shows the same information natively and always correctly, e.g. its own true relation counts — the eighth follow-up's `fullOutgoing`/`fullIncoming`/`inSet` server-side plumbing is now unused dead *data* rather than a dead code path, left in place as low-risk and out of this round's scope). Pruned the matching now-unused i18n keys from `PanelI18n`/`strings.es`/`strings.en`/`panelI18n` (`outgoingLabel`, `incomingLabel`, `fullRecordLabel`, `backToSummaryLabel`, `sourcesLabel`, `detailsLabel`, `descriptionLabel`, `alsoKnownAsLabel`, `tagsLabel`, `disciplinesLabel`, `geographyLabel`, `lastReviewedLabel`, `rawJsonLabel`, `sinceLabel`, `notOnMapLabel`, `fallbackNotice`) and the dead `.map2-back-to-summary` CSS rule. Confirmed via grep that `MapExplorer.astro` (`/map`) keeps its own separate, untouched copies of these same-named identifiers — no cross-contamination.

Known trade-off, not fixed in this round (out of scope, flagging for a follow-up if it matters): clicking a relation inside the injected full-page content is now a real page-to-page navigation (a plain `<a href>` from the fetched static HTML), not a "select this node on the canvas" interaction — the previous hand-built relation pills supported the latter (`toggleSelection`), the real injected page's own relation links do not. If in-pane relation-click-to-select-on-canvas is still wanted, it would need explicit link interception on the injected content, not built here.

Updated `tests/e2e/map2.spec.ts`: rewrote the full-page test to assert content loads immediately on selection (no button click); rewrote the relation-count test to assert the true count against the injected content directly (this class of bug — the pane's own relation list undercounting vs. the real page — structurally cannot recur now, since the pane shows the real page's own accurate content); added a new test asserting a fast reselect (DOI → ROR before DOI's fetch settles) ends up showing ROR's content, not a stale DOI result.

Verification: `npm run validate` (133/183/0 errors, unchanged), `npm run typecheck` (0 errors), clean build (398 pages), `npx vitest run --coverage` (279/279, 100% line/branch/func/stmt), `npx playwright test --workers=1` (81/81), `map2.spec.ts` re-run standalone (23/23, stable), `tests/a11y/routes.spec.ts` (26/26, zero axe-core violations), `/map`/`MapExplorer.astro`/`palette.ts` mtimes unchanged from session baseline, port 4321 clean.

### Same-type row cohesion made unconditional, and "open full page" now loads inline instead of a new tab (2026-09-07, ninth follow-up)

Two real problems, both user-reported directly after the eighth follow-up round shipped:

**1. Row grouping still scattered same-type entities.** The previous fix (`src/lib/map/hierarchy.ts`, `computeRanks`) kept a same-(tier,type) group's genuinely-connected members (e.g. DOI `depends-on` Handle System, both `identifier`) split at their real graph depths, and only collapsed the "singleton" members with no internal edge onto one shared row. The user rejected that exception outright: "DOI, handle, orcid ID, ROR: are not in the same row, and are all identifiers; why????" — they want same type = same row, unconditionally, with no carve-out for a real edge between two members. Reverted to the simpler rule (snap every member of a same-(tier,type) group onto the group's mode depth, always) and removed the now-unused union-find code. Known, deliberate trade-off, flagged rather than hidden: this also collapses real same-type ownership chains onto one row — e.g. RELX/Elsevier and Holtzbrinck/Digital Science (all `type: organization`) no longer render with the parent visibly above the subsidiary. The vertical hierarchy narrative ("concepts to instruments") still works fully *between* types/tiers; it no longer also holds *within* one type, per direct instruction. Updated `tests/unit/map/hierarchy.test.ts` (removed the now-wrong "does NOT collapse... DOI/Handle System" test and the union-find-mirroring corpus test; added a direct real-corpus assertion that DOI/Handle-System/ORCID/ROR all share one composite) and `tests/e2e/map2.spec.ts`'s hierarchy-order test (now asserts DOI/Handle-System/ORCID/ROR share one row, not that DOI sits above Handle System).

**2. "Ver ficha completa"/"Open full page" still opened a new tab.** Two prior rounds made the inspector's own hand-built summary richer, but never touched this control — it kept navigating to `/${locale}/entity/${id}/` in a new tab, exactly as before either round shipped. The user said so three times, with increasing frustration, and asked for either inline rendering or a modal — explicitly not a new tab. Fixed for real: the control (now a `<button>`, not an `<a target="_blank">`) fetches the real, already-existing standalone entity page (same-origin, static, pre-rendered) and injects its actual `article.entity-page` content into the same inspector pane — no second hand-maintained summary to keep in sync, no navigation away, no new tab/window. Embedded `<script>` tags in the fetched fragment are stripped (never executed via `innerHTML` anyway; the full page's own `<details>` elements are correct natively without it). Heading levels in the injected fragment are demoted by one (h1→h2 etc.) so they nest correctly under the pane's own heading instead of producing a competing `<h1>` (axe-core heading-order). A "back to summary" button returns to the compact view; a fetch failure shows a clear inline error instead of a blank pane. Scoped entirely to `MapExplorerV2.astro` — `MapExplorer.astro` (`/map`) has no equivalent control and is untouched. Updated `tests/e2e/map2.spec.ts`'s full-page test to assert no new tab/window opens (`context.pages().length` unchanged) and that content unique to the full page (its "Todas las relaciones" section) appears inside `#map2-inspector-content`.

Verification: `npm run validate` (133/183/0 errors, unchanged), `npm run typecheck` (0 errors), clean build (398 pages), `npx vitest run --coverage` (279/279, 100% line/branch/func/stmt), `npx playwright test --workers=1` (80/80), `map2.spec.ts` re-run standalone (22/22, stable), `tests/a11y/` (26/26, zero axe-core violations), `/map`/`MapExplorer.astro`/`palette.ts` mtimes unchanged from session baseline, port 4321 clean.

### `/map2` inspector silently under-reporting real relations (2026-09-07, eighth follow-up)

User report, comparing the inspector pane against `/es/entity/datacite-metadata-schema/`: the standalone page correctly shows 5 real incoming `implements` relations (dataverse, figshare, invenio-rdm, pangaea, zenodo — confirmed in `src/content/entities/*.md`), but the map2 pane only showed 3. Root cause: `src/lib/map/curated.ts`'s `filterToEntitySet` (correctly, for the canvas/layout) trims each node's `outgoing`/`incoming` down to curated-set-only targets; the inspector was reading that same trimmed data instead of the entity's true full relation set, so any relation to a real entity outside the curated 33 (`invenio-rdm`, `pangaea` aren't in `CORE_ENTITY_IDS`) silently vanished with no indication.

Fixed in `src/components/MapExplorerV2.astro` only — `curated.ts` and its contract are untouched, since the canvas/layout genuinely must only ever see curated-to-curated edges. `allNodes`'s full, untrimmed relation lists (computed before `filterToEntitySet` runs) are now additionally attached to each surviving curated node as `fullOutgoing`/`fullIncoming`, each `RelationRef` tagged `inSet: boolean` against the curated id set. The single-selection inspector (`renderSingleInspector`) now reads `fullOutgoing`/`fullIncoming` instead of the canvas-trimmed `outgoing`/`incoming` (which stay untouched for everything else — isolated-node detection, multi-select shared-neighbour classification — those must stay about canvas neighbours, not real-world totals). `relationPill()` keeps its existing clickable-select behaviour for `inSet: true` refs; a new `relationLinkOut()` renders `inSet: false` refs as a plain, real `<a href="/[locale]/entity/[id]/">` link (not a fake selectable button) with a small "not shown on this map" / "no está en este mapa" badge, so the relation reads as real rather than broken or dropped.

`datacite-metadata-schema`'s incoming count now reads 5 (was 3), matching the full page; InvenioRDM and PANGAEA appear as linked-out, non-selectable entries. New Playwright test in `tests/e2e/map2.spec.ts` pins this exact case. Gates: validate 133/183/0 errors (content unchanged) · typecheck 0 errors · build 398 pages · vitest 279/279, 100% coverage · playwright 80/80, `map2.spec.ts` re-run standalone twice (22/22 both) · axe-core 0 violations `/map2` both locales (part of the full suite) · `/map`, `MapExplorer.astro`, `palette.ts` mtimes unchanged · port 4321 clean.

One bug found and fixed along the way: the new `notOnMapLabel` i18n string was added to the `strings.es`/`strings.en` source objects but initially missed from `panelI18n` (an explicit allow-list object serialized into the client payload, not a spread) — the badge silently rendered with no text/empty until this was added there too.

### `/map2` row-cohesion granularity fix (2026-09-07, seventh follow-up)

User report after the previous ordering fix: "DOI appears at upper level
inside the node, but handle system orcid id, ROR are far away (They should
be together!!)". Root cause in `src/lib/map/hierarchy.ts`'s `computeRanks`:
the prior fix collapsed a same-`(tier,type)` group onto one shared row
UNLESS any internal above-edge existed anywhere in the group — but that
condition opted the ENTIRE group out, so DOI<->Handle System's real,
deliberate split (a genuine `depends-on` hierarchy fact) also dragged ORCID
and ROR — which have no edge to either of them, or to each other — off the
shared row along with it. Fixed with union-find: only members in a
connected component of size >1 (i.e. actually linked by a real internal
edge) stay split at their own computed depths; every other same-type member
("singleton") still collapses onto one shared mode depth, computed only
across the singletons so an unrelated connected pair can't skew it.

Verified live (Playwright + `window.__cyMap2`): `handle-system`, `orcid`,
`ror` now render on the same row (y=0); `doi` correctly stays on its own,
higher row (y=-342) per the real `doi depends-on handle-system` edge. Added
a new corpus-driven unit test (`hierarchy.test.ts`) asserting this specific
invariant directly — the previous generic test ("some internal edge exists
somewhere in the group") was too weak to have caught this bug, since it was
trivially satisfied by the old buggy whole-group-opt-out behaviour too.

`src/components/MapExplorer.astro` (`/map`) does not import
`src/lib/map/hierarchy.ts` at all — confirmed via grep — so this fix is
map2-only in practice even though the file isn't under a `map2/` path.
`/map`, `MapExplorer.astro`, `palette.ts` mtimes confirmed unchanged.

Gates: typecheck 0 errors · vitest 279/279 (100% stmt/branch/func/line
coverage) · build 398 pages · playwright 79/79, `map2.spec.ts` re-run
standalone (21/21) for flakiness · port 4321 clean after.

Also investigated (not yet fixed) a separate report on the same pane: the
inspector's rendered content for `datacite-metadata-schema` is structurally
complete (description, tags, grouped relations with notes, extra fields,
sources, dates, links) but (a) the description sits collapsed behind a
plain `<details>` with no visual weight above the surrounding link-like
elements (relation pills' `↗` icons, source links, raw-JSON/open-full-page
links), which plausibly reads as "just some links" at a glance, and (b) the
pane's incoming-relations list showed only 3 entries for an entity the full
page's own header reports as having 5 incoming relationships — a real data
gap in what `renderSingleInspector` receives or displays, not a rendering
question. Left for a follow-up fix.

### `/map2` inspector content parity + wider resize range (2026-09-07, sixth follow-up)

User compared the inline inspector pane against the standalone
`/[locale]/entity/[id]/` page for the same entity and found it wasn't
equivalent content, just a thin subset ("what appears there is not the same
content shown on the pane"), plus asked for "more liberty" resizing the pane
(hard-clamped 280-640px before this pass). Scoped to `/map2` only
(`MapExplorerV2.astro`) — `/map`, `MapExplorer.astro`, and shared
`palette.ts` confirmed byte-identical (mtime check before/after).

Content added to `renderSingleInspector` (previously badges + one-line
summary + a flat list of every relation + type-specific fields + sources —
now brought to real parity with the full page, everything except the
Mermaid diagram itself, which the map2 canvas already provides):
- Standard-tier full description (`prose.body`), in a collapsible `<details>`
  (was: nowhere — only the one-line Simple summary was ever reachable).
- "Also known as" (`aka`).
- Facets: tags/disciplines/geography (tags was carried but unused; the
  other two weren't even on the node payload).
- Last-reviewed date.
- Fallback/untranslated-locale notice + `lang` attribute (mirrors the full
  page's `resolveProse().fallback` handling, previously discarded).
- Raw JSON export link (`/entity/{id}.json`).
- Per-relation `since` date, shown on the pill when present (previously
  dropped before it reached the client).
- Relation notes as visible text on the pill, not just a `title` hover
  tooltip (was inaccessible to keyboard/touch users).
- Source notes (previously dropped from the `SourceRef` payload).
- Relations grouped by predicate with outgoing/incoming count headers,
  mirroring `RelationTable.astro`'s structure — was a flat, undifferentiated
  outgoing-then-incoming list.

Resize range: `INSPECTOR_WIDTH_MIN`/`MAX` were a static 280-640px in three
places (HTML `aria-value*`, JS constants). Min raised slightly to 300px (the
richer content above needs a bit more room to stay readable); the static max
is gone — replaced by `effectiveInspectorMax()`, computed from the real
`.map2-body`/layers-panel widths at drag/keyboard-resize/window-resize time,
capped at 1100px, and always leaving >=320px for the canvas column so the
inspector can never crowd it to nothing. `aria-valuemax` updates live to
match. Verified via a live resize past the old 640px ceiling to 723px at a
1400px viewport (dynamic cap computed 1040px, canvas retained 637px).

Verification: `npm run validate` unchanged (133 entities, 183 edges, 0
errors — code-only change); `npm run typecheck` clean; full rebuild (398
pages); `npx vitest run --coverage` 278/278, 100% line/branch/func/stmt
coverage (unchanged from before — no new pure-module logic was added, all
new code lives in `MapExplorerV2.astro`'s client script); `npx playwright
test` 79/79, `tests/e2e/map2.spec.ts` re-run twice standalone (21/21 both,
no flakiness); axe-core zero violations on `/map2`, both locales; `/map`
files' mtimes unchanged; port 4321 left clean.

### `/map2` real hover-dim fix, real row cohesion (2026-09-07, fifth follow-up)

User re-tested the fourth follow-up below and reported two of its four fixes
weren't actually right: "1) when I pass the mouse over a card, it makes all
cards grey, but the one hovering is also greyed... 2) still not really
ordered. I mean, I have mixed colors in order (should be all in the same
row)." Also asked directly (answered in-conversation, no code change): "how
easy is to modify each entity so I can add or edit connections... change
category, description, details" — answer: as easy as editing the relevant
`.md` frontmatter (`relations:`/`category`/etc. fields) plus its i18n prose
file, then `npm run validate`; no code changes needed for content edits.
Scoped to `/map2` only (`MapExplorerV2.astro`, `hierarchy.ts`,
`tests/e2e/map2.spec.ts`, `tests/unit/map/hierarchy.test.ts`) — `/map`,
`MapExplorer.astro`, and shared `palette.ts` confirmed byte-identical
(mtime check before/after).

**Bug 1 root cause — compound-ancestor opacity, not the highlight logic.**
The fourth follow-up's hover fix genuinely fixed the *logic* (right node gets
`.highlighted`, the rest `.dimmed`) but missed that the graph is compound:
every entity node is a child of one of 4 `tier-band` parent nodes. Cytoscape
computes a compound child's RENDERED opacity as its own opacity times every
ancestor's (`effectiveOpacity()`), and `node.closedNeighborhood()` never
includes a node's own compound ancestor — so `cy.elements().difference(...)`
always put all 4 tier-bands on the dimmed side, including whichever band the
hovered node itself lives in, dragging every node's effective opacity down to
0.12 regardless of its own `.highlighted` class. Reproduced live via the
existing `window.__cyMap2` debug hook before touching code (measured
`effectiveOpacity() === 0.12` on the hovered node itself). Fixed by excluding
`.tier-band` from the dimmable set in both `highlight()`/`clearHighlight()`
(`cy.elements().not('.tier-band')`). The existing hover Playwright test
already asserted `numericStyle('opacity')` (a node's OWN opacity, which was
already 1 even during the bug) — that's why it passed while the bug was
still live; extended it to also assert `effectiveOpacity()` and
`tierBandDimmed === 0`, the two checks that actually catch this class of bug.

**Bug 2 root cause — two separate layout bugs, both fixed.**

1. *Row assignment ignored type.* `computeRanks`'s `depth` (hence
   `composite = tier*100+depth`, the row key) is a pure graph longest-path
   metric with zero awareness of `type` — two same-type, same-tier nodes
   (e.g. Crossref/DataCite, both `agency`) can land on different rows purely
   by incidental distance from an unrelated depth-0 anchor, even with no
   edge between them. Fixed: after depth is computed, nodes are grouped by
   `(tier, type)`; a group with no real "above" edge connecting two of its
   OWN members gets snapped onto its most-common depth (mode), so it renders
   as one row. A group WITH a real internal above-edge (DOI `depends-on`
   Handle System, both `identifier`) is deliberately left split — that's a
   genuine, previously-verified hierarchy fact this diagram exists to show,
   not incidental scatter. Tiebreak decision: mode (not mean) of the
   group's existing depths, so the row lands where the majority already is
   rather than at a synthetic rounded average that might not match any real
   member.
2. *The `maxPerRow` wrap cut through type blocks.* Even after fix 1, a
   composite row with more members than `maxPerRow` (5) wrapped into
   sub-rows by mechanically slicing the type-sorted id list every 5 entries
   — cutting straight through a block whenever the row's total count wasn't
   a multiple of 5 (the real corpus case: cris(1)+identifier(3)+index(4)+
   repository(2) = 10 members on one row, sliced into a 5/5 split that
   separated the index and repository blocks). Fixed: `computeLayout` now
   packs contiguous same-type runs into sub-rows greedily, only ever
   splitting a run against ITSELF when the run alone outgrows one full row
   (consecutive full-width sub-rows of that one type), never mixing an
   arbitrary cut point with a different type.

New/extended tests: `hierarchy.test.ts` gets a same-type-group depth-cohesion
test, a does-NOT-collapse-a-real-internal-edge test, a data-driven test
against the real `/map2` curated corpus (33 entities) asserting every
`(tier,type)` group with 2+ members shares one composite unless a real
internal above-edge justifies a split, and a wrap-boundary test pinning that
no type is split across sub-rows. `map2.spec.ts`'s hover test now checks
`effectiveOpacity()`/`tierBandDimmed` as above. Also hardened an unrelated
test fragility found while chasing a flaky failure: 3 `page.evaluate(() =>
cy.zoom(n))` calls in the LOD regression test implicitly returned the whole
Cytoscape core instance (`.zoom()` returns `this` for chaining) — Playwright
serializing that large circular native object back over CDP was observed to
hang the call outright under load; changed to block-bodied arrows that
discard the return value.

Verification: `npm run validate` (133 entities, 183 edges, 0 errors,
unchanged — code-only fix), `npm run typecheck` (0 errors), clean
`rm -rf dist .astro node_modules/.astro && npm run build` (398 pages),
`npx vitest run --coverage` (278/278, 100% line/branch/func/stmt),
`npx playwright test --workers=1` (79/79), `map2.spec.ts` re-run twice more
alone for flakiness (21/21 both times, stable), axe-core zero violations on
`/map2` both locales, `/map` files' mtimes unchanged, port 4321 clean after.

### `/map2` spacing, hover, ordering, inline record (2026-09-07, fourth follow-up)

User feedback after the 4-tier/Handle-System/curated-set pass (see below):
"nodes should not touch between them... when hovering over a card, is not
highlighted (everything is grayed)... order cards by color, then by
sub-type... not sure if the full record should be a full isolated page; can
be displayed inside the record tab (that should allow the user for
resizing)." All four fixed, scoped to `/map2` (`MapExplorerV2.astro`,
`hierarchy.ts`, `tests/e2e/map2.spec.ts`, `tests/unit/map/hierarchy.test.ts`)
— `/map`, `MapExplorer.astro`, and shared `palette.ts` confirmed untouched
(mtime check, same as every prior `/map2`-only pass).

**1 — Real minimum spacing, not just non-overlap.** `hierarchy.ts`'s
`DEFAULT_LAYOUT_OPTIONS` previously chose a bare-minimum gutter (rowSpacing
85, colSpacing 190 — 5px/14px over the 80px/176px box) specifically to chase
a higher fit-to-viewport zoom under the old "the default view must show the
whole graph" assumption. Retuned to rowSpacing 114 / colSpacing 220 / tierGap
32 (a real 34px/44px gutter) — freed to do this by fix #4 below, which
decouples "legible default zoom" from "fits everything at once". New unit
test (`hierarchy.test.ts`) asserts the gutter is ≥12px, not just >0.

**2 — Hover highlight was logically correct but visually imperceptible.**
Reproduced directly before touching any code (a throwaway repro script, not
guessed): the right node got `.highlighted` (opacity 1) and the rest got
`.dimmed` (opacity 0.12) at every zoom level tested, including the corpus's
real default (which, before fix #4, opened in 14x14px dot mode — opacity 1
vs 0.12 on a ~3px-wide dot is imperceptible regardless of correctness). Fixed
two ways: (a) fix #4 makes the default view open in legible class-box mode,
where the opacity difference is obvious; (b) added a border-width bump on
`.highlighted` nodes as a redundant safety net independent of zoom level.

**3 — Nodes ordered by type (colour), then subtype.** `computeXSlots` in
`hierarchy.ts` previously ordered a row's nodes purely by barycentre
(crossing-minimisation). Rewritten to group same-`type` nodes into one
contiguous block per row first (blocks themselves still ordered by their own
barycentre, so cross-row alignment isn't lost), then order within a block by
`subtype`, then `id`. New unit tests assert both the contiguous-block
property (with a fixture using two same-tier-but-different-colour types,
since the naive first attempt picked two DIFFERENT-tier types by mistake and
silently tested nothing) and the subtype-ordering property.

**4 — Default view no longer shrinks to fit the whole graph.** New
`MIN_DEFAULT_ZOOM`/`resetView()` in `MapExplorerV2.astro`: a naive `cy.fit()`
for this corpus's real row count (worse after fix #1's larger gutters) landed
at ~0.21 — well below the class-box legibility threshold (0.4) — so the
graph opened in illegible dot mode by default, which is also the direct
cause of fix #2's symptom. Floors the initial/reset zoom instead of always
fitting everything; panning covers the rest. The floor itself (0.45, not a
first-attempt 0.75) was chosen by direct measurement, not guessed: 0.4-0.5 all
show ~16 of 33 nodes at this canvas's real size, while 0.75 dropped that to
~5 of 33 — the floor exists to fix the one concrete legibility problem, not
to maximise zoom for its own sake. Two pre-existing tests that had assumed
"every node visible / DOI on-screen by default" were updated: one now checks
the actual regression it was meant to guard (Cytoscape's internal
width/height matching the container's real DOM rect) instead of node
visibility; the drag-capability test now explicitly centres its target node
first, since "is it on-screen by default" is an unrelated, intentional
design question this session settled separately.

**5 — Inline, resizable full record (was: navigate to `/entity/[id]`).**
Payload extended with each entity's `sources` and a generic `extraFields`
list (every type-specific schema field beyond what's already shown as
badges, extracted generically rather than hand-enumerating each of the 12
types — excludes the common `EntityBase` keys and the entity's own subtype
field). The Inspector's single-selection view now renders both inline
(a `<dl>` for fields, a linked list for sources) instead of only
name/badges/summary/relations. The old "Ver ficha completa" navigate-away
link is now a secondary "Abrir página completa ↗" link that opens the
standalone entity page in a new tab (`target="_blank"`), so it doesn't
discard the map's current pan/zoom/selection. The panel itself gained a drag
handle on its left edge (`role="separator"`, full `aria-valuenow`/min/max —
missing on the first pass, caught by the axe-core a11y suite as an
`aria-required-attr` violation and fixed before this pass was called done),
keyboard-resizable too (arrow keys), width persisted for the session via
`sessionStorage` (not a durable preference).

**Verification, all clean:** `npm run validate` 133 entities/183 edges/0
errors (unchanged, presentation-only); `npm run build` 398 pages; `npm run
typecheck` 0 errors; `npx vitest run --coverage` 273/273, 100% coverage
maintained; `npx playwright test --workers=1` 79/79, run twice with no
flakiness. `/map`'s own file mtimes confirmed unchanged throughout.

### `/map2` 4-tier hierarchy, Handle System edges, +6 curated entities (2026-09-06, third follow-up)

User feedback after the tier-bands/overlap fix (see below): "FAIR is in the
same category as OAI-PMH... FAIR are principles, not standards, is another
level. Handle system is only related to DOI, but relation is broader...
we need to add more node boxes." An Opus evaluation (read-only) diagnosed
both as real, distinct gaps and this pass fixes them, scoped to `/map2`
except where noted:

**Task 1 — 4-tier hierarchy, `/map2`-only.** `computeTier(type, subtype?)` in
`src/lib/map/hierarchy.ts` now consults each `standard` entity's own
`standardKind` (`principles`/`governance-criteria` → new top tier T4;
`protocol`/`metadata-schema`/`serialisation`/`certification-criteria`/
`framework` → T3) and each `coalition`'s `coalitionKind` (`declaration` → T4;
the other three kinds → T2), instead of grouping every `standard`/`coalition`
into one tier regardless of what it actually is. The subtype field already
existed and was already correctly populated on all 18 real `standard`
entities in the corpus — the tier function just never read it (confirmed by
a new data-driven test in `hierarchy.test.ts` that reads every real
`type: standard` entity's `standardKind` from `src/content/entities/*.md` at
test time and asserts it lands in the tier the report's classification
table predicts, rather than trusting a hand-copied list). FAIR and OAI-PMH
now land in different tiers/bands. `MapExplorerV2.astro`'s two `computeTier`
call sites now pass the node's `subtype`; a 4th tier label
("Principios y políticas"/"Principles and policies") was added alongside
the existing 3, and the old T3 label was renamed from "Principios y
estándares" to "Estándares y especificaciones" now that principles have
their own tier.

**Task 2 — Handle System breadth (content, shared with `/map` — approved
scope-break).** Added 4 real, sourced `depends-on → handle-system` edges:
`dspace` (assigns Handles natively, real prefix required for external
resolution), `dataverse` (PID provider config supports `hdl` alongside
DataCite/EZID/PermaLink — also added `handle-system` to its
`persistentIdScheme` list), `datacite` (operates its own Handle server
infrastructure), `crossref` (registers DOI-to-URL mappings into the Global
Handle Registry). Also noted, on `doi.md`'s existing `governed-by →
international-doi-foundation` edge, that IDF is itself a credentialed
Multi-Primary Administrator of the Global Handle Registry alongside CNRI —
DOI is a governed application of Handle, not a separate technology.
Deliberately did NOT add `ark depends-on handle-system` — verified false
(ARK's resolution is independent of Handle). `npm run validate`: 133
entities (unchanged), 179→183 edges, 0 errors.

**Task 3 — +6 curated entities on `/map2`.** Added `dona-foundation`,
`international-doi-foundation`, `force11`, `ourresearch`, `trust-principles`,
`coretrustseal` to `CORE_ENTITY_IDS` (`src/pages/[locale]/map2/index.astro`)
— each verified to connect into the existing 27-entity set via a real,
already-authored edge (no floaters): DONA↔handle-system, IDF↔doi,
FORCE11↔fair, OurResearch↔openalex, and the TRUST→CoreTrustSeal→Zenodo
chain, which gives the new T4 tier a second real worked example alongside
FAIR. Curated set: 27→33 entities, 0 isolated nodes (checked directly
against the built page's graph payload).

**Two more real bugs found and fixed along the way, both via direct tracing
against the built page rather than assumption:**

- **Node-overflow / undraggable-node bug.** Growing the curated set to 33
  entities across 13 tier-depth rows (up from 9) exposed a pre-existing
  container-size race: at the exact moment `cytoscape({...})` constructs,
  `cy.height()` read **574px** — the container's true, settled height is
  **424px**. The `layout: { fit: true }` option computed its zoom/pan
  against that inflated reading, leaving real nodes (e.g. the row DOI sits
  in) rendered below the container's actual bottom edge —
  `document.elementFromPoint` at that node's own `renderedPosition()`
  returned `null`, and dragging it did nothing because there was nothing
  there to grab. A `requestAnimationFrame`-deferred re-fit only closed part
  of the gap; the real fix was moving the one-time initial re-fit into the
  existing `ResizeObserver`'s first callback, which is spec-guaranteed to
  fire once immediately with the container's true current size. New
  regression test: every node's `renderedBoundingBox()` must sit inside
  `[0, cy.width()] × [0, cy.height()]` at load.
- **The LOD threshold's history was measured against the same bug.** Once
  genuinely fixed, this corpus's honest fit-zoom is **~0.28-0.30**, not the
  ~0.40-0.48 recorded by every earlier tuning pass (including the original
  27-entity/3-tier version) — all of those were "verified against the built
  page" using the same inflated 574px container reading. Spacing was tried
  down to a bare, gutter-free minimum (rowSpacing 82/tierGap 10) and barely
  moved the number (0.279 → 0.295): 13 rows of a fixed 80px-tall box do not
  fit above 0.4 in a ~344px-tall usable canvas at any reasonable spacing.
  Rather than chasing 0.4 by cramming boxes together, spacing was set back
  to a comfortable real gutter (rowSpacing 85, tierGap 20) and the page's
  honest default view at this density is dot mode, upgrading to full
  class-boxes the moment the user zooms in past the (unchanged, correct as
  a legibility bar) 0.4 threshold — a real, working degradation path, not a
  regression. `LOD_ZOOM_THRESHOLD`'s comment and the zoom-cycle regression
  test were both corrected to reflect this rather than assert a number the
  corpus's real row count can't reach.

**Verification, all clean:** `npm run validate` 133 entities/183 edges/0
errors/67 warnings; `npm run typecheck` 0 errors; `npm run build` 398 pages;
`npx vitest run --coverage` 270/270, 100% on the graph/invariants coverage
gate; `npx playwright test --workers=1` 74/74 (16 in `map2.spec.ts` alone,
re-run 3× with no flakiness), including axe-core clean on `/map2` both
locales. `/map`, `MapExplorer.astro`, and shared `palette.ts` confirmed
untouched (same file mtimes as before this pass).

### `/map2` rebuilt — Opus evaluation follow-up (2026-09-06)

User feedback on the 2026-09-04 `/map2` (see below): "navigation is very
bulking... not simple, not easy, not clarifying anything... figures are
messy arranged, space is small, I can't search for a concept... too many
scroll bars... I need hierarchy here... top level to bottom, like concepts,
institutions to instruments... icons are messy... some colors too similar".
An Opus evaluation pass (read-only, no code changes) diagnosed 9 specific
problems and proposed fixes; this pass implements all of them, **scoped to
`/map2` only** per explicit instruction ("map 2 only, so we can test it") —
`/map` is completely unchanged (confirmed: `MapExplorer.astro` and
`map/index.astro` have the same file hashes/mtimes as before this pass).

**Scoping decision**: rather than adding a dozen new props to the existing
1900-line `MapExplorer.astro` (the originally-sketched approach), built a
genuinely separate component, `src/components/MapExplorerV2.astro`, used
only by `/map2`. This guarantees zero regression risk to `/map` (no shared
file was touched at all) at the cost of some duplicated markup/CSS between
the two components — a deliberate tradeoff given the explicit "test map2 in
isolation first" framing. If these changes are later approved for `/map`
too, promoting them means either merging `MapExplorerV2` back into
`MapExplorer` behind props, or simply pointing `/map`'s route at
`MapExplorerV2` once its data-scope (`entityIds` undefined = whole corpus)
and `crossLinkHref`/`Label` props are wired the same way `/map2`'s wrapper
already does it.

**Stage 0 — viewport/interaction bugs** (root-cause bugs per the report, not
design opinions):
- Real app-shell layout: `Base.astro` gained an opt-in `appShell` prop
  (`body.app-shell` CSS, additive-only — every other page omits it and is
  unaffected) so `/map2`'s `<main>` becomes a flex region filling the
  viewport with no page-level scroll, replacing the old `100vw` breakout +
  `82vh`-tall canvas row that produced both a horizontal scrollbar (100vw
  includes the scrollbar gutter) and a vertical one (chrome height + 82vh
  routinely exceeded the viewport). Regression-tested:
  `tests/e2e/map2.spec.ts`'s "no horizontal or vertical page-level scroll"
  test asserts `scrollWidth <= clientWidth` and `scrollHeight <= clientHeight`
  at a standard 1280×800 viewport.
- `wheelSensitivity` back to Cytoscape's normal rate (was `0.25`, a 4x
  slowdown); zoom-button steps tightened to ×1.25/×0.8 (was ×1.3).
- `ResizeObserver` on the canvas container calling `cy.resize()` — collapsing
  a panel now actually grows the canvas instead of leaving Cytoscape's
  renderer with stale dimensions.
- Cytoscape shape fix: `subroutine` (agency's Mermaid shape) no longer
  folds into the same `'rectangle'` as `rect` (institutional-system) — given
  `'cut-rectangle'` so DataCite/Crossref read as a different box shape than
  Zenodo/Dataverse even before the class-box LOD kicks in.
- `owned-by` edges now actually render with `width: 3` (the predicate vocab
  already said `line: thick`; the old code only ever checked for `dashed`
  vs `solid` and silently ignored `thick`).
- Localised subtype labels: new `src/lib/model/subtype-labels.ts` (an
  `{es, en}` label for every `*Kind` enum value in `model/types.ts`) —
  the old `humanizeSubtype` was explicitly documented as un-localised, so
  the Spanish-locale map showed the English word "Bibliographic" on
  OpenAlex/Scopus/Dimensions, which is very plausibly why "Índice ·
  Bibliographic" read as unclear ("or do you mean a search index?").
- Search restored: an input + results list built from the in-page
  `map2-graph-data` payload (no network fetch needed at ~27 nodes — the old
  `/map2` fetched nothing because `simple` gated the request entirely, per
  the prior pass's since-revised "search is clutter at this scale" call).

**Stage 1 — chrome diet**: Layers panel starts collapsed to its rail on
load (still fully expandable/keyboard-reachable — this is not a removal);
Inspector has no "here's what will appear" placeholder bullets, just stays
empty until a selection; the 5-state colour key stays hidden until the
first selection; onboarding trimmed to 2 lines; the type/layer legend moved
from below-the-shell document flow into a small collapsed overlay in the
canvas's bottom-left corner.

**Stage 2 — hierarchical layout, replacing `fcose`'s layer bands**: new
pure module `src/lib/map/hierarchy.ts` — `computeTier(type)` (a 3-level
abstraction grouping: T3 policy/coalition/standard, T2
community/organization/agency, T1 identifier/index/repository/cris/
aggregator/publishing-platform) and `computeRanks` (longest-path depth over
a directed "is above" relation derived per-predicate from
`vocab/predicates.yaml`'s own real-world meaning — e.g. `operated-by`'s
target is above its source, `depends-on`'s source is above its target — with
an explicit, tested rule for the one place two predicates disagree on the
same pair: a target-higher predicate wins over a source-higher one). Fed
into Cytoscape as `layout: 'preset'` positions (`computeXSlots` gives a
deterministic within-row ordering via a barycentre sweep) — nodes stay fully
draggable afterward, this only changes the initial arrangement. Verified
against the real curated-set data (not just synthetic fixtures) in
`tests/unit/map/hierarchy.test.ts` and `tests/e2e/map2.spec.ts`'s "DataCite
above DOI, DOI above Handle System" test.

This exposed a real content gap: FAIR, COAR and DSpace were floating
disconnected inside `/map2`'s curated subset (0 edges to any other curated
entity) even though the full 133-entity corpus has real, sourced edges for
each of them — they just pointed at entities `/map2` didn't include. Fixed
by extending the curated set (`src/pages/[locale]/map2/index.astro`'s
`CORE_ENTITY_IDS`, 24 → 27) with `unesco-recommendation-open-science`
(already `mandates → fair` in the full corpus), `coar-notify` (already
`developed-by → coar`), and `oai-pmh` (already `implements`-target of
zenodo/dataverse/dspace alike — a nice bonus: selecting any two of those
three now highlights oai-pmh as `state-shared`, demonstrated in a new e2e
test). Also researched and added one genuinely new edge:
`dataverse complies-with fair` (dataverse.org's own features page lists FAIR
support as a top platform feature — https://dataverse.org/book/data-reuse,
verified 2026-09-06) — the full corpus's `complies-with → fair` count was
otherwise a single edge (from `fairsharing`), which is real but was outside
the curated set. Zero isolated nodes remain within `/map2`'s 27-entity
subset (confirmed via the built graph payload post-build).

**Stage 3 — class-box node rendering**: new pure module
`src/lib/map/node-svg.ts` (`renderClassBoxSvg`/`classBoxDataUri`) generates
a small ER/class-box-style SVG per node at render time — a coloured title
bar (entity name), an italic stereotype line (localised type · subtype),
and up to 4 field rows (governance, status) — set as the Cytoscape node's
`background-image`. Zoom-dependent level of detail: below zoom 0.75, nodes
render as a small coloured dot (the old encoding); at or above it, the full
class box. Skipped HTML-in-node approaches entirely (breaks `cy.png()`
export, causes pan/zoom jank) per the evaluation report's explicit
recommendation.

**Stage 4 — map2-only palette override**: new
`src/lib/map/palette-overrides.ts` recolours `community`'s fill to `#bf3989`
(a magenta, picked by exhaustively checking CIEDE2000 + protanopia/
deuteranopia-simulated distance against every other type colour actually
rendered on `/map2`) — the shared `mermaid/palette.ts` used by `/map` and
every Mermaid diagram sitewide is untouched. Fixes two measured collisions:
`repository` vs `community` (ΔE 3.3 in normal vision — same blue at small
size) and `standard` vs `community` (ΔE 1.9 under protanopia, plus both
share the Cytoscape hexagon shape). New
`src/lib/map/color-distance.ts` (sRGB→Lab→CIEDE2000, plus a standard
Viénot-1999-style CVD simulation matrix) backs a regression test in
`tests/unit/map/palette-overrides.test.ts`. Two OTHER pre-existing
collisions the base palette already had (`index`/`policy` ΔE 7.9,
`repository`/`standard` ΔE 17.1) are explicitly left alone — they're
corpus-wide issues unrelated to this override, and the evaluation report
itself sequenced a full 12-type palette repaint as a separate, later,
holistic task, not something to solve piecemeal inside one type's map2-only
override.

**Honest residual gaps, unchanged from the prior pass**: Cytoscape still
renders every node to a single `<canvas>`, so individual canvas nodes have
no native per-node keyboard focus — the Layers panel's real `<button>` list
remains the keyboard/screen-reader path through the graph (now collapsed by
default but still fully expandable/tabbable), and `/entities` remains the
independent no-JS equivalent. The on-canvas hover tooltip is still mouse-only
for the same reason.

Verification (all against `/map2` only; `/map` re-verified unchanged):
`npm run validate` 133 entities/179 edges/0 errors (was 178 edges before
this pass's one content edit); `npm run build` 398 pages; `npm run
typecheck` 0 errors; `npx vitest run --coverage` 256/256 passing (was 215),
graph/invariants still 100% (the coverage *threshold gate* is scoped to
`src/lib/graph`+`src/lib/invariants` only — `src/lib/map/*` has always sat
outside it, same as before this pass); `npx playwright test --workers=1`
67/67 passing (was 63), including a rewritten `tests/e2e/map2.spec.ts` (9
tests, replacing assertions written against the prior shared-`MapExplorer`
implementation) and axe-core zero-violations on `/es/map2/` and `/en/map2/`.

### `/map2` layout/legibility/crash fixes (2026-09-06 follow-up)

User tested the pass above and reported it made things worse, not better:
"entities are really far away, need to zoom a lot, scroll to zoom in/out
still too much; text is inside figures and cannot be read (too small)...
seems to work well when i havent touch or pan trough the map, but once you
do it it make text only inside the figures and illegible". Three real bugs,
all scoped to `/map2`/`hierarchy.ts` only — `/map` untouched (confirmed via
mtimes, unchanged):

1. **Layout bloat (~20x).** `positionFor` multiplied the raw `composite`
   value (`tier*100+depth` — designed only as an ordering key) directly by
   `ROW_SPACING` as a literal row count. The curated set only ever produces
   9 distinct rows, but they were spread across composite values 100-304,
   producing an 18,360px-tall layout for content that needs ~800-900px —
   forcing the initial fit zoom down to ~0.03-0.1 (clamped by `minZoom`).
   Fixed with a new `computeLayout()` in `hierarchy.ts` that ranks rows by
   their DENSE sorted position among composites actually present (not the
   raw value), with an explicit `tierGap` inserted only at real tier
   boundaries. Also added row-wrapping (`maxPerRow`): a single crowded rank
   (10 T1 instruments sharing a depth) was then the binding width
   constraint — wrapping it into stacked sub-rows brought the initial fit
   zoom from ~0.39 to ~0.66 (aspect ratio 2.21:1 → 1.14:1). A first attempt
   at this fix shipped with the row-ranking direction inverted (sorted
   descending instead of ascending), which silently flipped the entire
   hierarchy upside-down — caught by strengthening a unit test that had
   only checked the *magnitude* of the row gap, not its *direction*, and
   passed either way; both are covered by regression tests in
   `tests/unit/map/hierarchy.test.ts` now.
2. **Excessive zoom scrolling** — not a separate bug; entirely downstream of
   #1. `wheelSensitivity: 1` (normal rate) was already correctly set; a
   sane-sized layout was the actual fix.
3. **Text illegible after any pan/zoom (the "works fine until you touch
   it" bug).** `applyLod()`'s zoom-out branch inline-set a node's
   `width`/`height` to the 14px dot size via `n.style(...)`; the zoom-in
   branch only re-applied `width`/`height`/`background-image` the FIRST
   time a node's class-box was generated, gated behind the same cache used
   for the (legitimately-reusable) expensive SVG string. After the first
   zoom-out/zoom-in cycle, `width`/`height` stayed stuck at 14px while the
   176px-wide class-box background image remained attached —
   `background-fit: contain` then squeezed the whole box, and all its
   baked-in text, into a 14x14px square. Fixing this by simply re-applying
   width/height/background-image on every 'zoom' event (for every node,
   every tick) reintroduced a worse problem: Cytoscape fires 'zoom'
   synchronously and continuously (many times per second during a
   wheel/drag gesture), and running that many-node `n.style(...)` mutation
   reentrantly on the same call stack as Cytoscape's own zoom dispatch
   reliably **crashed the browser tab** under this environment's software
   rasterizer — reproduced deterministically via Playwright (`Target
   crashed` on the very first `cy.zoom(...)` call), isolated by bisecting
   test variants until confirmed the crash disappeared the moment the
   'zoom' handler was disabled entirely. Final fix: track LOD state
   per-node (`boxApplied`) so the style mutation only runs on an actual
   dot↔box *transition*, and defer that mutation to the next animation
   frame (`requestAnimationFrame`, coalescing any 'zoom' events that fire
   before the frame runs) instead of running it synchronously inside
   Cytoscape's own event dispatch. Regression-tested in
   `tests/e2e/map2.spec.ts` by driving `window.__cyMap2.zoom(...)` directly
   through a zoom-out/zoom-in cycle and asserting the node's rendered
   width/height/background-image is restored exactly, not stuck at the dot
   size — a static-load-only test would not have caught this.

Verification: `npm run validate` unchanged (133 entities/179 edges/0
errors); `npm run typecheck` 0 errors; `npm run build` 398 pages; `npx
vitest run --coverage` 261/261 (was 256), 100% on the graph/invariants gate;
`npx playwright test --workers=1` 68/68 (was 67), including the new crash
regression test passing reliably across repeated runs (previously
deterministic 3/3 failure before the fix). `/map`/`MapExplorer.astro`
re-confirmed untouched.

### `/map2` node overlap + tier bands (2026-09-06 second follow-up)

User tested again: "still a little messy, some cards are on top of others
and no clear division between roles is present. Before, we have like a
zone with the name of the variables (a big rectangle, with the entities
inside it) — that could help to sort this a little better." Two fixes,
still scoped to `/map2`/`hierarchy.ts`/`node-svg.ts` only — `/map`,
`MapExplorer.astro`, and shared `palette.ts` re-confirmed untouched (mtimes
unchanged from before this pass).

1. **Node overlap.** `classBoxFields()` always returns exactly 2 rows
   (governance + status), so `classBoxHeight(2)` — a node's real rendered
   height — is a *constant* 80px for every node on `/map2`. The renderer's
   `ROW_SPACING` was `70`, smaller than that constant by construction, so
   every row's boxes overlapped the next row's by ~10px regardless of node
   count. Fixed by moving the four layout constants out of the renderer's
   inline declarations into a new exported `DEFAULT_LAYOUT_OPTIONS` in
   `hierarchy.ts` (single source of truth shared with this module's own
   tests, so the row gap can't silently drift smaller than the box height
   again unnoticed) with `rowSpacing: 95` (>80, a real gutter). `node-svg.ts`
   now exports `CLASS_BOX_WIDTH` for the same reason on the horizontal axis
   (already correctly clear at colSpacing 190 vs width 176, verified rather
   than assumed). New regression coverage in `hierarchy.test.ts`: a
   dense/row-wrapping synthetic fixture and a fixture shaped like the real
   27-node curated set, both asserting zero pairwise bounding-box overlap
   using the actual production spacing and box dimensions.

   Raising the row gap to fix the overlap unavoidably makes the layout
   taller, which dropped the initial fit zoom from ~0.66 to ~0.48 — measured
   directly against the built page (not assumed), and confirmed *not*
   fixable by retuning `maxPerRow` (tried 8 and 12; neither reduces the
   corpus's real 9 distinct tier/depth rows, and 12 makes the width-vs-height
   tradeoff strictly worse). `LOD_ZOOM_THRESHOLD` lowered `0.6 → 0.4` (with
   headroom below the measured ~0.48) so class-boxes stay the *default* view
   on load rather than silently regressing to dot-mode — the LOD
   dot↔box-transition logic itself (and its animation-frame-deferred,
   crash-safe mutation from the previous fix) is untouched.

2. **Tier/role bands restored.** Reused `/map`'s existing compound-node
   technique (there grouped by taxonomy `layer`; here by the new `tier`
   concept) as 3 labelled Cytoscape compound parents — "Principios y
   estándares" / "Instituciones y agencias" / "Instrumentos y sistemas" (es;
   English equivalents) — with member nodes as children (`parent:
   tierNodeId(computeTier(n.type))`). Band size/position is entirely derived
   from already-positioned children (Cytoscape's automatic compound-parent
   sizing) — no explicit dimensions set, avoiding the fcose
   pin-the-parent crash `/map` hit earlier this session; `preset` layout
   never touches parents in the first place, so this was simpler here than
   on `/map`. Delegated 'node' event handlers (tap-to-select,
   hover-to-highlight, hover-tooltip) explicitly skip `.tier-band` targets —
   a band's own background is a real tappable/hoverable node too, and
   without the guard, clicking a band's empty area registered a bogus
   "selected entity" with an id like `__tier-1`.

Verification: `npm run validate` unchanged (133/179/0 errors); `npm run
typecheck` 0 errors; `npm run build` 398 pages; `npx vitest run --coverage`
263/263 (was 261), 100% on the graph/invariants gate; `npx playwright test
--workers=1` 71/71 (was 68, +3: band containment, tap-on-band-is-a-no-op,
node-still-draggable), re-run 3 times total (full suite + `map2.spec.ts`
twice more) with no flakiness. `/map`/`MapExplorer.astro`/`palette.ts`
re-confirmed untouched via mtime comparison.

### `/map2` — a curated "essential concepts" view (2026-09-04)

After the content audit, `/map` grew from 107 to 133 entities and 178 edges
— accurate, but "too much" for a first-time visitor's first look. Added
`/{loc}/map2`, the same explorer restricted to a fixed, hand-picked ~20-24
entity subset (identifiers, registration agencies, indices, the commercial-
ownership chain, and the standards/communities the memo leans on most —
`src/pages/[locale]/map2/index.astro`'s `CORE_ENTITY_IDS`), plus small
simplifications appropriate at that scale: search-as-you-type,
facet-filtering and Focus mode are dropped (`MapExplorer`'s `simple` prop) —
the layer panel alone is enough to browse ~20 nodes.

Refactored the whole 3-panel explorer (data-serialization, Cytoscape/layer/
inspector/keyboard wiring, styles) out of `map/index.astro` into a shared
`src/components/MapExplorer.astro`, parameterized by `entityIds` (curated
subset vs. whole corpus), `simple`, a per-variant onboarding `localStorage`
key, and cross-link props — `/map` and `/map2` are now both thin route
wrappers and automatically stay in sync for anything that isn't data-scope.
New pure helper `src/lib/map/curated.ts` (`filterToEntitySet`) drops any
edge whose endpoint falls outside the curated set rather than rendering a
dangling half-edge; unit-tested in `tests/unit/map/curated.test.ts`.

Each map now links to the other (`/map`'s lead paragraph gets a "Prefer a
simpler view?" link to `/map2`; `/map2` links back to the full map) and both
carry independent onboarding-dismissal state. Nav gained a "Conceptos
esenciales"/"Essential concepts" entry next to "Map". `/map2` added to the
§9.3 axe-core route set (zero violations, both locales) and covered by
`tests/e2e/map2.spec.ts`.

### `/map` rebuilt as a 3-panel explorer (2026-09-04)

Opus content/UI review (this session) flagged that `/map` was "a canvas with
a toolbar" — informative once you already knew the domain, but not a way in
for someone who didn't. Rebuilt around a full-viewport 3-region shell
(`src/pages/[locale]/map/index.astro`): a left **Layers** panel making the
memo's own four-layer model (plus regional and cross-cutting) the literal,
navigable shape of the page — one `<details>` per layer, in memo order
bottom-to-top, each grouped by type with a subtype badge (finally *using*
Stage 1's `repositoryKind`-style fields, not just carrying them); the
**canvas**, now with layer bands rendered as real Cytoscape compound nodes
instead of a flat cloud; and a right **Inspector** panel that replaces
click-to-navigate — selecting a node (canvas, layer panel, or search) shows
its full record in place, relations as clickable pills, with a `↗` link for
people who do want the full entity page.

Added: multi-select with a 5-state highlight (selected / upstream /
downstream / shared / dimmed) — selecting two entities highlights what they
have in common, a direct, explorable demonstration of the vertical-
integration thesis rather than an assertion in prose; Focus mode per
specs.md §6.6 verbatim (N-hop neighbourhood, everything else dimmed to 15%,
1/2/3-hop control); search-as-you-type over the already-built, previously
unused `/search-index-{locale}.json`, with a "no relations recorded" badge
on results (surfaces the content-audit gaps directly in the UI rather than
hiding them); facet-chip filtering by layer/type/governance/tag with URL
query-state round-tripping (`?layer=...&sel=...`), closing a §6.6
requirement ("every view linkable") that was never implemented; both side
panels collapse to a ~40px rail. New pure/unit-tested logic lives in
`src/lib/map/{url-state,facets,search-score,graph-state}.ts` (29 new vitest
cases) rather than inline in the page script.

**Compound-node layout, honestly**: fcose's `fixedNodeConstraint` is the
documented way to pin specific nodes while letting the rest self-organise —
the natural first attempt was pinning each layer band's *compound parent*
node to a fixed vertical slot. That broke immediately (`RangeError: Invalid
array length` inside fcose's internal repulsion grid) because a compound
parent's position/dimensions are derived from its children, and fixing it
directly before layout produces a NaN bounding box. Fix: pin one real leaf
node per layer instead (concrete width/height from the start) and let the
compound parents follow their children. Verified automatically, not just
eyeballed — a Playwright test (`layer bands render in memo order, bottom to
top`) asserts each layer's average node Y position follows the memo's stack
order, with a small tolerance for the two adjacent layers (regional,
cross-cutting) that land closest together.

**Residual gaps, same shape as before**: Cytoscape still renders to one
`<canvas>`, so individual nodes have no native keyboard focus or per-node
screen-reader access — the layer panel's entity list (real `<button>`s,
natural tab order, `aria-label`s with name/type/layer) is this page's own
keyboard/screen-reader path through the graph, not a workaround bolted on
after the fact; `/entities` remains the fully independent no-JS/JS-off
equivalent per A9.5. The on-canvas hover tooltip stays mouse-only for the
same underlying reason. axe-core is clean on `/es/map/` and `/en/map/`
(zero violations) with the new panel structure, including a target-size fix
for the layer `<summary>` elements the redesign introduced (had shrunk
below the 24×24 CSS px / 24px-clearance floor).

Verification: `npm run validate` (133 entities, 178 edges, 0 errors, 67
warnings — unchanged, this pass is presentation-only), `npm run build` (396
pages), `npx vitest run --coverage` (209/209, 100% line/branch/func/stmt on
the gated paths), `npx playwright test --workers=1` (56/56).

### Content audit — Stage 1 schema fix + 4 remediation waves (2026-09-03/04)

Prompted by the user flagging real classification/relation gaps (Zenodo
typed identically to Dataverse despite one being a hosted service and the
other self-hosted software; ROR shown connected only to DataCite despite
being tri-founded with Crossref and the California Digital Library). An
Opus review confirmed this was systemic, not two isolated cases: of 107
entities, 45 had zero outgoing relations, the corpus split into 23 weakly-
connected components, and 9 of 19 predicates had ≤2 edges anywhere — because
Phase 5's batch authoring worked from condensed spec excerpts against 1-2
sibling files, never live primary sources, with an explicit "omit the
relation if the target doesn't exist yet" escape hatch that silently
dropped true facts.

**Stage 1 (schema, code-only)**: widened `operated-by`/`developed-by`'s
range and `governed-by`'s range further to include `agency`/`aggregator`
(true facts like "ROR operated by DataCite" were previously unauthorable —
`agency` wasn't a legal range); added a narrow, explicit `crossTypePairs`
escape hatch to `interoperates-with`'s `sameTypeOnly` rule for real
cris↔index and index↔publishing-platform integrations. Surfaced the
already-correct-but-invisible subtype fields (`repositoryKind` etc., via
`src/lib/model/subtypes.ts`) in `/map`, `/taxonomy`, and `/entities/[type]`.
Added relation-level `verified: {date, url}` provenance and three new
WARN-level invariants: **I32** (governance-predicate edges should carry a
verification stamp), **I33** (a completeness floor — repository/index/
aggregator/publishing-platform/standard entities should have at least one
governance-shaped edge), **I34** (a heuristic: if an entity's own note text
names another entity by its exact name and no edge connects them, warn — a
cheap check that immediately caught the ROR→Crossref and Zenodo→InvenioRDM
gaps, since both were already stated in prose and simply never authored as
edges).

**Waves 1–4 (content, real web research per entity, not bulk import)**:
W1 hub repair (~20 highest-connectivity entities — doi, ror, orcid,
crossref, datacite, zenodo, openaire, posi, dspace, dataverse, arxiv,
wikidata, dublin-core, etc.); W2 component/isolation repair (19→6 weakly-
connected components, 7→1 remaining `isolated:true` entity, each with a
real specific reason rather than the batch-authoring era's copy-pasted "will
connect later" note); W3 predicate-first sweep (every entity checked against
each of 9 governance-shaped predicates in turn, catching truncated multi-
target facts like POSI's adopter list and confirming the four vertical-
integration `interoperates-with` pairs Stage 1's range widening had just
unblocked: Pure↔Web of Science, Converis↔Web of Science, Esploro↔Web of
Science, Symplectic Elements↔Dimensions); W4 missing named organisations
(SCOSS, DORA, CoARA, Invest in Open Infrastructure, the European Commission,
UNAM — all named in specs.md's own Appendix A examples but never created;
ICSTI researched and deliberately *not* created — active, but no specific
citable connection to any existing entity was found, so it was left out
rather than forced in as an orphan or a guessed edge).

One real-world fact caught mid-audit: arXiv spun out from Cornell as an
independent nonprofit on 2026-07-01, during W1 — the old Cornell
`operated-by`/`funded-by` edges were dated `until: "2026-06"` rather than
deleted, and Simons Foundation / Schmidt Sciences added as its new funders.

Net effect: 107→133 entities (+26, each with ≥1 real sourced edge, none
created as orphans), 101→178 edges (+77), corpus warnings 87→67. Every wave
kept `npm run validate` at 0 errors and the full build/test suite green
before moving to the next; the 26 new entities and every edited relation
carry real `sources`/`accessed` citations, not placeholders.

Automated: `npx playwright test` — 36 tests, axe-core (WCAG 2.2 AA tags)
across the full §9.3 route set in both locales plus the untranslated-fallback
page, the A9.1 diagram/table-pairing check, a no-JS smoke pass across 6
representative routes, and keyboard-operability checks (tab order, focus
visibility, skip link). All 36 pass; 0 axe violations.

Found and fixed during this pass:
- **`/es/` and `/en/` didn't exist** — no `[locale]/index.astro` had ever
  been built, so the header logo link and the language gateway both landed
  on the 404 page. Added a real per-locale home page.
- **Target-size (2.5.8)**: plain-text links inside list pages (entity
  indexes, the language gateway) had a ~16-22px clickable height, below the
  24px minimum. Added a site-wide `main ul/ol li a` sizing rule.
- **Colourblind hue collision**: `policy` and `organization` shared the
  hexagon shape (both cross-cutting layer) and a near-identical gold/orange
  fill — indistinguishable under protanopia/deuteranopia by shape+colour
  alone. Moved `policy` to a teal hue (contrast-checked: 4.86:1 white /
  4.33:1 black).
- **No visible focus indicator** anywhere except the skip link. Added a
  global `:focus-visible` outline (5.19:1 against white).
- **Diagrams had no dark-mode contrast story** — Mermaid's default theme
  targets a light background, unverified against a dark page. Pinned every
  diagram to a fixed white background rather than shipping an unaudited
  dark palette.
- **No keyboard pan/zoom equivalent** for diagram scroll regions (§9.2
  2.5.7/2.5.8) — added `tabindex="0"` so a focused diagram is
  arrow-key-scrollable without a drag gesture (there's no custom drag
  interaction to begin with at the Mermaid-only `/map` tier, so this is the
  complete fix, not a partial one pending Cytoscape).
- Added the ≤5KB progressive-enhancement script for the §7.1 detail-level
  toggle (persists Standard/Technical expansion via `localStorage`); nested
  `<details>` was already fully correct without it.
- Wired the `/entity/[id].json` export link into the entity page's
  Technical section (a one-line fix once Phase 6 built the route; flagged
  as a TODO since Phase 3, missed until this audit).

**Manual keyboard/screen-reader pass** (specs.md §9.3 — stays manual, not
fully automatable): traced full keyboard tab order on the entity page,
`/map`, and `/views/[id]` using Playwright's automated tab-order/focus
checks above as a mechanical proxy for most of what a manual pass verifies;
did not operate an actual screen reader (NVDA/VoiceOver) in this session —
that remains an outstanding manual step before any real release, not
something this automated sweep replaces. Recommend running it before the
first public deploy.

**Known residual gaps, not fixed in this pass:**
- Dark-theme parity is incomplete beyond the diagram-background pin above —
  `Base.astro` uses `Canvas`/`CanvasText` (which do adapt) but several
  chrome colours (`--border`, `--muted-fg`) are fixed hex values that won't
  invert. Not a regression (no page claimed full dark-mode support before
  this pass), but worth a dedicated pass if dark mode becomes a real
  requirement rather than an incidental `color-scheme: light dark` hint.
- Real screen-reader narration (NVDA/VoiceOver) has not been performed —
  see above.

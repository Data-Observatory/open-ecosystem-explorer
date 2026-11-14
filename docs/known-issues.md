# Known issues

Ready-to-paste GitHub issue drafts. The repository has no git remote yet, so none of these has been opened; when it does, create one issue per `##` heading below (title, suggested labels, body). Status checks marked "observed" were made on 2026-11-13 with a plain `curl` and a browser-like user agent, from one network; a 403 or 429 there does not by itself prove a page is gone.

Suggested labels: `sources`, `content`, `unverified`, `modelling`, `i18n`, `deferred`.

Contents

1. Dead or blocked sources to re-verify
2. Unverified wording
3. Modelling debts
4. Deferred work
5. Further known items from `CHANGELOG.md` and `specs.md`

---

## 1. Dead or blocked sources to re-verify

### 1.1 Replace the dead COAR roadmap URL in `opendoar.yaml`

Labels: `sources`, `content`

`src/content/entities/opendoar.yaml` cites, as its second source and as the basis of the `member-of` COAR edge note ("COAR and Jisc released a joint roadmap for OpenDOAR's transition..."):

`https://coar-repositories.org/news-updates/new-roadmap-lays-out-path-for-opendoar-as-an-international-community-driven-repository-directory/`

Observed: HTTP 404 on 2026-11-13. The COAR site has since reorganised (current top-level pages are `/news-updates/`, `/what-we-do/`, `/tools-and-resources/`, `/about-coar/`; OpenDOAR now appears as the "COAR International Repository Directory" under `/tools-and-resources/coar-international-repository-directory/`).

To do:
- Find the current URL of the roadmap announcement (or an archived copy, citing the original as well) and re-check that it supports "joint COAR and Jisc roadmap" and "international, community-governed".
- Check whether OpenDOAR's `operated-by: jisc` edge and the entity `note` ("being separated out of the merged Sherpa services as of 2026") are still accurate now that the directory is presented under COAR.
- Update `accessed` dates and `lastReviewed`.

### 1.2 `v2.sherpa.ac.uk/opendoar` returns 403 to bots

Labels: `sources`

`opendoar.yaml` uses `https://v2.sherpa.ac.uk/opendoar/` as both its entity `url` and a source. Observed: HTTP 403 to automated requests on 2026-11-13. The claims it supports were checked by hand on 2026-09-04 only.

To do: re-verify in a browser and record which claim each page supports; consider whether the canonical URL should move to the COAR directory page if the Sherpa host is retired.

### 1.3 ror.org returned 429 to the fetcher

Labels: `sources`, `unverified`

`https://ror.org/about/` and `https://ror.org/about/faqs/` are cited by `ror.yaml` (three `operated-by` edges with `verified.url: https://ror.org/about/`, and a FAQ source). Observed: HTTP 429 on 2026-11-13, so the pages could not be re-read in the last pass. In practice the ROR claims currently rest on the `ror-community/ror-schema` repository and the DataCite metadata schema documentation (used for the `related-to: metadata` edge).

To do: re-read `ror.org/about` in a browser or after rate limits lift and confirm: DataCite, Crossref and California Digital Library as operating partners; Crossref handling financial administration; SCOSS funding; CC0 data. Update `verified.date` on those edges.

### 1.4 `web.archive.org` snapshot used as the `sherpa-romeo` entity URL

Labels: `sources`, `content`

`src/content/entities/sherpa-romeo.yaml` has `url: https://web.archive.org/web/20241101000000*/v2.sherpa.ac.uk/romeo/`. That is a wildcard Wayback calendar URL, not a snapshot of the page, and it points at an archive rather than the entity. The only source cited is `https://openpolicyfinder.jisc.ac.uk/` (observed 200).

To do: replace with a dated Wayback snapshot of the last live Sherpa Romeo page (or a Jisc statement of the 4 Nov 2024 merge) and keep the Open Policy Finder source for the merge date.

### 1.5 Figshare `operated-by` cites a Digital Science portfolio page that no longer works

Labels: `sources`, `content`

`src/content/entities/figshare.yaml`: the `operated-by: digital-science` edge ("Operated directly by Digital Science as one of its portfolio brands") has `verified.url: https://www.digital-science.com/portfolio/`. The page was reported dead; today a plain `curl` got HTTP 403 (may be bot blocking or a removed page, not distinguished). The only entity source is `https://knowledge.figshare.com/` (also 403 to `curl`).

To do: find a first-party statement that Figshare is operated by Digital Science (for example the Digital Science brand pages or a Figshare "about" page) and update `verified.url`. specs.md Appendix A.4 records the ownership as confirmed using a Digital Science press release (`https://www.digital-science.com/press-releases/digital-science-appoints-stephen-leicht-as-ceo/`, already cited by `dimensions.yaml`); check whether it names Figshare, or find a page that does.

### 1.6 Dimensions `operated-by` now rests on Wikipedia only

Labels: `sources`, `content`

`src/content/entities/dimensions.yaml`: `operated-by: digital-science` has `verified.url: https://en.wikipedia.org/wiki/Dimensions_(database)` and the note records that the former Digital Science portfolio page was unreachable. A governance edge (I32) should cite a primary source.

To do: cite a first-party source (for example dimensions.ai, which presents Dimensions as a Digital Science solution and is already in the entity sources, or a Digital Science page) as `verified.url`.

### 1.7 Membership edges to check by hand (Jisc, Oxford, Lyrasis, CDL)

Labels: `sources`, `unverified`

The sites behind these memberships block scripted requests, so they could not be re-read automatically and need a manual check in a browser:
- `jisc.yaml`: `member-of` CoARA (`https://www.coara.org/coalition/membership/`) and COAR (`https://coar-repositories.org/members/`).
- `university-of-oxford.yaml`: `member-of` W3C (`https://www.w3.org/membership/list/`).
- `lyrasis.yaml` and `california-digital-library.yaml`: `member-of` DataCite, which rest on DataCite's provider API and a Wikidata statement and have no `verified` record.

To do: confirm each listing, then set or refresh `verified.date` and `verified.url`.

---

## 2. Unverified wording

### 2.1 LA Referencia: "eleven countries plus Spain" and "more than five million records"

Labels: `unverified`, `content`, `i18n`

Appears in `src/content/entities/la-referencia.yaml` (`note`; `memberCountries` lists AR, BR, CL, CO, MX, PE, UY, ES, which is eight codes, not twelve), `src/content/i18n/en/la-referencia.yaml` (summary: "eleven Latin American countries plus Spain"; body: "more than five million metadata records") and the ES file. The record count is attributed in the entity sources to the InfraFinder listing; the country count has no stated source (the note cites the memo, `[M§6]`).

To do: check the current member list on `lareferencia.info`, reconcile `memberCountries` with the prose, and re-date the record count or replace it with a range or "millions of records" if it cannot be sourced.

### 2.2 Digital Commons "sits alongside Pure and Interfolio under the same parent"

Labels: `unverified`, `content`

`src/content/i18n/en/digital-commons.yaml` (and ES) says Digital Commons sits alongside Pure and Interfolio under the same parent. specs.md A.4 records that Elsevier owns bepress/Digital Commons (2017) and Interfolio (2022) and Pure; the entity file itself only sources the bepress acquisition (Scholarly Kitchen 2017) and Wikipedia.

To do: add a first-party or trade-press source for Interfolio's current ownership and for Pure being an Elsevier product, or reword to what the entity sources support.

### 2.3 Zenodo CoreTrustSeal status

Labels: `unverified`, `content`

`zenodo.yaml` carries no `certifications` field and no `certified-by` edge, so the graph currently makes no claim. The memo and commentary may suggest a certification status that has not been checked.

To do: check the CoreTrustSeal assessed-repositories list (and Zenodo's own statements) and either add `certifications: [coretrustseal]` plus a `certified-by: coretrustseal` edge with a source, or record in a note that none was found.

### 2.4 arXiv as an early OAI-PMH implementer

Labels: `unverified`

`arxiv.yaml` (`implements: oai-pmh`) and the EN/ES prose state that arXiv exposes its metadata through OAI-PMH and that claims it was an early implementer, or that the protocol grew out of its harvesting needs, are unverified. The edge itself is sourced only by the general arXiv pages.

To do: find the arXiv OAI-PMH documentation page for the edge, and either source or drop the early-implementer discussion (the Open Archives Initiative history pages are the likely primary source).

### 2.5 RedCLARA and LA Referencia arrangement

Labels: `unverified`, `content`

`la-referencia.yaml` has `operated-by: redclara` with the note "Runs on technical/organisational agreements with RedCLARA's regional network (not confirmed by a first-party source)"; `verified.url` is `https://redclara.net/en/somos`. The `redclara` prose says the exact arrangement is not documented in the cited sources.

To do: find a first-party statement of the arrangement (agreement, project page, governance document) or downgrade the edge (`confidence: reported`, or a `related-to`/collaboration wording) and tell readers it is unconfirmed.

### 2.6 IS4OA / DOAJ transition status

Labels: `unverified`

`doaj.yaml` has an `operated-by: is4oa` edge with `until: "2026"` and the note "per doaj.org/about it operates until mid-2026 (transition end); closure unconfirmed at 2026-11-12". Sources: `https://doaj.org/about/` and the March 2025 DOAJ blog post on the move to the DOAJ Foundation.

To do: confirm whether the IS4OA transition has ended and with what date, then set `until` to a full date (`YYYY-MM`), and check `is4oa.yaml`'s own status.

---

## 3. Modelling debts

### 3.1 Gendered Spanish participle predicate labels need neutral forms

Labels: `modelling`, `i18n`

`src/content/vocab/predicates.yaml` has Spanish labels that inflect for grammatical gender: `gobernado por`, `operado por`, `desarrollado por`, `financiado por`, `certificado por`, and also `respaldado por`, `indexado por`, `implementado por`, `cumplido por`, `emitido por`, `reemplazado por`, `exigido por`, `sujeto a`. They are shown next to any subject (an organisation, a policy, a standard, a concept), so the masculine form is inaccurate for feminine subjects ("la política ... gobernado por").

To do: choose neutral forms (for example nominal or impersonal phrasing such as "gobernanza a cargo de", "operación a cargo de", "desarrollo a cargo de", "financiación de", "certificación de", or phrasing by predicate family) and check them against all sentence templates (entity page, map card, Mermaid labels, story text). Update `specs.md` A.2 and the tests that assert labels.

### 3.2 Crossref and DataCite as CoARA members

Labels: `modelling`, `unverified`

The only `member-of: coara` edge in the graph is from `openaire` (verified against the CoARA membership page). Crossref and DataCite are plausible signatories of the Agreement on Reforming Research Assessment but no `member-of` edge exists and the graph makes no claim.

To do: check the CoARA signatories page for Crossref and DataCite, and add sourced `member-of: coara` edges if listed (checking I-rules on `member-of` domain and range first).

### 3.3 arXiv layer

Labels: `modelling`

`arxiv.yaml` is typed `publishing-platform` (`platformKind: preprint-server`) while `specs.md` (A.1 appendix examples, around lines 734 and 774) lists arXiv as a `repository` ("institutional-system"). The spec and the data disagree.

To do: decide the type (a preprint server fits `publishing-platform`, but arXiv is also a deposit-and-preservation service), then align `specs.md`, the entity and the layer-grouped views.

### 3.4 Sherpa Romeo / Open Policy Finder merge

Labels: `modelling`

The two are kept as separate entities (`sherpa-romeo` is `status: superseded`; `open-policy-finder` has `supersedes: sherpa-romeo`). Merging them into one entity with a `since` date would leave `supersedes` with zero edges, which I12 rejects, so the superseded record is kept as a historical node. Juliet and Fact, also folded into Open Policy Finder, are not modelled.

To do: revisit if another real `supersedes` pair appears, or record the Sherpa history in a `note` on one entity and drop the historical node.

### 3.5 ORCID-CRIS and ROR-CRIS edges are unsourced

Labels: `modelling`, `sources`

None of the five CRIS entities (`pure`, `converis`, `esploro`, `symplectic-elements`, `interfolio`) has a relation to `orcid` or `ror`, although CRIS products are widely documented to support both. The edges are left out only because no source has been checked.

To do: find first-party documentation for each product (for example ORCID member listings or vendor pages), then add `interoperates-with` or `depends-on` edges with `sources`.

### 3.6 ILDA dropped from the scope expansion

Labels: `modelling`, `unverified`

The Latin American Open Data Initiative (ILDA, Uruguay) was drafted as an entity and then dropped: its legal form, founding year and the regional Barometer could not be confirmed on a readable first-party page, and it would have had one outgoing edge. The Carpentries was also left out (training, not infrastructure). arXiv-type items are not affected by this decision.

To do: revisit if a Latin American open-data actor is wanted; re-check `ilda.la` for legal form, founding year and the Barometer first.

### 3.7 I33 and I34 warnings added by the scope expansion

Labels: `modelling`, `content`

`codemeta`, `citation-file-format` and `datos-gob-cl` have no governing or developing organisation entity (I33): the CodeMeta community and the CFF supporters are not organisations in the graph, and there is no entity for Chile's Ministerio de Hacienda. Separately, I34 now flags existing notes that name SPDX or Creative Commons (`core`, `gbif`, `openaire`, `zenodo`, `wikidata`) because those entities now exist.

To do: add a Ministerio de Hacienda organisation if it is in scope; reword the SPDX notes (for example "licence identifier") or accept the heuristic warnings.

---

## 4. Deferred work

### 4.1 Fault-line analyses ("Líneas de falla")

Labels: `deferred`

Decided 2026-11-12 (`specs.md` section 12, Q12, partly open): the critical views `vertical-integration`, `cost-of-exit`, `open-content-closed-governance` and `index-coverage` stay out of the newcomer path: they are not linked from the home page or the map, only from the Preguntas page (`/{loc}/views/`), under the guided stories. To be revisited once the concept layer and glossary have been in use, as an expert-mode section of the map.

To do: decide whether the views also get an expert-mode link on the map, and re-check the views' queries against the current graph.

---

## 5. Further known items from `CHANGELOG.md` and `specs.md`

### 5.1 Open smaller items

Labels: `unverified`, `content`, `deferred`

- **re3data licence.** `re3data.yaml` note: "Codebase is open source; exact licence not verified in this pass."
- **CERIF status.** `cerif.yaml` note: CERIF-Core "has not been approved as the official standard yet" as of 2026-11-12; earlier wording that classic CERIF is no longer developed "could not be verified and was removed". Re-check on euroCRIS.
- **Converis end of life.** specs.md A.4: no announcement was found, so none is recorded; commentary on a Converis/Esploro merger is not modelled.
- **OpenDOAR operator.** `opendoar.yaml` note: operator relationship "recorded as historical/current best-known, may need revisiting" (see 1.1).
- **Deployment target and custom domain.** specs.md Q7: local only, no deployment target for now; custom domain and per-PR previews are marked as requiring confirmation.
- **Discipline vocabulary.** specs.md A.3: `vocab/disciplines.yaml` (OECD FORD level 2) is marked as requiring confirmation.
- **`REQUIRE_FULL_I18N`.** Off by default (`src/lib/invariants/config.ts`); a missing locale prose file is one aggregated warning rather than an error.
- **Layout generation.** The committed `src/generated/graph-layout.json` must be regenerated (`npm run layout:generate`) after any edge or entity change; `npm run layout:check` fails when it is stale. As of the "label separation always converges" fix the overlap guarantee no longer depends on the particular edge set.

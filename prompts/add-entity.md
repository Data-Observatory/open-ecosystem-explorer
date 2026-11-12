# Add an entity

Add `<name>` to this repository as an entity.

Read first: `specs.md` §5.1–5.2 (fields per type), `specs.md` A.2 (the 21 predicates, with domain and range), `src/content/vocab/*.yaml` (closed vocabularies — do not invent terms), and two existing files of the same `type` as models.

Then: create `src/content/entities/<id>.yaml` with the facts and outgoing relations only, and `src/content/i18n/es/<id>.yaml` with `summary` and `body` prose (`en` too if you can source it). Author relations in the canonical direction only; if a target entity does not exist, either add it in the same change or omit the relation. Every entity needs ≥1 `sources` entry with a real URL and today's `accessed` date — do not cite the memo for an external fact, cite the thing itself.

Optional `prominence: core | extended | detail` (default `extended`) controls progressive disclosure; set `core` only for the handful of nodes a newcomer must see first. A new idea or term (persistent identifier, open access, metadata, ...) is a `concept` (13th type; `governance: not-applicable`, `url` = its reference page, no type-specific fields): link concrete things to it with `is-a` (any type -> concept; concept -> concept for subtypes; acyclic; only when the thing genuinely *is a kind of* the concept) or `related-to` (symmetric, any type -> concept, max 3 per node, always with a short `note` saying how; use it when the thing operates, practises or addresses the idea without being a kind of it), and write the concept's own relations in the same direction. Prose: an optional `localNote` (<=30 words) carries a Chile/LatAm-specific fact about a global concept; definitions stay neutral. Provide both `es` and `en` files — a missing locale is a WARN today and an ERROR once `REQUIRE_FULL_I18N` is switched on (`src/lib/invariants/config.ts`; preview with `REQUIRE_FULL_I18N=1 npm run validate`).

Finally: run `npm run validate` and fix every ERROR before stopping. Report the WARN lines rather than suppressing them. Do not add a vocabulary term (that is a separate PR, C6), and do not edit any other entity's file to add the inverse relation.

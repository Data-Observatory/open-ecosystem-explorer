# Add an entity

Add `<name>` to this repository as an entity.

Read first: `specs.md` §5.1–5.2 (fields per type), `specs.md` A.2 (the 19 predicates, with domain and range), `src/content/vocab/*.yaml` (closed vocabularies — do not invent terms), and two existing files of the same `type` as models.

Then: create `src/content/entities/<id>.yaml` with the facts and outgoing relations only, and `src/content/i18n/es/<id>.yaml` with `summary` and `body` prose (`en` too if you can source it). Author relations in the canonical direction only; if a target entity does not exist, either add it in the same change or omit the relation. Every entity needs ≥1 `sources` entry with a real URL and today's `accessed` date — do not cite the memo for an external fact, cite the thing itself.

Finally: run `npm run validate` and fix every ERROR before stopping. Report the WARN lines rather than suppressing them. Do not add a vocabulary term (that is a separate PR, C6), and do not edit any other entity's file to add the inverse relation.

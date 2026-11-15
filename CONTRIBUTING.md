# Contributing

The content of this site (entities, relations, translations, stories) is plain YAML in `src/content/`, checked by a Zod schema and a set of graph invariants every time you run `npm run validate` and every time you build. A change is good when the validator passes and a person can tell from the diff that it is true, sourced and in scope.

## Suggest a change without editing files

Open an issue at https://github.com/Data-Observatory/open-ecosystem-explorer/issues/new/choose and pick the form that fits. The forms are in English and Spanish.

- **New entry on the map**: an institution, standard, identifier, infrastructure or concept that is missing.
- **Connection between two entries**: add, change or remove one line on the map (how entry A relates to entry B, from the list of 21 kinds of connection).
- **Description or facts of an entry**: the short description, the longer text, the name, a fact in the table, the note for Chile and Latin America, a translation, a source or link, or where it appears on the map.
- **Remove an entry**: it does not belong, is a duplicate, is not true or no longer exists.
- **Bug or accessibility problem** and **Idea or feature**: about the site itself, not the content of the map.

Every entry page has two links ("Suggest a change to the description or facts" and "Suggest a change to its connections") that open the matching form with that entry filled in, and the footer links to the chooser.

- A maintainer reads the issue, checks the source, and makes the change as a pull request that closes the issue, or answers why not. If in doubt, the change is left out.
- Give a source for what you propose: the organisation's own page or an authoritative register. A proposal without one may wait until one is found.
- Issues are public. Do not include personal data.
- Issues are labelled `new-entry`, `connection`, `description`, `remove-entry`, `bug` and `idea`.

Everything below is for people who prefer to make the change themselves, in a pull request.

## Before you start

You need Node 22 or newer and npm. Run `npm install` once. Run `npx playwright install chromium` only if you also want to run the browser tests.

Read the `specs.md` sections for the part you touch: §3 (curation policy), §5 (data model and invariants) and §8 (authoring format). `docs/known-issues.md` lists what is already known to be unverified, so you do not repeat it.

## Add or change an entity

- For autocomplete and validation while you type, map `schema/entity.schema.json` to `src/content/entities/*.yaml` and `schema/prose.schema.json` to `src/content/i18n/*/*.yaml` in your editor's YAML settings (for example the `yaml.schemas` setting of the `redhat.vscode-yaml` extension). Personal editor settings are not committed (`.vscode/` is ignored).

- An entity is two or three small files, never one big one. Facts and outgoing relations go in `src/content/entities/<id>.yaml`. The filename is the id.
- Prose goes in `src/content/i18n/es/<id>.yaml` and `src/content/i18n/en/<id>.yaml`: a one-sentence `summary` and a short `body`. Both languages are required, and a missing one is a validation error.
- Copy two existing files of the same `type` as models. The closed vocabularies in `src/content/vocab/` (types, predicates, tags, disciplines, statuses) say which values are allowed. Do not invent terms; adding a vocabulary term is a separate change.
- Author each relation once, in the canonical direction, in the file of the subject. The inverse is derived. If the target entity does not exist, add it in the same change or leave the relation out.
- Every entity needs at least one entry in `sources` with a real URL and the date you read it. Cite the organisation's own page or an authoritative register, not a summary of it.
- Descriptions are neutral and descriptive, not evaluative. Chile and Latin America specifics go in an optional `localNote` (30 words at most), never in the definition.
- If in doubt, leave it out. A missing relation costs less than a wrong one.
- Ideas such as open access, metadata or FAIR are entities of type `concept`. Link concrete things to them with `is-a` or `related-to` (with a short `note`), not with the other predicates.
- `prominence` (`core`, `extended` or `detail`) controls what a newcomer sees first. Leave the default unless you have discussed it.

`prompts/add-entity.md` is a ready-made prompt for an LLM agent doing the same job. An agent edits, the validator checks, a person reviews and merges.

## The check loop

Run these after every edit, from the repository root:

- `npm run validate` must end with 0 errors. It takes a few seconds and prints the rule, the file, the field and the fix. Warnings are information; report them, do not hide them.
- `npm run layout:generate` after you add, remove or change a relation or an entity, then commit `src/generated/graph-layout.json`. The build fails (`layout:check`) if it is stale.
- `npm run check`, `npm run lint` and `npm test` before you open a pull request.
- `npm run build` then `npm run test:e2e` when you touch pages or the map. The e2e tests run against the build. Set `PW_PORT` to a free port, and `PLAYWRIGHT_CHROME_PATH` to use a system Chrome.

## Change the site or the UI text

UI strings live in `messages/es.json` and `messages/en.json`. Every key must exist in both. Code under `src/lib/model`, `graph`, `i18n`, `invariants`, `views`, `stories` and `export` must stay free of Svelte and SvelteKit imports. `docs/architecture.md` explains the routes and the map.

## Commits and reviews

- Use conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `style:`) and small, incremental commits: one idea per commit.
- Do not add co-author or tool attribution lines to commit messages.
- The reviewer reads for what the validator cannot see: is the relation true, is the source the right one, is the summary neutral, is the entity in scope.
- `main` is protected: work on a branch and open a pull request. It can be merged only when the CI jobs `test` and `infra` are green and the branch is up to date with `main`; direct pushes are refused, for administrators too. Merging is rebase only (squash and merge commits are off), so every commit of the pull request lands on `main` as you wrote it: keep each commit conventional and incremental, one idea per commit.
- CI (`.github/workflows/ci.yml`) runs the check loop above on every pull request and on every push to `main`.
- Every change merged to `main` is deployed to https://oee.dataobservatory.net by `.github/workflows/deploy.yml` after CI passes on `main`, with no further approval. Merge only what you are ready to publish.
- Analytics, hosting and deployment settings (`static/consent-loader.js`, `infra/`, `.github/workflows/deploy.yml`) are decided by the project owner. Open an issue instead of changing them.

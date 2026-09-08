# Contributing

This project's content (entities, relations, translations) is authored as
version-controlled YAML-frontmatter files, validated at build time against a
Zod schema and a set of graph invariants — see `specs.md` §8 for the full
content authoring format and workflow, and §5 for the data model.

Detailed contribution instructions (file format walkthrough, the
`prompts/add-entity.md` template for LLM-assisted edits, and the PR
checklist) land in a later implementation phase, once the schema and
`npm run validate` exist. For now, read `specs.md` in full before proposing
content changes.

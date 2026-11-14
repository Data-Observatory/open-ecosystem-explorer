#!/usr/bin/env tsx
// Standalone content validator (specs.md §8.4a). Runs the Zod schema and the
// I1-I35 graph invariants against every entity/i18n/view/vocab file, without
// booting the site, so it stays fast enough for an LLM agent to call after every
// edit.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

import {
	zEntity,
	zProseFile,
	zView,
	zViewProseFile,
	zEntityTypesVocab,
	zPredicatesVocab,
	zTagsVocab,
	zDisciplinesVocab,
	zStatusesVocab,
	zPredicateFamiliesVocab
} from '../src/lib/model/schema.js';
import {
	parseEntityTypesVocab,
	parsePredicatesVocab,
	parseSimpleVocab,
	parsePredicateFamiliesVocab
} from '../src/lib/model/vocab.js';
import { resolveRequireFullI18n } from '../src/lib/invariants/config.js';
import { runValidation } from '../src/lib/invariants/run.js';
import type { InvariantMessage } from '../src/lib/invariants/types.js';
import { fmt } from '../src/lib/invariants/types.js';
import { locales, defaultLocale } from '../src/i18n/locales.js';
import type { Entity, EntityId } from '../src/lib/model/types.js';
import type {
	EntityFileEntry,
	ProseFileEntry,
	ViewFileEntry,
	ViewProseFileEntry
} from '../src/lib/invariants/types.js';
import { zStory, type StoryFileEntry } from '../src/lib/stories/schema.js';
import { checkStories } from '../src/lib/stories/check.js';

const ROOT = join(import.meta.dirname, '..');

function listFiles(dir: string, ext: string): string[] {
	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch {
		return [];
	}
	const out: string[] = [];
	for (const entry of entries) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			out.push(...listFiles(full, ext));
		} else if (entry.endsWith(ext)) {
			out.push(full);
		}
	}
	return out.sort();
}

function relPath(full: string): string {
	return relative(ROOT, full).split('\\').join('/');
}

/**
 * Defensive: nothing in the current pipeline produces `Date` instances (the
 * `yaml` package's core schema parses ISO-looking scalars as plain strings),
 * but every date field in this schema is a plain string (so it round-trips
 * through JSON/exports and diffs cleanly) — this is cheap insurance against
 * a future parser/config change silently reintroducing them.
 */
function normalizeDates<T>(value: T): T {
	if (value instanceof Date) {
		return value.toISOString().slice(0, 10) as unknown as T;
	}
	if (Array.isArray(value)) {
		return value.map((v) => normalizeDates(v)) as unknown as T;
	}
	if (value && typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value)) out[k] = normalizeDates(v);
		return out as unknown as T;
	}
	return value;
}

function zodIssuesToMessages(file: string, error: z.ZodError): InvariantMessage[] {
	return error.issues.map((issue) => ({
		level: 'ERROR' as const,
		ruleId: 'SCHEMA',
		file,
		field: issue.path.join('.'),
		value: undefined,
		message: issue.message,
		hint: `Fix the '${issue.path.join('.')}' field per specs.md §5.1-5.2.`
	}));
}

function loadEntities(): {
	entityFiles: EntityFileEntry[];
	entityProseFields: Map<EntityId, string[]>;
	schemaErrors: InvariantMessage[];
} {
	const dir = join(ROOT, 'src/content/entities');
	const files = listFiles(dir, '.yaml');
	const entityFiles: EntityFileEntry[] = [];
	const entityProseFields = new Map<EntityId, string[]>();
	const schemaErrors: InvariantMessage[] = [];

	for (const full of files) {
		const file = relPath(full);
		const raw = readFileSync(full, 'utf-8');
		const data = parseYaml(raw) as Record<string, unknown>;
		const id = full
			.split('/')
			.pop()!
			.replace(/\.yaml$/, '');
		const result = zEntity.safeParse(normalizeDates({ ...data, id }));
		if (!result.success) {
			schemaErrors.push(...zodIssuesToMessages(file, result.error));
			continue;
		}
		const entity = result.data as unknown as Entity;
		entityFiles.push({ id: entity.id, file, entity });
		// Facts files carry no prose (C10, I31): record any prose field found in the raw YAML.
		entityProseFields.set(
			entity.id,
			['body', 'summary', 'description'].filter((key) => key in data)
		);
	}
	return { entityFiles, entityProseFields, schemaErrors };
}

function loadProse(): { proseFiles: ProseFileEntry[]; schemaErrors: InvariantMessage[] } {
	const proseFiles: ProseFileEntry[] = [];
	const schemaErrors: InvariantMessage[] = [];
	for (const { code } of locales) {
		const dir = join(ROOT, 'src/content/i18n', code);
		const files = listFiles(dir, '.yaml').filter((f) => !f.includes(`${join(dir, 'views')}`));
		for (const full of files) {
			const file = relPath(full);
			const raw = readFileSync(full, 'utf-8');
			const data = parseYaml(raw) as Record<string, unknown>;
			const result = zProseFile.safeParse(normalizeDates(data));
			if (!result.success) {
				schemaErrors.push(...zodIssuesToMessages(file, result.error));
				continue;
			}
			const id = full
				.split('/')
				.pop()!
				.replace(/\.yaml$/, '');
			proseFiles.push({ id, locale: code, file, prose: result.data });
		}
	}
	return { proseFiles, schemaErrors };
}

function loadViews(): {
	viewFiles: ViewFileEntry[];
	viewProseFiles: ViewProseFileEntry[];
	schemaErrors: InvariantMessage[];
} {
	const viewFiles: ViewFileEntry[] = [];
	const viewProseFiles: ViewProseFileEntry[] = [];
	const schemaErrors: InvariantMessage[] = [];

	const dir = join(ROOT, 'src/content/views');
	for (const full of listFiles(dir, '.yaml')) {
		const file = relPath(full);
		const raw = readFileSync(full, 'utf-8');
		const data = parseYaml(raw) as Record<string, unknown>;
		const id = full
			.split('/')
			.pop()!
			.replace(/\.yaml$/, '');
		const result = zView.safeParse(normalizeDates({ ...data, id }));
		if (!result.success) {
			schemaErrors.push(...zodIssuesToMessages(file, result.error));
			continue;
		}
		viewFiles.push({ id, file, view: result.data });
	}

	for (const { code } of locales) {
		const vdir = join(ROOT, 'src/content/i18n', code, 'views');
		for (const full of listFiles(vdir, '.yaml')) {
			const file = relPath(full);
			const raw = readFileSync(full, 'utf-8');
			const data = parseYaml(raw) as Record<string, unknown>;
			const result = zViewProseFile.safeParse(normalizeDates(data));
			if (!result.success) {
				schemaErrors.push(...zodIssuesToMessages(file, result.error));
				continue;
			}
			const id = full
				.split('/')
				.pop()!
				.replace(/\.yaml$/, '');
			viewProseFiles.push({ id, locale: code, file, prose: result.data });
		}
	}
	return { viewFiles, viewProseFiles, schemaErrors };
}

function loadStories(): { storyFiles: StoryFileEntry[]; schemaErrors: InvariantMessage[] } {
	const storyFiles: StoryFileEntry[] = [];
	const schemaErrors: InvariantMessage[] = [];
	for (const full of listFiles(join(ROOT, 'src/content/stories'), '.yaml')) {
		const file = relPath(full);
		const data = parseYaml(readFileSync(full, 'utf-8')) as Record<string, unknown>;
		const result = zStory.safeParse(normalizeDates(data));
		if (!result.success) {
			schemaErrors.push(...zodIssuesToMessages(file, result.error));
			continue;
		}
		const id = full
			.split('/')
			.pop()!
			.replace(/\.yaml$/, '');
		storyFiles.push({ id, file, story: result.data });
	}
	return { storyFiles, schemaErrors };
}

function loadVocab() {
	const dir = join(ROOT, 'src/content/vocab');
	const entityTypesRaw = parseYaml(readFileSync(join(dir, 'entity-types.yaml'), 'utf-8'));
	const predicatesRaw = parseYaml(readFileSync(join(dir, 'predicates.yaml'), 'utf-8'));
	const tagsRaw = parseYaml(readFileSync(join(dir, 'tags.yaml'), 'utf-8'));
	const disciplinesRaw = parseYaml(readFileSync(join(dir, 'disciplines.yaml'), 'utf-8'));
	const statusesRaw = parseYaml(readFileSync(join(dir, 'statuses.yaml'), 'utf-8'));
	const familiesRaw = parseYaml(readFileSync(join(dir, 'predicate-families.yaml'), 'utf-8'));

	zEntityTypesVocab.parse(entityTypesRaw);
	zPredicatesVocab.parse(predicatesRaw);
	zTagsVocab.parse(tagsRaw);
	zDisciplinesVocab.parse(disciplinesRaw);
	zStatusesVocab.parse(statusesRaw);
	zPredicateFamiliesVocab.parse(familiesRaw);

	return {
		entityTypesVocab: parseEntityTypesVocab(entityTypesRaw),
		predicatesVocab: parsePredicatesVocab(predicatesRaw),
		tagsVocab: parseSimpleVocab(tagsRaw),
		disciplinesVocab: parseSimpleVocab(disciplinesRaw),
		statusesVocab: parseSimpleVocab(statusesRaw),
		predicateFamiliesVocab: parsePredicateFamiliesVocab(familiesRaw)
	};
}

function main(): void {
	const args = process.argv.slice(2);
	const jsonOutput = args.includes('--json');
	const fileArgIdx = args.indexOf('--file');
	const fileFilter = fileArgIdx >= 0 ? args[fileArgIdx + 1] : undefined;

	const { entityFiles, entityProseFields, schemaErrors: entitySchemaErrors } = loadEntities();
	const { proseFiles, schemaErrors: proseSchemaErrors } = loadProse();
	const { viewFiles, viewProseFiles, schemaErrors: viewSchemaErrors } = loadViews();
	const { storyFiles, schemaErrors: storySchemaErrors } = loadStories();
	const vocab = loadVocab();

	const schemaErrors = [
		...entitySchemaErrors,
		...proseSchemaErrors,
		...viewSchemaErrors,
		...storySchemaErrors
	];

	const result = runValidation({
		entityFiles,
		entityProseFields,
		proseFiles,
		viewFiles,
		viewProseFiles,
		...vocab,
		// REQUIRE_FULL_I18N: see src/lib/invariants/config.ts (env var overrides the constant).
		requireFullI18n: resolveRequireFullI18n(process.env),
		locales: locales.map((l) => l.code),
		defaultLocale
	});

	// Stories (src/lib/stories/check.ts) run against the same index as the I-series.
	let messages = [...schemaErrors, ...result.messages, ...checkStories(storyFiles, result.index)];
	if (fileFilter) {
		messages = messages.filter((m) => m.file === fileFilter || m.file.endsWith(fileFilter));
	}
	const errors = messages.filter((m) => m.level === 'ERROR');
	const warnings = messages.filter((m) => m.level === 'WARN');

	if (jsonOutput) {
		console.log(
			JSON.stringify(
				{
					entityCount: result.entityCount,
					edgeCount: result.edgeCount,
					storyCount: storyFiles.length,
					errorCount: errors.length,
					warningCount: warnings.length,
					translationCoverage: result.translationCoverage,
					messages
				},
				null,
				2
			)
		);
	} else {
		for (const m of messages) console.log(fmt(m) + '\n');
		const coverageStr = Object.entries(result.translationCoverage)
			.map(([locale, c]) => `${locale}: ${c.present} present, ${c.missing.length} missing`)
			.join(' · ');
		console.log(
			`${result.entityCount} entities, ${result.edgeCount} edges, ${storyFiles.length} stories, ${errors.length} errors, ${warnings.length} warnings, translation coverage — ${coverageStr}`
		);
	}

	process.exit(errors.length > 0 ? 1 : 0);
}

try {
	main();
} catch (e) {
	console.error('validate: runner crashed');
	console.error(e);
	process.exit(2);
}

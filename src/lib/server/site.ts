/**
 * Build-time view models for the pages. Server-only ($lib/server): reads the YAML content
 * through src/content/*.ts and returns small, plain, serialisable objects, so the prerendered
 * pages ship only what they display (never the YAML parser, the schemas or the full graph).
 *
 * Everything is deterministic: sorted explicitly, no clock reads.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSiteIndex } from '../../content/site-index.js';
import { getViewsData, resolveViewProse } from '../../content/views-index.js';
import {
	getDisciplinesVocab,
	getEntityTypesVocab,
	getPredicateFamiliesVocab,
	getTagsVocab
} from '../../content/vocab-index.js';
import { ROOT } from '../../content/loaders.js';
import { getStories, stepText } from '../../content/stories-index.js';
import { MAP_THEMES } from '../map/anchors.js';
import { resolveProse } from '../i18n/resolve.js';
import { renderMarkdown } from '../markdown/render.js';
import { GROUP_ORDER, relationGroupOf, type RelationGroupId } from '../explorer/graph.js';
import { fold } from '../glossary-filter.js';
import { RULES } from '../invariants/rules.js';
import { activeOptionalColumns, describeEntitySet, resolveViewQuery } from '../views/query.js';
import { ENTITY_TYPES, PREDICATE_FAMILY_IDS, PREDICATE_IDS } from '../model/types.js';
import type {
	Entity,
	EntityId,
	EntityType,
	GraphEdge,
	GraphIndex,
	PredicateFamilyId
} from '../model/types.js';
import type { Locale } from '../locale.js';

// ---------------------------------------------------------------------------------------------
// Small shared helpers

function collator(locale: Locale): Intl.Collator {
	return new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
}

function entityName(index: GraphIndex, id: EntityId, locale: Locale): string {
	return index.prose.get(locale)?.get(id)?.name ?? index.entities.get(id)?.name ?? id;
}

async function typeLabels(locale: Locale): Promise<Map<EntityType, string>> {
	const vocab = await getEntityTypesVocab();
	return new Map(
		ENTITY_TYPES.map((type) => [
			type,
			vocab.get(type)?.label[locale] ?? vocab.get(type)?.label.en ?? type
		])
	);
}

/** First letter for the A-Z index: accents folded, anything else grouped under '#'. */
export function indexLetter(name: string): string {
	const first = name.normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase();
	return /^[A-Z]$/.test(first) ? first : '#';
}

/** Wikipedia article in the reader's language, resolved by Wikidata at click time (no build-time fetch). */
export function wikipediaUrl(qid: string, locale: Locale): string {
	return `https://www.wikidata.org/wiki/Special:GoToLinkedPage/${locale}wiki/${qid}`;
}

/** Renders repository Markdown with its headings pushed down `shift` levels (max h6). */
function markdownWithHeadingShift(markdown: string, shift: number): string {
	return renderMarkdown(markdown).replace(/<(\/?)h([1-6])>/g, (_, slash: string, level: string) => {
		return `<${slash}h${Math.min(6, Number(level) + shift)}>`;
	});
}

function readRepoFile(path: string): string {
	return readFileSync(join(ROOT, path), 'utf-8');
}

// ---------------------------------------------------------------------------------------------
// Site-wide

export interface SiteSummary {
	entities: number;
	relations: number;
	/** Latest `lastReviewed` across all entities (YYYY-MM-DD). */
	lastReviewed: string;
}

export async function siteSummary(): Promise<SiteSummary> {
	const index = await getSiteIndex();
	const lastReviewed = [...index.entities.values()]
		.map((e) => e.lastReviewed)
		.sort()
		.at(-1);
	return {
		entities: index.stats.entityCount,
		relations: index.stats.edgeCount,
		lastReviewed: lastReviewed ?? ''
	};
}

export async function entityIds(): Promise<EntityId[]> {
	return [...(await getSiteIndex()).entities.keys()].sort();
}

export async function viewIds(): Promise<string[]> {
	return [...(await getViewsData()).views.keys()].sort();
}

// ---------------------------------------------------------------------------------------------
// Glossary

export interface GlossaryEntry {
	id: EntityId;
	name: string;
	type: EntityType;
	typeLabel: string;
	summary: string;
	letter: string;
	/** Folded name, aliases and summary, matched by the client-side filter. */
	search: string;
}

export interface GlossaryType {
	id: EntityType;
	label: string;
	count: number;
}

export interface GlossaryData {
	entries: GlossaryEntry[];
	types: GlossaryType[];
}

export async function glossary(locale: Locale): Promise<GlossaryData> {
	const index = await getSiteIndex();
	const labels = await typeLabels(locale);
	const compare = collator(locale);
	const entries = [...index.entities.values()]
		.map((entity): GlossaryEntry => {
			const { prose } = resolveProse(index, entity.id, locale);
			const name = prose.name ?? entity.name;
			const aka = [...(prose.aka ?? []), ...(entity.aka ?? [])];
			return {
				id: entity.id,
				name,
				type: entity.type,
				typeLabel: labels.get(entity.type) ?? entity.type,
				summary: prose.summary,
				letter: indexLetter(name),
				search: fold([name, entity.name, ...aka, prose.summary].join(' '))
			};
		})
		.sort((a, b) => compare.compare(a.name, b.name) || a.id.localeCompare(b.id));

	const counts = new Map<EntityType, number>();
	for (const entry of entries) counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1);
	const types = ENTITY_TYPES.filter((type) => counts.has(type))
		.map((type) => ({ id: type, label: labels.get(type) ?? type, count: counts.get(type) ?? 0 }))
		.sort((a, b) => compare.compare(a.label, b.label));

	return { entries, types };
}

// ---------------------------------------------------------------------------------------------
// Entity page

export interface EntityRef {
	id: EntityId;
	name: string;
}

export interface RelationSentence {
	/** The other end of the relation (the linked entity). */
	other: EntityRef;
	/** True when this entity is the grammatical subject ("X issues <other>"). */
	selfIsSubject: boolean;
	verb: string;
	note?: string;
}

export interface RelationGroup {
	/** A predicate family, or `related` for the loose `related-to` links (shown last). */
	family: RelationGroupId;
	label: string;
	sentences: RelationSentence[];
}

export interface ExternalLink {
	kind: 'website' | 'wikipedia' | 'wikidata' | 'ror';
	href: string;
	/** Identifier shown in the label (QID or ROR id), when any. */
	value?: string;
}

export interface AttributeRow {
	key: string;
	value: string;
}

export interface EntityPageData {
	id: EntityId;
	name: string;
	typeLabel: string;
	summary: string;
	localNote?: string;
	fallback: boolean;
	/** Locale of the prose actually shown (differs from the page locale on fallback). */
	proseLocale: Locale;
	aka: string[];
	bodyHtml: string;
	relations: RelationGroup[];
	links: ExternalLink[];
	attributes: AttributeRow[];
	tags: string[];
	disciplines: string[];
	geography: string[];
	sources: { url: string; title?: string; accessed: string; note?: string }[];
	lastReviewed: string;
}

function formatAttribute(value: unknown, yes: string, no: string): string {
	if (value === null || value === undefined) return '';
	if (Array.isArray(value)) return value.map(String).join(', ');
	if (typeof value === 'boolean') return value ? yes : no;
	if (typeof value === 'object') {
		return Object.entries(value as Record<string, unknown>)
			.map(([k, v]) => `${k}: ${String(v)}`)
			.join(', ');
	}
	return String(value);
}

/** Fields shown elsewhere on the page (or structural), not repeated in the attribute table. */
const HIDDEN_ATTRIBUTES = new Set([
	'id',
	'name',
	'relations',
	'sources',
	'aka',
	'tags',
	'disciplines',
	'geography',
	'lastReviewed'
]);

function relationGroups(
	index: GraphIndex,
	id: EntityId,
	locale: Locale,
	familyLabels: Map<RelationGroupId, string>
): RelationGroup[] {
	const compare = collator(locale);
	const prose = (entity: EntityId) => index.prose.get(locale)?.get(entity);
	const sentence = (edge: GraphEdge, selfIsSubject: boolean): RelationSentence => {
		const otherId = selfIsSubject ? edge.to : edge.from;
		const def = index.predicates.get(edge.predicate);
		// relationNotes live in the authoring entity's prose, keyed `predicate@target`.
		const author = edge.derived ? edge.to : edge.from;
		const target = edge.derived ? edge.from : edge.to;
		const note = prose(author)?.relationNotes?.[`${edge.predicate}@${target}`];
		return {
			other: { id: otherId, name: entityName(index, otherId, locale) },
			selfIsSubject,
			verb: def?.label[locale] ?? def?.label.es ?? edge.predicate,
			...(note ? { note } : {})
		};
	};

	const byFamily = new Map<RelationGroupId, RelationSentence[]>();
	const push = (edge: GraphEdge, selfIsSubject: boolean) => {
		const family = relationGroupOf(
			edge.predicate,
			index.predicates.get(edge.predicate)?.family ?? 'connects'
		);
		const list = byFamily.get(family) ?? [];
		list.push(sentence(edge, selfIsSubject));
		byFamily.set(family, list);
	};
	for (const edge of index.outgoing.get(id) ?? []) push(edge, true);
	for (const edge of index.incoming.get(id) ?? []) {
		// Symmetric relations already appear as outgoing on both ends (build-index.ts).
		if (index.predicates.get(edge.predicate)?.symmetric) continue;
		push(edge, false);
	}

	return GROUP_ORDER.filter((family) => byFamily.has(family)).map((family) => ({
		family,
		label: familyLabels.get(family) ?? family,
		sentences: (byFamily.get(family) ?? []).sort(
			(a, b) =>
				Number(b.selfIsSubject) - Number(a.selfIsSubject) ||
				compare.compare(a.verb, b.verb) ||
				compare.compare(a.other.name, b.other.name)
		)
	}));
}

function externalLinks(entity: Entity, locale: Locale): ExternalLink[] {
	const links: ExternalLink[] = [{ kind: 'website', href: entity.url }];
	const qid = entity.identifiers?.wikidata;
	if (qid) {
		links.push({ kind: 'wikipedia', href: wikipediaUrl(qid, locale) });
		links.push({ kind: 'wikidata', href: `https://www.wikidata.org/wiki/${qid}`, value: qid });
	}
	const ror = entity.identifiers?.ror;
	if (ror) links.push({ kind: 'ror', href: `https://ror.org/${ror}`, value: ror });
	return links;
}

export async function entityPage(
	id: EntityId,
	locale: Locale,
	words: { yes: string; no: string; related: string; governance: (value: string) => string }
): Promise<EntityPageData | undefined> {
	const index = await getSiteIndex();
	const entity = index.entities.get(id);
	if (!entity) return undefined;

	const labels = await typeLabels(locale);
	const families = await getPredicateFamiliesVocab();
	const familyLabels = new Map<RelationGroupId, string>(
		[...families.entries()].map(([fid, f]) => [fid, f.label[locale] ?? f.label.en ?? fid])
	);
	familyLabels.set('related', words.related);
	const tagsVocab = await getTagsVocab();
	const disciplinesVocab = await getDisciplinesVocab();
	const { prose, fallback, localeUsed } = resolveProse(index, id, locale);

	const attributes = Object.entries(entity)
		.filter(([key, value]) => !HIDDEN_ATTRIBUTES.has(key) && value !== undefined)
		.map(([key, value]) => ({
			key,
			value:
				key === 'governance'
					? words.governance(String(value))
					: key === 'type'
						? (labels.get(entity.type) ?? entity.type)
						: formatAttribute(value, words.yes, words.no)
		}));

	return {
		id,
		name: prose.name ?? entity.name,
		typeLabel: labels.get(entity.type) ?? entity.type,
		summary: prose.summary,
		...(prose.localNote ? { localNote: prose.localNote } : {}),
		fallback,
		proseLocale: localeUsed as Locale,
		aka: [...new Set([...(prose.aka ?? []), ...(entity.aka ?? [])])],
		bodyHtml: renderMarkdown(prose.body ?? ''),
		relations: relationGroups(index, id, locale, familyLabels),
		links: externalLinks(entity, locale),
		attributes,
		tags: entity.tags.map((tag) => tagsVocab.get(tag)?.label[locale] ?? tag),
		disciplines: (entity.disciplines ?? []).map((d) => disciplinesVocab.get(d)?.label[locale] ?? d),
		geography: entity.geography ?? [],
		sources: entity.sources.map((s) => ({ ...s })),
		lastReviewed: entity.lastReviewed
	};
}

// ---------------------------------------------------------------------------------------------
// Questions (views)

export interface QuestionSummary {
	id: string;
	title: string;
	question: string;
}

export async function questions(locale: Locale): Promise<QuestionSummary[]> {
	const data = await getViewsData();
	return [...data.views.keys()].sort().map((id) => {
		const { prose } = resolveViewProse(data, id, locale);
		return { id, title: prose.title, question: prose.question };
	});
}

export interface QuestionPageData extends QuestionSummary {
	fallback: boolean;
	proseLocale: Locale;
	bodyHtml: string;
	/** `predicate` views: the relations the question is about, as sentences. */
	sentences: { subject: EntityRef; verb: string; object: EntityRef }[];
	/** `entities` / `explicit` views: the matching entries. */
	entries: {
		id: EntityId;
		name: string;
		typeLabel: string;
		governance: string;
		optional: string[];
	}[];
	optionalColumns: string[];
	sources: { url: string; title?: string }[];
}

export async function questionPage(
	id: string,
	locale: Locale,
	governance: (value: string) => string
): Promise<QuestionPageData | undefined> {
	const index = await getSiteIndex();
	const data = await getViewsData();
	const view = data.views.get(id);
	if (!view) return undefined;
	const { prose, fallback, localeUsed } = resolveViewProse(data, id, locale);
	const resolved = resolveViewQuery(index, view.query, locale);
	const labels = await typeLabels(locale);
	const compare = collator(locale);

	const ref = (entity: EntityId): EntityRef => ({
		id: entity,
		name: entityName(index, entity, locale)
	});
	const sentences =
		view.query.kind === 'predicate'
			? resolved.edges.map((edge) => {
					const def = index.predicates.get(edge.predicate);
					return {
						subject: ref(edge.from),
						verb: def?.label[locale] ?? def?.label.es ?? edge.predicate,
						object: ref(edge.to)
					};
				})
			: [];

	const optionalColumns =
		view.query.kind === 'predicate' ? [] : activeOptionalColumns(index, resolved.entityIds);
	const entries =
		view.query.kind === 'predicate'
			? []
			: describeEntitySet(index, resolved.entityIds, locale)
					.map((row) => ({
						id: row.id,
						name: row.name,
						typeLabel: labels.get(row.type as EntityType) ?? row.type,
						governance: governance(row.governance),
						optional: optionalColumns.map((col) => row.optional[col] ?? '')
					}))
					.sort((a, b) => compare.compare(a.name, b.name));

	return {
		id,
		title: prose.title,
		question: prose.question,
		fallback,
		proseLocale: localeUsed as Locale,
		bodyHtml: renderMarkdown(prose.body ?? ''),
		sentences,
		entries,
		optionalColumns: [...optionalColumns],
		sources: view.sources.map((s) => ({ url: s.url, ...(s.title ? { title: s.title } : {}) }))
	};
}

// ---------------------------------------------------------------------------------------------
// About

export interface AboutData {
	summary: SiteSummary;
	families: { id: PredicateFamilyId; label: string; definition: string }[];
	types: { id: EntityType; label: string; definition: string; count: number }[];
	predicates: { id: string; label: string; inverseLabel: string; family: string; count: number }[];
	rules: { id: string; level: string; description: string }[];
	contributeHtml: string;
	templateHtml: string;
	changelogHeadings: string[];
	exampleEntity: EntityId;
}

/** `### ` headings of the newest `## ` release section of CHANGELOG.md, newest first. */
function latestChangelogHeadings(markdown: string, limit: number): string[] {
	const lines = markdown.split('\n');
	const start = lines.findIndex((line) => line.startsWith('## '));
	const out: string[] = [];
	for (const line of lines.slice(start + 1)) {
		if (line.startsWith('## ')) break;
		if (line.startsWith('### ')) out.push(line.slice(4).replace(/`/g, ''));
		if (out.length === limit) break;
	}
	return out;
}

export async function about(locale: Locale): Promise<AboutData> {
	const index = await getSiteIndex();
	const typesVocab = await getEntityTypesVocab();
	const familiesVocab = await getPredicateFamiliesVocab();
	const compare = collator(locale);
	const pick = (map: Record<string, string> | undefined) => map?.[locale] ?? map?.en ?? '';

	const families = PREDICATE_FAMILY_IDS.map((id) => ({
		id,
		label: pick(familiesVocab.get(id)?.label),
		definition: pick(familiesVocab.get(id)?.definition)
	}));
	const familyLabel = new Map(families.map((f) => [f.id, f.label]));

	const types = ENTITY_TYPES.map((id) => ({
		id,
		label: pick(typesVocab.get(id)?.label) || id,
		definition: pick(typesVocab.get(id)?.definition),
		count: index.byType.get(id)?.length ?? 0
	})).sort((a, b) => compare.compare(a.label, b.label));

	const predicates = PREDICATE_IDS.map((id) => {
		const def = index.predicates.get(id);
		return {
			id,
			label: def?.label[locale] ?? id,
			inverseLabel: def?.inverseLabel[locale] ?? id,
			family: def ? (familyLabel.get(def.family) ?? def.family) : '',
			count: index.stats.byPredicate[id] ?? 0
		};
	}).sort((a, b) => compare.compare(a.family, b.family) || compare.compare(a.label, b.label));

	// CONTRIBUTING.md starts with its own `# Contributing` title: the section heading replaces it.
	const contributing = readRepoFile('CONTRIBUTING.md').replace(/^# .*\n/, '');

	return {
		summary: await siteSummary(),
		families,
		types,
		predicates,
		rules: RULES.map((rule) => ({ id: rule.id, level: rule.level, description: rule.description })),
		contributeHtml: markdownWithHeadingShift(contributing, 2),
		templateHtml: markdownWithHeadingShift(readRepoFile('prompts/add-entity.md'), 3),
		changelogHeadings: latestChangelogHeadings(readRepoFile('CHANGELOG.md'), 5),
		exampleEntity: index.entities.has('doi') ? 'doi' : ([...index.entities.keys()].sort()[0] ?? '')
	};
}

export function changelogHtml(): string {
	return renderMarkdown(readRepoFile('CHANGELOG.md'));
}

// ---------------------------------------------------------------------------------------------
// Stories (guided question paths, src/content/stories)

export interface StorySummary {
	id: string;
	title: string;
	question: string;
	theme?: string;
	steps: number;
}

export async function storyIds(): Promise<string[]> {
	return [...(await getStories()).keys()];
}

export async function stories(locale: Locale): Promise<StorySummary[]> {
	return [...(await getStories()).values()].map((story) => ({
		id: story.id,
		title: story.title[locale],
		question: story.question[locale],
		...(story.theme
			? { theme: MAP_THEMES.find((t) => t.id === story.theme)?.label[locale] ?? story.theme }
			: {}),
		steps: story.steps.length
	}));
}

export interface StoryPageData extends StorySummary {
	/** One entry per step: the caption and the entities it brings in (focus first). */
	stepList: { text: string; entities: EntityRef[] }[];
}

export async function storyPage(id: string, locale: Locale): Promise<StoryPageData | undefined> {
	const story = (await getStories()).get(id);
	if (!story) return undefined;
	const index = await getSiteIndex();
	const ref = (entity: EntityId): EntityRef => ({
		id: entity,
		name: entityName(index, entity, locale)
	});
	return {
		id: story.id,
		title: story.title[locale],
		question: story.question[locale],
		...(story.theme
			? { theme: MAP_THEMES.find((t) => t.id === story.theme)?.label[locale] ?? story.theme }
			: {}),
		steps: story.steps.length,
		stepList: story.steps.map((step) => ({
			text: stepText(step, locale),
			entities: [...new Set([step.focus, ...step.reveal])].map(ref)
		}))
	};
}

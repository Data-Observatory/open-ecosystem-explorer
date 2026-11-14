// Resolves a View's ViewQuery against the live GraphIndex (specs.md §5.6).
// PURE (rule A1): the three closed forms only — `entities` (where-clauses,
// OR across array elements, AND within one clause object), `predicate`
// (group entities by one predicate's edges), `explicit` (a curated list).
// Deliberately not an expression language (§5.6's own stated risk/mitigation) —
// resist the temptation to add operators here.
import type { Entity, EntityId, GraphEdge, GraphIndex, ViewQuery } from '../model/types.js';
import type { LocaleCode } from '../../i18n/locales.js';

/** Optional attribute columns shown only when at least one matched entity
 *  carries them — keeps the `entities`/`explicit` view table generic across
 *  fault lines (FL4's coverage columns appear automatically; FL1/FL3 don't
 *  force empty columns). */
const OPTIONAL_COLUMNS = [
	'outputLicence',
	'indexKind',
	'coverageLanguages',
	'coverageObjects',
	'bulkDownload',
	'inclusionCriteria'
] as const;
export type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number];

export interface EntitySummaryRow {
	id: EntityId;
	name: string;
	type: string;
	governance: string;
	optional: Partial<Record<OptionalColumn, string>>;
}

function displayValue(v: unknown): string | undefined {
	if (v === undefined || v === null) return undefined;
	return Array.isArray(v) ? v.join(', ') : String(v);
}

/** Which optional columns actually appear across `ids` — the table only
 *  renders headers for columns with at least one non-empty value. */
export function activeOptionalColumns(
	index: GraphIndex,
	ids: readonly EntityId[]
): OptionalColumn[] {
	return OPTIONAL_COLUMNS.filter((col) =>
		ids.some((id) => fieldValue(index.entities.get(id) as Entity, col) !== undefined)
	);
}

export function describeEntitySet(
	index: GraphIndex,
	ids: readonly EntityId[],
	locale: LocaleCode
): EntitySummaryRow[] {
	const cols = activeOptionalColumns(index, ids);
	return ids.map((id) => {
		const e = index.entities.get(id)!;
		const name = index.prose.get(locale)?.get(id)?.name ?? e.name;
		const optional: Partial<Record<OptionalColumn, string>> = {};
		for (const col of cols) {
			const v = displayValue(fieldValue(e, col));
			if (v !== undefined) optional[col] = v;
		}
		return { id, name, type: e.type, governance: e.governance, optional };
	});
}

export interface ResolvedView {
	entityIds: EntityId[];
	/** Only populated for `kind: 'predicate'` queries — the edges the view is about. */
	edges: GraphEdge[];
}

function fieldValue(entity: Entity, key: string): unknown {
	return (entity as unknown as Record<string, unknown>)[key];
}

/** One clause: every key must match (AND). A key's query value may be a
 *  single string (exact match, or membership if the entity's field is an
 *  array) or an array of strings (the entity's value — scalar or array —
 *  must intersect it). */
function matchesClause(entity: Entity, clause: Record<string, string | string[]>): boolean {
	for (const [key, want] of Object.entries(clause)) {
		const have = fieldValue(entity, key);
		const wantSet = Array.isArray(want) ? want : [want];
		if (Array.isArray(have)) {
			if (!have.some((v) => wantSet.includes(String(v)))) return false;
		} else {
			if (have === undefined || !wantSet.includes(String(have))) return false;
		}
	}
	return true;
}

/** Resolves a View's query against `index`. Result entity ids are always
 *  sorted for determinism (A3) — a view's rendered content must not depend
 *  on Map/Set iteration order. */
export function resolveViewQuery(
	index: GraphIndex,
	query: ViewQuery,
	// Kept for a stable signature; resolution does not depend on the locale.
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_locale: LocaleCode
): ResolvedView {
	switch (query.kind) {
		case 'entities': {
			const ids = [...index.entities.values()]
				.filter((e) => query.where.some((clause) => matchesClause(e, clause)))
				.map((e) => e.id)
				.sort();
			return { entityIds: ids, edges: [] };
		}
		case 'predicate': {
			const edges = index.edges.filter((e) => e.predicate === query.predicate && !e.derived);
			const groupField: 'from' | 'to' = query.groupBy === 'source' ? 'from' : 'to';
			const ids = [...new Set(edges.map((e) => e[groupField]))].sort();
			const sortedEdges = edges
				.slice()
				.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
			return { entityIds: ids, edges: sortedEdges };
		}
		case 'explicit': {
			const ids = query.entities
				.filter((id) => index.entities.has(id))
				.slice()
				.sort();
			return { entityIds: ids, edges: [] };
		}
	}
}

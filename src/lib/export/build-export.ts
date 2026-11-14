// Builds the locale-free export payload (specs.md §7 `/data/*` row): "carrying
// all locales' prose in a prose: { es: …, en: … } map. Stable, documented
// shape; per-entity JSON includes derived inverses." PURE over an
// already-built GraphIndex (rule A1) — the endpoint files do the
// serialization (JSON/CSV), this module only shapes the data.
import type { Entity, EntityId, GraphIndex } from '../model/types.js';
import { locales } from '../../i18n/locales.js';

export interface ExportedRelation {
	predicate: string;
	target: EntityId;
	derived: boolean;
	since?: string;
	until?: string;
	note?: string;
}

export interface ExportedEntity {
	id: EntityId;
	type: Entity['type'];
	name: string; // locale-independent (EntityBase.name) — prose[locale].name is only a rare override, per C10/§5.7
	governance: string;
	status: string;
	url: string;
	tags: string[];
	prose: Record<string, { name?: string; summary: string } | undefined>;
	relations: ExportedRelation[]; // outgoing (authored) + incoming-derived-inverse, per §7's "includes derived inverses"
}

export interface GraphExport {
	generatedAt: string;
	entityCount: number;
	edgeCount: number;
	entities: ExportedEntity[];
}

function exportOneEntity(index: GraphIndex, id: EntityId): ExportedEntity {
	const e = index.entities.get(id)!;
	const prose: ExportedEntity['prose'] = {};
	for (const { code } of locales) {
		const p = index.prose.get(code)?.get(id);
		prose[code] = p ? { name: p.name, summary: p.summary } : undefined;
	}

	const outgoing = (index.outgoing.get(id) ?? []).map((r) => ({
		predicate: r.predicate,
		target: r.to,
		derived: r.derived,
		since: r.since,
		until: r.until,
		note: r.note
	}));
	// "includes derived inverses": the incoming edges, expressed as the
	// predicate's inverse label id would require a separate inverse-predicate
	// vocabulary this project doesn't model as its own PredicateId (A.2's
	// predicates ARE the canonical direction) — so derived inverses are
	// exposed as incoming edges tagged `derived: true`, oriented `target -> id`
	// read as "id is the <predicate> of target" via inverseLabel at read time.
	const incomingDerived = (index.incoming.get(id) ?? [])
		.filter((r) => !r.derived)
		.map((r) => ({
			predicate: r.predicate,
			target: r.from,
			derived: true,
			since: r.since,
			until: r.until,
			note: r.note
		}));

	return {
		id: e.id,
		type: e.type,
		name: e.name,
		governance: e.governance,
		status: e.status,
		url: e.url,
		tags: e.tags,
		prose,
		relations: [...outgoing, ...incomingDerived]
	};
}

export function buildGraphExport(index: GraphIndex): GraphExport {
	const ids = [...index.entities.keys()].sort();
	return {
		generatedAt: new Date().toISOString(),
		entityCount: index.entities.size,
		edgeCount: index.edges.length,
		entities: ids.map((id) => exportOneEntity(index, id))
	};
}

export function exportEntity(index: GraphIndex, id: EntityId): ExportedEntity | undefined {
	return index.entities.has(id) ? exportOneEntity(index, id) : undefined;
}

function csvEscape(value: string): string {
	return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toEntitiesCsv(exp: GraphExport): string {
	const header = [
		'id',
		'type',
		'governance',
		'status',
		'name',
		'name_es',
		'name_en',
		'url',
		'tags'
	];
	const rows = exp.entities.map((e) =>
		[
			e.id,
			e.type,
			e.governance,
			e.status,
			e.name,
			e.prose.es?.name ?? '',
			e.prose.en?.name ?? '',
			e.url,
			e.tags.join('|')
		]
			.map(csvEscape)
			.join(',')
	);
	return [header.join(','), ...rows].join('\n');
}

export function toRelationsCsv(exp: GraphExport): string {
	const header = ['from', 'predicate', 'to', 'derived', 'since', 'until', 'note'];
	const rows: string[] = [];
	for (const e of exp.entities) {
		for (const r of e.relations) {
			if (r.derived) continue; // derived inverses are the mirror of an authored row already listed from the other entity — avoid doubling every edge in the flat CSV.
			rows.push(
				[e.id, r.predicate, r.target, String(r.derived), r.since ?? '', r.until ?? '', r.note ?? '']
					.map(csvEscape)
					.join(',')
			);
		}
	}
	return [header.join(','), ...rows].join('\n');
}

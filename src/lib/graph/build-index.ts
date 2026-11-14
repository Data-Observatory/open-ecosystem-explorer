// buildIndex is pure, deterministic, and the only place inverses, layers and
// prose fallbacks are resolved (specs.md §5.4, A3, A5).
import type {
	Entity,
	EntityId,
	EntityType,
	GraphEdge,
	GraphIndex,
	Layer,
	CrossCuttingLayer,
	ResolvedProse
} from '../model/types.js';
import { ENTITY_TYPES } from '../model/types.js';
import type { LocaleCode } from '../../i18n/locales.js';
import type { EntityTypesVocab, PredicatesVocab } from '../model/vocab.js';
import { layerForType } from '../model/vocab.js';
import { computeStats } from './stats.js';

function compareIds(a: EntityId, b: EntityId): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

export function buildIndex(
	entities: readonly Entity[],
	prose: ReadonlyMap<LocaleCode, ReadonlyMap<EntityId, ResolvedProse>>,
	predicates: PredicatesVocab,
	typeLayerMap: EntityTypesVocab
): GraphIndex {
	const sortedEntities = [...entities].sort((a, b) => compareIds(a.id, b.id));
	const entityMap = new Map<EntityId, Entity>(sortedEntities.map((e) => [e.id, e]));

	// byType, sorted by name
	const byType = new Map<EntityType, readonly EntityId[]>();
	for (const type of ENTITY_TYPES) {
		const ids = sortedEntities
			.filter((e) => e.type === type)
			.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
			.map((e) => e.id);
		byType.set(type, ids);
	}

	// byLayer, derived from type (§5.1)
	const byLayer = new Map<Layer | CrossCuttingLayer, EntityId[]>();
	for (const e of sortedEntities) {
		const layer = layerForType(typeLayerMap, e.type);
		if (!byLayer.has(layer)) byLayer.set(layer, []);
		byLayer.get(layer)!.push(e.id);
	}
	for (const [layer, ids] of byLayer) {
		ids.sort(compareIds);
		byLayer.set(layer, ids);
	}

	// Canonical edges: authored relations, sorted by (from, predicate, to) — A3.
	const edges: GraphEdge[] = [];
	for (const e of sortedEntities) {
		for (const r of e.relations) {
			edges.push({
				from: e.id,
				to: r.target,
				predicate: r.predicate,
				note: r.note,
				since: r.since,
				until: r.until,
				confidence: r.confidence ?? 'asserted',
				sources: r.sources ?? [],
				derived: false
			});
		}
	}
	edges.sort(
		(a, b) =>
			compareIds(a.from, b.from) || a.predicate.localeCompare(b.predicate) || compareIds(a.to, b.to)
	);

	// outgoing: authored edges from this id, plus synthesised mirrors of
	// symmetric edges authored from the *other* endpoint (derived: true) so a
	// symmetric relation reads as outgoing from both sides.
	const outgoing = new Map<EntityId, GraphEdge[]>();
	const incoming = new Map<EntityId, GraphEdge[]>();
	for (const id of entityMap.keys()) {
		outgoing.set(id, []);
		incoming.set(id, []);
	}
	for (const edge of edges) {
		outgoing.get(edge.from)?.push(edge);
		incoming.get(edge.to)?.push(edge);
		const def = predicates.get(edge.predicate);
		if (def?.symmetric && edge.from !== edge.to) {
			outgoing.get(edge.to)?.push({ ...edge, from: edge.to, to: edge.from, derived: true });
		}
	}

	// Every id here was pre-populated into both maps above, so `.get(id)!` is
	// always defined — no fallback branch needed (or reachable).
	const degree = new Map<EntityId, { in: number; out: number }>();
	for (const id of entityMap.keys()) {
		degree.set(id, { in: incoming.get(id)!.length, out: outgoing.get(id)!.length });
	}

	// Weakly connected components (undirected union-find over canonical edges).
	const parent = new Map<EntityId, EntityId>();
	for (const id of entityMap.keys()) parent.set(id, id);
	function find(x: EntityId): EntityId {
		let root = x;
		while (parent.get(root) !== root) root = parent.get(root)!;
		let cur = x;
		while (parent.get(cur) !== root) {
			const next = parent.get(cur)!;
			parent.set(cur, root);
			cur = next;
		}
		return root;
	}
	function union(a: EntityId, b: EntityId): void {
		const ra = find(a);
		const rb = find(b);
		if (ra !== rb) parent.set(ra, rb);
	}
	for (const edge of edges) {
		if (entityMap.has(edge.to)) union(edge.from, edge.to);
	}
	const groups = new Map<EntityId, EntityId[]>();
	for (const id of entityMap.keys()) {
		const root = find(id);
		if (!groups.has(root)) groups.set(root, []);
		groups.get(root)!.push(id);
	}
	const components = [...groups.values()]
		.map((g) => g.sort(compareIds))
		.sort((a, b) => compareIds(a[0]!, b[0]!));

	const stats = computeStats({
		entityIds: [...entityMap.keys()],
		byType,
		byLayer,
		edges,
		degree,
		predicateIds: [...predicates.keys()],
		prose
	});

	return {
		entities: entityMap,
		byType,
		byLayer,
		edges,
		outgoing,
		incoming,
		degree,
		predicates,
		components,
		prose,
		stats
	};
}

/**
 * Read-only index over the map payload: lookups, a node's relations as sentences grouped by
 * predicate family (the card's reading order), and which neighbours go on the ring.
 */
import { rankNeighbours } from '../map/anchors.js';
import type { MapEdge, MapGraph, MapNode, PredicateFamilyId } from './types.js';

/** Card and ring order: what it is first, then who is behind it (same as the entity page). */
export const FAMILY_ORDER: readonly PredicateFamilyId[] = [
	'kind',
	'behind',
	'builds-on',
	'connects',
	'shapes'
];

/** Order-independent key of the pair of nodes an edge joins (one line per pair on the canvas). */
export const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

export interface Sentence {
	/** The other end of the relation. */
	other: MapNode;
	/** True when the node the card is about is the grammatical subject. */
	selfIsSubject: boolean;
	verb: string;
	family: PredicateFamilyId;
	pair: string;
}

export interface SentenceGroup {
	family: PredicateFamilyId;
	label: string;
	sentences: Sentence[];
}

export interface MapIndex {
	graph: MapGraph;
	byId: ReadonlyMap<string, MapNode>;
	/** Every edge touching a node, authored order. */
	edgesOf: ReadonlyMap<string, readonly MapEdge[]>;
	/** Distinct neighbour ids per node. */
	neighbours: ReadonlyMap<string, readonly string[]>;
	linked(a: string, b: string): boolean;
}

export function indexGraph(graph: MapGraph): MapIndex {
	const byId = new Map(graph.nodes.map((node) => [node.id, node]));
	const edgesOf = new Map<string, MapEdge[]>(graph.nodes.map((node) => [node.id, []]));
	const neighbours = new Map<string, string[]>(graph.nodes.map((node) => [node.id, []]));
	const pairs = new Set<string>();
	for (const edge of graph.edges) {
		if (!byId.has(edge.s) || !byId.has(edge.t) || edge.s === edge.t) continue;
		edgesOf.get(edge.s)?.push(edge);
		edgesOf.get(edge.t)?.push(edge);
		const key = pairKey(edge.s, edge.t);
		if (!pairs.has(key)) {
			pairs.add(key);
			neighbours.get(edge.s)?.push(edge.t);
			neighbours.get(edge.t)?.push(edge.s);
		}
	}
	return { graph, byId, edgesOf, neighbours, linked: (a, b) => pairs.has(pairKey(a, b)) };
}

/** All relations of `id` as sentences, in card order (family, then subject-first, then name). */
export function sentencesOf(index: MapIndex, id: string, locale: string): Sentence[] {
	const compare = new Intl.Collator(locale, { sensitivity: 'base', numeric: true }).compare;
	const out: Sentence[] = [];
	for (const edge of index.edgesOf.get(id) ?? []) {
		const predicate = index.graph.predicates[edge.p];
		const otherId = edge.s === id ? edge.t : edge.s;
		const other = index.byId.get(otherId);
		if (!other) continue;
		out.push({
			other,
			// A symmetric relation reads the same from both ends ("X relates to Y").
			selfIsSubject: edge.s === id || (predicate?.symmetric ?? false),
			verb: predicate?.label ?? edge.p,
			family: edge.f,
			pair: pairKey(id, otherId)
		});
	}
	return out.sort(
		(a, b) =>
			FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family) ||
			Number(b.selfIsSubject) - Number(a.selfIsSubject) ||
			compare(a.verb, b.verb) ||
			compare(a.other.name, b.other.name)
	);
}

export function groupSentences(index: MapIndex, sentences: readonly Sentence[]): SentenceGroup[] {
	const labels = new Map(index.graph.families.map((f) => [f.id, f.label]));
	return FAMILY_ORDER.map((family) => ({
		family,
		label: labels.get(family) ?? family,
		sentences: sentences.filter((s) => s.family === family)
	})).filter((group) => group.sentences.length > 0);
}

export interface RingChoice {
	/** Neighbour ids in ring order (clockwise from the top, grouped by relation family). */
	shown: string[];
	/** How many neighbours are left out until the reader asks for all of them. */
	hidden: number;
}

/**
 * Which neighbours of `id` go on the ring. The `capacity` most worth showing are kept (anchors,
 * then core entries, then by degree: `rankNeighbours`), unless `expanded`. They are then ordered
 * by the family of their first sentence, so the ring reads in the same order as the card.
 */
export function chooseRing(
	index: MapIndex,
	id: string,
	capacity: number,
	expanded: boolean,
	locale: string
): RingChoice {
	const sentences = sentencesOf(index, id, locale);
	const order = [...new Set(sentences.map((s) => s.other.id))];
	const ranked = rankNeighbours(
		order.map((n) => {
			const node = index.byId.get(n);
			return {
				id: n,
				anchor: node?.anchor ?? false,
				core: node?.core ?? false,
				degree: node?.degree ?? 0
			};
		})
	);
	const keep = new Set((expanded ? ranked : ranked.slice(0, capacity)).map((n) => n.id));
	const shown = order.filter((n) => keep.has(n));
	return { shown, hidden: order.length - shown.length };
}

/** Folds case and accents for search. */
export const fold = (text: string): string =>
	text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Search rank of a node for a folded query: name prefix, name, alias, summary; -1 = no match. */
export function searchScore(node: MapNode, needle: string): number {
	if (!needle) return 0;
	const name = fold(node.name);
	const label = fold(node.label);
	if (name.startsWith(needle) || label.startsWith(needle)) return 3;
	if (name.includes(needle)) return 2;
	if (node.aka.some((alias) => fold(alias).includes(needle))) return 1.5;
	if (fold(node.summary).includes(needle)) return 1;
	return -1;
}

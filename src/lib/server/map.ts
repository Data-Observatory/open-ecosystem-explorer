/**
 * Build-time payloads for the map explorer (home page) and the entity page's mini-graph.
 * Server-only: reads the content index and the committed layout, returns plain data.
 */
import layout from '../../generated/graph-layout.json' with { type: 'json' };
import { getSiteIndex } from '../../content/site-index.js';
import { getStories } from '../../content/stories-index.js';
import { getEntityTypesVocab, getPredicateFamiliesVocab } from '../../content/vocab-index.js';
import { chooseRing, indexGraph, pairKey } from '../explorer/graph.js';
import { ringSlots } from '../explorer/geometry.js';
import type { SceneEdge, SceneNode } from '../explorer/scene.js';
import type { MapGraph, MapNode } from '../explorer/types.js';
import { resolveProse } from '../i18n/resolve.js';
import {
	ANCHOR_THEME,
	DEFAULT_ANCHOR_IDS,
	MAP_THEMES,
	clampWords,
	isAnchor,
	nodeFamilyOf
} from '../map/anchors.js';
import { PREDICATE_FAMILY_IDS, prominenceOf } from '../model/types.js';
import type { Locale } from '../locale.js';
import { wikipediaUrl } from './site.js';

const positions = layout.positions as unknown as Record<string, [number, number]>;

const cache = new Map<Locale, Promise<MapGraph>>();

/** The whole graph for the explorer, in one locale. Deterministic: ids sorted, edges in index order. */
export function mapGraph(locale: Locale): Promise<MapGraph> {
	let built = cache.get(locale);
	if (!built) {
		built = buildMapGraph(locale);
		cache.set(locale, built);
	}
	return built;
}

async function buildMapGraph(locale: Locale): Promise<MapGraph> {
	const index = await getSiteIndex();
	const typesVocab = await getEntityTypesVocab();
	const familiesVocab = await getPredicateFamiliesVocab();
	const compare = new Intl.Collator(locale, { sensitivity: 'base', numeric: true }).compare;

	const nodes: MapNode[] = [...index.entities.values()]
		.sort((a, b) => (a.id < b.id ? -1 : 1))
		.map((entity) => {
			const { prose } = resolveProse(index, entity.id, locale);
			const name = prose.name ?? entity.name;
			const degree = index.degree.get(entity.id) ?? { in: 0, out: 0 };
			const qid = entity.identifiers?.wikidata;
			const [x, y] = positions[entity.id] ?? [0, 0];
			return {
				id: entity.id,
				name,
				label: prose.shortName ?? name,
				type: entity.type,
				typeLabel: typesVocab.get(entity.type)?.label[locale] ?? entity.type,
				family: nodeFamilyOf(entity.type),
				anchor: isAnchor(entity.id),
				core: prominenceOf(entity) === 'core',
				degree: degree.in + degree.out,
				summary: clampWords(prose.summary),
				...(qid ? { wp: wikipediaUrl(qid, locale) } : {}),
				aka: [...new Set([...(prose.aka ?? []), ...(entity.aka ?? [])])],
				x,
				y
			};
		});

	const edges = index.edges
		.filter((edge) => !edge.derived)
		.map((edge) => ({
			s: edge.from,
			p: edge.predicate,
			t: edge.to,
			f: index.predicates.get(edge.predicate)?.family ?? ('kind' as const)
		}));

	const predicates = Object.fromEntries(
		[...index.predicates.values()].map((p) => [
			p.id,
			{ label: p.label[locale] ?? p.label.es ?? p.id, symmetric: p.symmetric ?? false }
		])
	);

	const types = [...new Map(nodes.map((n) => [n.type, n.typeLabel])).entries()]
		.map(([id, label]) => ({ id, label }))
		.sort((a, b) => compare(a.label, b.label));

	const stories = [...(await getStories()).values()].map((story) => ({
		id: story.id,
		question: story.question[locale],
		steps: story.steps.map((step) => ({
			focus: step.focus,
			reveal: [...step.reveal],
			edges: (step.edges ?? []).map(
				(e) => [e.source, e.predicate, e.target] as [string, string, string]
			),
			text: step.text[locale]
		}))
	}));

	return {
		nodes,
		edges,
		predicates,
		families: PREDICATE_FAMILY_IDS.map((id) => ({
			id,
			label: familiesVocab.get(id)?.label[locale] ?? id
		})),
		themes: MAP_THEMES.map((theme) => ({
			id: theme.id,
			label: theme.label[locale],
			members: DEFAULT_ANCHOR_IDS.filter((id) => ANCHOR_THEME[id] === theme.id)
		})),
		types,
		stories
	};
}

export interface MiniGraphVariant {
	width: number;
	height: number;
	nodes: SceneNode[];
	edges: SceneEdge[];
}

export interface MiniGraphData {
	/** Only the nodes drawn (the entity and its ring), as the canvas needs them. */
	nodes: Pick<MapNode, 'id' | 'name' | 'label' | 'typeLabel' | 'family'>[];
	wide: MiniGraphVariant;
	narrow: MiniGraphVariant;
	/** Neighbours not drawn. */
	hidden: number;
}

/**
 * The entity page's 1-hop mini-graph: the entity with its most relevant neighbours on a ring,
 * laid out here so the page ships a finished static picture (no client-side layout).
 */
export async function miniGraph(id: string, locale: Locale): Promise<MiniGraphData | undefined> {
	const graph = await mapGraph(locale);
	const index = indexGraph(graph);
	if (!index.byId.has(id)) return undefined;
	const wideChoice = chooseRing(index, id, 8, false, locale);
	if (wideChoice.shown.length === 0) return undefined;
	const narrowChoice = chooseRing(index, id, 6, false, locale);

	const variant = (shown: string[], width: number, height: number, radius: number) => {
		const slots = ringSlots(shown.length, radius);
		const nodes: SceneNode[] = [
			{
				id,
				x: 0,
				y: 0,
				tier: 1,
				side: shown.length === 1 ? 'left' : 'above',
				label: true,
				tone: 'focus'
			},
			...shown.map((n, i): SceneNode => {
				const slot = slots[i]!;
				return {
					id: n,
					x: slot.x,
					y: slot.y,
					tier: 3,
					side: slot.side,
					label: true,
					tone: 'normal'
				};
			})
		];
		const edges = shown.map((n): SceneEdge => ({
			key: pairKey(id, n),
			s: id,
			t: n,
			tone: 'strong'
		}));
		return { width, height, nodes, edges };
	};

	const drawn = new Set([id, ...wideChoice.shown, ...narrowChoice.shown]);
	return {
		nodes: graph.nodes
			.filter((n) => drawn.has(n.id))
			.map(({ id: nodeId, name, label, typeLabel, family }) => ({
				id: nodeId,
				name,
				label,
				typeLabel,
				family
			})),
		wide: variant(wideChoice.shown, 720, 380, 140),
		narrow: variant(narrowChoice.shown, 358, 300, 96),
		hidden: wideChoice.hidden
	};
}

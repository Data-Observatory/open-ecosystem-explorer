/**
 * Shapes shared by the map explorer's pure modules, its Svelte components and the server-side
 * payload builder (src/lib/server/map.ts). Plain serialisable data only.
 */
import type { MapThemeId, NodeFamily } from '../map/anchors.js';
import type { PredicateFamilyId } from '../model/types.js';

export type { MapThemeId, NodeFamily, PredicateFamilyId };

export interface MapNode {
	id: string;
	name: string;
	/** Canvas label: the entity's shortName when it has one, else its name. */
	label: string;
	type: string;
	typeLabel: string;
	family: NodeFamily;
	anchor: boolean;
	core: boolean;
	degree: number;
	/** Summary cut to about 25 words. */
	summary: string;
	/** Wikipedia link (via Wikidata), when the entity has a QID. */
	wp?: string;
	aka: string[];
	/** Build-time position (src/generated/graph-layout.json), used by expert mode. */
	x: number;
	y: number;
}

export interface MapEdge {
	/** Source (grammatical subject), predicate id, target, predicate family. */
	s: string;
	p: string;
	t: string;
	f: PredicateFamilyId;
}

export interface MapStoryStep {
	focus: string;
	reveal: string[];
	/** [source, predicate, target] */
	edges: [string, string, string][];
	text: string;
}

export interface MapStory {
	id: string;
	question: string;
	steps: MapStoryStep[];
}

export interface MapGraph {
	nodes: MapNode[];
	edges: MapEdge[];
	/** Predicate id -> verb in the page locale ("emite"). */
	predicates: Record<string, { label: string; symmetric: boolean }>;
	families: { id: PredicateFamilyId; label: string }[];
	themes: { id: MapThemeId; label: string; members: string[] }[];
	types: { id: string; label: string }[];
	stories: MapStory[];
}

export interface Point {
	x: number;
	y: number;
}

/** Where a node's label sits relative to its glyph. */
export type LabelSide = 'below' | 'above' | 'left' | 'right';

/** Model point at the centre of the free area, and screen pixels per model unit. */
export interface Camera {
	x: number;
	y: number;
	k: number;
}

/** Canvas size in CSS pixels and the parts of it covered by overlays (card, caption bar). */
export interface Viewport {
	w: number;
	h: number;
	inset: { top: number; right: number; bottom: number; left: number };
}

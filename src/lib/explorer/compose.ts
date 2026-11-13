/**
 * The starting view: a hand-composed picture of the anchors (map-ideas report, idea 2).
 * Open science sits in the centre; the four themes of src/lib/map/anchors.ts sit around it,
 * each with one hub and its members. Hand-tuned on purpose: with 14 nodes a composed picture
 * reads better than any automatic layout, and it never changes unless someone edits this file.
 * tests/unit/explorer/compose.test.ts checks that it covers exactly the anchors and that no two
 * nodes or labels sit on top of each other.
 *
 * Model units are CSS pixels at zoom 1. Two variants: landscape (desktop) and portrait (the
 * phone's map strip), same topology.
 */
import type { MapThemeId } from '../map/anchors.js';
import type { LabelSide, Point } from './types.js';

/**
 * Glyph size and label weight: 1 = an entry point, 2 = a theme hub, 3 = a member.
 *
 * Size marks where a newcomer can start reading, NOT hierarchy. Open science, open data and
 * open access share the top size on purpose: the graph says open data and open access are part
 * of open science (UNESCO 2021 Recommendation), but open data is also broader than science, so
 * no one of the three is drawn as "containing" the others. Open science keeps the centre and the
 * "start here" tag only because it has the most connections to the other themes.
 */
export type Tier = 1 | 2 | 3;

export interface ComposedNode extends Point {
	tier: Tier;
	side: LabelSide;
}

export interface Composition {
	nodes: Record<string, ComposedNode>;
	/** Where each theme's small-caps caption sits. */
	themes: Partial<Record<MapThemeId, Point>>;
}

const LANDSCAPE: Composition = {
	nodes: {
		'open-science': { x: 0, y: 0, tier: 1, side: 'below' },
		// Identify (west): the three identifiers hang between the concept and their metadata.
		'persistent-identifier': { x: -340, y: -125, tier: 2, side: 'above' },
		ror: { x: -505, y: 5, tier: 3, side: 'left' },
		orcid: { x: -385, y: 38, tier: 3, side: 'left' },
		doi: { x: -245, y: 5, tier: 3, side: 'right' },
		// Publish (north-east)
		'open-access': { x: 285, y: -120, tier: 1, side: 'above' },
		'diamond-open-access': { x: 470, y: -160, tier: 3, side: 'right' },
		preprint: { x: 95, y: -165, tier: 3, side: 'above' },
		'open-license': { x: 470, y: -62, tier: 3, side: 'right' },
		// Store and describe (south)
		'research-repository': { x: 175, y: 150, tier: 2, side: 'right' },
		metadata: { x: -335, y: 172, tier: 3, side: 'left' },
		'research-data-management': { x: -95, y: 205, tier: 3, side: 'below' },
		'open-data': { x: -125, y: 118, tier: 1, side: 'left' },
		// Measure and manage (east)
		cris: { x: 405, y: 55, tier: 2, side: 'right' },
		'citation-index': { x: 505, y: 160, tier: 3, side: 'below' }
	},
	themes: {
		identify: { x: -340, y: -190 },
		publish: { x: 285, y: -186 },
		data: { x: 215, y: 200 },
		'research-info': { x: 430, y: 10 }
	}
};

const PORTRAIT: Composition = {
	nodes: {
		'open-science': { x: 0, y: 0, tier: 1, side: 'below' },
		'persistent-identifier': { x: -105, y: -115, tier: 2, side: 'above' },
		ror: { x: -150, y: -50, tier: 3, side: 'below' },
		orcid: { x: -95, y: -22, tier: 3, side: 'below' },
		doi: { x: -55, y: -72, tier: 3, side: 'right' },
		'open-access': { x: 62, y: -110, tier: 1, side: 'above' },
		'diamond-open-access': { x: 140, y: -30, tier: 3, side: 'below' },
		'open-license': { x: 138, y: -86, tier: 3, side: 'below' },
		preprint: { x: -24, y: -128, tier: 3, side: 'above' },
		'research-repository': { x: 35, y: 88, tier: 2, side: 'below' },
		metadata: { x: -135, y: 78, tier: 3, side: 'below' },
		'research-data-management': { x: -62, y: 116, tier: 3, side: 'below' },
		'open-data': { x: -60, y: 46, tier: 1, side: 'below' },
		cris: { x: 128, y: 42, tier: 2, side: 'below' },
		'citation-index': { x: 132, y: 112, tier: 3, side: 'below' }
	},
	themes: {}
};

export function composition(portrait = false): Composition {
	return portrait ? PORTRAIT : LANDSCAPE;
}

/** Size tier of a node anywhere on the map: composed anchors keep theirs, the rest are members. */
export function tierOf(id: string): Tier {
	return LANDSCAPE.nodes[id]?.tier ?? 3;
}

import type { NodeFamily } from './types.js';

/**
 * Five node families, each with its own shape (NodeGlyph.svelte) AND colour, so colour is never
 * the only cue (WCAG 1.4.1). Every fill has at least 3:1 contrast on the white canvas
 * (tests/unit/explorer/palette.test.ts). Concepts take the page's ink colour: the starting view
 * is almost all concepts, and it should read as black on white with one blue accent.
 */
export const FAMILY_COLOR: Record<NodeFamily, string> = {
	concept: '#27272a', // zinc-800
	identifier: '#b45309', // amber-700
	service: '#0e7490', // cyan-700
	rule: '#be185d', // pink-700
	actor: '#6d28d9' // violet-700
};

/** The one accent on the canvas: selection, highlighted edges, focus rings (blue-600). */
export const ACCENT = '#2563eb';

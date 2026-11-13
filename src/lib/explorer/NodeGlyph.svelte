<script lang="ts">
	import { FAMILY_COLOR } from './palette';
	import type { NodeFamily } from './types';

	// One glyph, centred on (0, 0), `size` pixels across. An SVG fragment: use inside <svg>.
	let { family, size }: { family: NodeFamily; size: number } = $props();

	const r = $derived(size / 2);
	const polygon = (points: [number, number][]) =>
		points.map(([x, y]) => `${(x * r).toFixed(2)},${(y * r).toFixed(2)}`).join(' ');
</script>

{#if family === 'concept'}
	<circle class="glyph" {r} fill={FAMILY_COLOR.concept} />
{:else if family === 'identifier'}
	<polygon
		class="glyph"
		points={polygon([
			[0, -1.2],
			[1.2, 0],
			[0, 1.2],
			[-1.2, 0]
		])}
		fill={FAMILY_COLOR.identifier}
	/>
{:else if family === 'service'}
	<rect
		class="glyph"
		x={-r * 0.92}
		y={-r * 0.92}
		width={size * 0.92}
		height={size * 0.92}
		rx={size * 0.2}
		fill={FAMILY_COLOR.service}
	/>
{:else if family === 'rule'}
	<polygon
		class="glyph"
		points={polygon([
			[1.12, 0],
			[0.56, 0.97],
			[-0.56, 0.97],
			[-1.12, 0],
			[-0.56, -0.97],
			[0.56, -0.97]
		])}
		fill={FAMILY_COLOR.rule}
	/>
{:else}
	<polygon
		class="glyph"
		points={polygon([
			[0, -1.15],
			[1.15, 0.85],
			[-1.15, 0.85]
		])}
		fill={FAMILY_COLOR.actor}
	/>
{/if}

<style>
	.glyph {
		stroke: #fff;
		stroke-width: 2.5px;
		paint-order: stroke;
		stroke-linejoin: round;
	}
</style>

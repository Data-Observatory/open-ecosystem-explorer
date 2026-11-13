<script lang="ts">
	import type { ResolvedPathname } from '$app/types';
	import NodeGlyph from './NodeGlyph.svelte';
	import { nearestInDirection, project, wrapLabel, type Direction } from './geometry';
	import type { Geometry, SceneEdge, SceneNode } from './scene';
	import type { MapNode, Viewport } from './types';

	/**
	 * The SVG renderer, shared by the explorer (interactive) and the entity page's mini-graph
	 * (static). It draws a scene's nodes and edges at the positions in `geometry`, which the
	 * caller may be tweening. Glyphs and labels have fixed pixel sizes at every zoom.
	 *
	 * Every node is a real link to its entity page: without JavaScript, or with a modified
	 * click, it navigates there; with `onpick` a plain click selects the node instead.
	 */
	type NodeInfo = Pick<MapNode, 'id' | 'name' | 'label' | 'typeLabel' | 'family'>;

	let {
		nodes,
		edges,
		geometry,
		vp,
		info,
		href,
		label,
		describedby,
		captions = [],
		startTag,
		compact = false,
		dense = false,
		hotPair = null,
		hotNode = null,
		onpick,
		onhover
	}: {
		nodes: SceneNode[];
		edges: SceneEdge[];
		geometry: Geometry;
		vp: Viewport;
		info: (id: string) => NodeInfo | undefined;
		href: (id: string) => ResolvedPathname;
		label: string;
		describedby?: string;
		captions?: { id: string; text: string; x: number; y: number }[];
		/** "Start here" tag on a node of the starting view. */
		startTag?: { id: string; text: string };
		compact?: boolean;
		/** Expert mode: smaller glyphs, the whole corpus is on screen. */
		dense?: boolean;
		hotPair?: string | null;
		hotNode?: string | null;
		onpick?: (id: string) => void;
		onhover?: (id: string | null) => void;
	} = $props();

	let svg: SVGSVGElement | undefined = $state();
	let focused: string | null = $state(null);

	const specs = $derived(new Map(nodes.map((node) => [node.id, node])));
	// Nodes on their way out are no longer in `nodes` but still fade in `geometry`: keep their
	// last look until the transition drops them.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a plain cache, read only while rendering
	const ghosts = new Map<string, SceneNode>();
	$effect(() => {
		for (const node of nodes) ghosts.set(node.id, node);
	});

	const SIZES = { roomy: [28, 18, 12], compact: [22, 14, 10], dense: [18, 12, 8] } as const;
	const sizeOf = (tier: 1 | 2 | 3) =>
		(dense ? SIZES.dense : compact ? SIZES.compact : SIZES.roomy)[tier - 1] ?? 12;
	const FONT = { roomy: [18, 15, 13], compact: [14, 12.5, 12] } as const;
	const fontOf = (tier: 1 | 2 | 3) =>
		(compact || dense ? FONT.compact : FONT.roomy)[tier - 1] ?? 13;

	const MARGIN = 80;
	const drawn = $derived.by(() => {
		const out = [];
		for (const [id, at] of Object.entries(geometry.nodes)) {
			const spec = specs.get(id) ?? ghosts.get(id);
			const meta = info(id);
			if (!spec || !meta) continue;
			const screen = project({ x: at[0], y: at[1] }, geometry.cam, vp);
			// Culling: nothing outside the canvas is drawn (expert mode, zoomed in).
			if (
				screen.x < -MARGIN ||
				screen.y < -MARGIN ||
				screen.x > vp.w + MARGIN ||
				screen.y > vp.h + MARGIN
			)
				continue;
			out.push({ id, spec, meta, x: screen.x, y: screen.y, o: at[2], live: specs.has(id) });
		}
		return out;
	});
	const at = $derived(new Map(drawn.map((node) => [node.id, node])));

	const lines = $derived(
		edges.flatMap((edge) => {
			const a = at.get(edge.s);
			const b = at.get(edge.t);
			if (!a || !b) return [];
			const hot = hotPair === edge.key || hotNode === edge.s || hotNode === edge.t;
			return [{ ...edge, x1: a.x, y1: a.y, x2: b.x, y2: b.y, o: Math.min(a.o, b.o), hot }];
		})
	);

	// Roving tabindex: the canvas is one tab stop; arrow keys move between nodes.
	const tabStop = $derived(
		(focused && specs.has(focused) ? focused : undefined) ??
			nodes.find((node) => node.tone === 'focus')?.id ??
			nodes.find((node) => node.tier === 1)?.id ??
			nodes[0]?.id
	);

	const ARROWS: Record<string, Direction> = {
		ArrowLeft: 'left',
		ArrowRight: 'right',
		ArrowUp: 'up',
		ArrowDown: 'down'
	};

	function onkeydown(event: KeyboardEvent) {
		const direction = ARROWS[event.key];
		const from = focused ? at.get(focused) : undefined;
		if (!direction || !from || event.altKey || event.ctrlKey || event.metaKey) return;
		event.preventDefault();
		const next = nearestInDirection(
			from,
			direction,
			drawn.filter((node) => node.live && node.id !== from.id)
		);
		if (next) svg?.querySelector<SVGAElement>(`[data-node-id="${next.id}"]`)?.focus();
	}

	function onclick(event: MouseEvent, id: string) {
		if (!onpick || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return;
		event.preventDefault();
		onpick(id);
	}

	function labelLayout(spec: SceneNode, text: string) {
		const size = sizeOf(spec.tier);
		const font = fontOf(spec.tier);
		const linesOf = wrapLabel(
			text,
			// On phones side labels have the least room: wrap them sooner.
			compact ? (spec.side === 'left' || spec.side === 'right' ? 13 : 16) : 18
		);
		const lh = Math.round(font * 1.18);
		const gap = size / 2 + (spec.tone === 'focus' ? 14 : 7);
		const n = linesOf.length;
		if (spec.side === 'below')
			return { lines: linesOf, x: 0, y: gap + font * 0.82, lh, anchor: 'middle' as const };
		if (spec.side === 'above')
			return {
				lines: linesOf,
				x: 0,
				y: -gap - (n - 1) * lh - font * 0.18,
				lh,
				anchor: 'middle' as const
			};
		const y = -((n - 1) * lh) / 2 + font * 0.35;
		return spec.side === 'right'
			? { lines: linesOf, x: gap + 2, y, lh, anchor: 'start' as const }
			: { lines: linesOf, x: -gap - 2, y, lh, anchor: 'end' as const };
	}
</script>

<!-- arrow keys move between the node links inside this group -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<svg
	bind:this={svg}
	viewBox="0 0 {vp.w} {vp.h}"
	preserveAspectRatio="xMidYMid meet"
	role="group"
	aria-label={label}
	aria-describedby={describedby}
	class={['map-canvas block h-full w-full select-none', dense && 'dense']}
	{onkeydown}
	data-testid="map-canvas"
>
	<g aria-hidden="true">
		{#each lines as line (line.key)}
			<line
				x1={line.x1}
				y1={line.y1}
				x2={line.x2}
				y2={line.y2}
				opacity={line.o}
				class={['edge', line.hot ? 'accent' : line.tone]}
				data-edge={line.key}
				data-hot={line.hot ? '' : undefined}
			/>
		{/each}
		{#each captions as caption (caption.id)}
			{@const screen = project(caption, geometry.cam, vp)}
			<text class="caption" x={screen.x} y={screen.y} text-anchor="middle">{caption.text}</text>
		{/each}
	</g>

	{#each drawn as node (node.id)}
		{@const text = labelLayout(node.spec, node.meta.label)}
		{@const size = sizeOf(node.spec.tier)}
		<g
			transform="translate({node.x.toFixed(1)} {node.y.toFixed(1)})"
			opacity={node.o * (node.spec.tone === 'muted' ? (dense ? 0.22 : 0.45) : 1)}
		>
			<a
				href={href(node.id)}
				class={['node', `tier-${node.spec.tier}`, node.spec.tone]}
				data-node-id={node.id}
				data-tone={node.spec.tone}
				aria-label="{node.meta.name} ({node.meta.typeLabel})"
				aria-current={node.spec.tone === 'focus' ? 'true' : undefined}
				tabindex={node.live && node.id === tabStop ? 0 : -1}
				onclick={(event) => onclick(event, node.id)}
				onfocus={() => (focused = node.id)}
				onpointerenter={() => onhover?.(node.id)}
				onpointerleave={() => onhover?.(null)}
			>
				<circle class="hit" r={dense ? 13 : 22} />
				{#if node.spec.tone === 'focus'}
					<circle class="halo" r={size / 2 + 7} />
				{/if}
				<NodeGlyph family={node.meta.family} {size} />
				{#if node.spec.label}
					{#if node.spec.tone === 'focus'}
						{@const font = fontOf(node.spec.tier)}
						{@const w = Math.max(...text.lines.map((l) => l.length)) * font * 0.62 + 14}
						<rect
							class="plate"
							x={text.anchor === 'middle'
								? text.x - w / 2
								: text.anchor === 'start'
									? text.x - 6
									: text.x - w + 6}
							y={text.y - font}
							width={w}
							height={text.lines.length * text.lh + 6}
							rx="6"
						/>
					{/if}
					<text
						class="label"
						x={text.x}
						y={text.y}
						text-anchor={text.anchor}
						font-size={fontOf(node.spec.tier)}
					>
						{#each text.lines as line, i (i)}
							<tspan x={text.x} dy={i === 0 ? 0 : text.lh}>{line}</tspan>
						{/each}
					</text>
				{/if}
				{#if startTag && startTag.id === node.id}
					<g class="start-tag" transform="translate(0 {-(size / 2 + 11)})">
						<path d="M-5 -1 L0 5 L5 -1 Z" />
						<rect
							x={-startTag.text.length * 3.4 - 10}
							y="-22"
							width={startTag.text.length * 6.8 + 20}
							height="22"
							rx="11"
						/>
						<text y="-7" text-anchor="middle">{startTag.text}</text>
					</g>
				{/if}
			</a>
		</g>
	{/each}
</svg>

<style>
	.edge {
		stroke: var(--color-zinc-300);
		stroke-width: 1.25px;
		stroke-linecap: round;
		transition:
			stroke 150ms ease-out,
			stroke-width 150ms ease-out;
	}
	.edge.strong {
		stroke: var(--color-zinc-400);
		stroke-width: 1.5px;
	}
	.edge.faint {
		stroke: var(--color-zinc-200);
		stroke-width: 1px;
	}
	.edge.accent {
		stroke: var(--color-blue-600);
		stroke-width: 2px;
	}
	.dense .edge.quiet {
		stroke-width: 1px;
	}

	.caption {
		font-family: var(--font-heading);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		fill: var(--color-zinc-500);
		paint-order: stroke;
		stroke: #fff;
		stroke-width: 4px;
	}

	.node {
		cursor: pointer;
		outline: none;
	}
	.hit {
		fill: transparent;
		stroke: transparent;
		stroke-width: 2px;
	}
	.node:focus-visible .hit {
		stroke: var(--color-blue-600);
	}
	.halo {
		fill: color-mix(in srgb, var(--color-blue-600) 12%, transparent);
		stroke: var(--color-blue-600);
		stroke-width: 1.5px;
	}
	.label {
		font-family: var(--font-sans);
		font-weight: 500;
		fill: var(--color-zinc-600);
		paint-order: stroke;
		stroke: #fff;
		stroke-width: 4px;
		stroke-linejoin: round;
		transition: fill 150ms ease-out;
	}
	.tier-1 .label,
	.tier-2 .label {
		font-weight: 600;
		fill: var(--color-zinc-800);
	}
	.plate {
		fill: #fff;
	}
	.tier-1 .label {
		font-family: var(--font-heading);
		fill: var(--color-zinc-900);
	}
	.node:hover .label,
	.node:focus-visible .label {
		fill: var(--color-blue-700);
	}

	.start-tag path,
	.start-tag rect {
		fill: var(--color-blue-600);
	}
	.start-tag text {
		font-family: var(--font-sans);
		font-size: 11.5px;
		font-weight: 600;
		fill: #fff;
	}
</style>

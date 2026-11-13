<script lang="ts">
	import type { ResolvedPathname } from '$app/types';
	import { localeHref } from '$lib/paths';
	import type { Locale } from '$lib/locale';
	import * as m from '$lib/paraglide/messages';
	import type { MiniGraphData, MiniGraphVariant } from '$lib/server/map';
	import MapCanvas from './MapCanvas.svelte';
	import { geometryOf } from './scene';

	/**
	 * The entity page's 1-hop mini-graph: the same renderer as the map, in static mode. The
	 * layout comes from the server, so this is a finished picture in the HTML: every node is a
	 * link to its entity page and nothing here needs JavaScript. Two variants (wide, narrow) are
	 * rendered and CSS shows the one that fits.
	 */
	let {
		graph,
		id,
		name,
		locale
	}: { graph: MiniGraphData; id: string; name: string; locale: Locale } = $props();

	const info = $derived(new Map(graph.nodes.map((node) => [node.id, node])));
	const variants = $derived([
		{ variant: graph.wide, compact: false, class: 'hidden sm:block' },
		{ variant: graph.narrow, compact: true, class: 'sm:hidden' }
	]);
	const geometry = (variant: MiniGraphVariant) =>
		geometryOf({
			kind: 'focus',
			nodes: variant.nodes,
			edges: variant.edges,
			captions: [],
			cam: { x: 0, y: 0, k: 1 },
			origin: { x: 0, y: 0 },
			hidden: 0
		});
	const mapHref = $derived(`${localeHref(locale)}?n=${id}` as ResolvedPathname);
</script>

<figure class="mt-4" data-testid="mini-graph">
	{#each variants as { variant, compact, class: className } (compact)}
		<div
			class={[className, 'overflow-hidden rounded-2xl ring-1 ring-zinc-200']}
			style="aspect-ratio: {variant.width} / {variant.height}"
		>
			<MapCanvas
				nodes={variant.nodes}
				edges={variant.edges}
				geometry={geometry(variant)}
				vp={{
					w: variant.width,
					h: variant.height,
					inset: { top: 0, right: 0, bottom: 0, left: 0 }
				}}
				info={(node) => info.get(node)}
				href={(node) => localeHref(locale, `entity/${node}`)}
				label={m.entity_minigraph_label({ name })}
				{compact}
			/>
		</div>
	{/each}
	<figcaption class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
		{#if graph.hidden > 0}
			<span>{m.entity_minigraph_more({ n: graph.hidden })}</span>
		{/if}
		<a
			href={mapHref}
			class="font-medium text-blue-700 underline decoration-blue-700/40 underline-offset-2 hover:text-blue-900"
			data-requires-js
			data-testid="see-on-map">{m.entity_see_on_map()} <span aria-hidden="true">→</span></a
		>
	</figcaption>
</figure>

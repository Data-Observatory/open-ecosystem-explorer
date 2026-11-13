<script lang="ts">
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import { localeHref } from '$lib/paths';
	import type { Locale } from '$lib/locale';
	import * as m from '$lib/paraglide/messages';
	import NodeGlyph from './NodeGlyph.svelte';
	import type { MapStore } from './store.svelte';

	/**
	 * The card: the primary way to read the map (map-ideas report, idea 4). Relations are plain
	 * sentences grouped by family; hovering or focusing one highlights its edge on the canvas,
	 * and choosing it moves the map there. On phones the card is the page itself, under the map.
	 */
	let {
		store,
		locale,
		onpick,
		title = $bindable()
	}: {
		store: MapStore;
		locale: Locale;
		onpick: (id: string) => void;
		/** The heading element, so the explorer can move focus to it. */
		title?: HTMLElement;
	} = $props();

	const node = $derived(store.selected);
	const previous = $derived(
		store.trail.length > 1 ? store.index.byId.get(store.trail.at(-2) ?? '') : undefined
	);
	const total = $derived(store.sentences.length);
	const shown = $derived(store.groups.reduce((sum, group) => sum + group.sentences.length, 0));
</script>

{#if node}
	<aside
		aria-labelledby="map-card-title"
		data-testid="map-card"
		class="z-10 mt-4 @3xl:absolute @3xl:top-16 @3xl:right-4 @3xl:mt-0 @3xl:flex @3xl:max-h-[calc(100%-5rem)] @3xl:w-[22rem] @3xl:flex-col @3xl:rounded-2xl @3xl:bg-white @3xl:shadow-lg @3xl:ring-1 @3xl:shadow-zinc-900/5 @3xl:ring-zinc-200"
	>
		<div class="flex items-center justify-between gap-2 @3xl:px-5 @3xl:pt-4">
			<button
				type="button"
				class="-ml-2 inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
				onclick={() => store.back()}
				data-testid="map-back"
			>
				<span aria-hidden="true">←</span>
				{previous ? m.map_back_to({ name: previous.label }) : m.map_trail_start()}
			</button>
			<button
				type="button"
				class="-mr-2 hidden h-9 w-9 items-center justify-center rounded-full text-xl leading-none text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 @3xl:inline-flex"
				aria-label={m.map_close()}
				onclick={() => store.select(null)}
				data-testid="map-close"
			>
				<span aria-hidden="true">×</span>
			</button>
		</div>

		<div class="pt-2 @3xl:overflow-y-auto @3xl:px-5 @3xl:pb-5">
			<p class="flex items-center gap-2 text-xs font-medium tracking-wide text-zinc-600 uppercase">
				<svg
					viewBox="-8 -8 16 16"
					class="h-3.5 w-3.5 shrink-0"
					aria-hidden="true"
					focusable="false"
				>
					<NodeGlyph family={node.family} size={11} />
				</svg>
				{node.typeLabel}
			</p>
			<h2
				id="map-card-title"
				bind:this={title}
				tabindex="-1"
				class="mt-1 font-heading text-2xl font-semibold tracking-tight break-words text-zinc-900 focus:outline-none"
			>
				{node.name}
			</h2>
			<p class="mt-2 leading-relaxed text-zinc-700">{node.summary}</p>

			{#each store.groups as group (group.family)}
				<h3 class="mt-5 text-xs font-semibold tracking-wide text-zinc-600 uppercase">
					{group.label}
				</h3>
				<ul class="mt-1" data-testid="map-sentences">
					{#each group.sentences as sentence, i (i)}
						<li>
							<button
								type="button"
								class="sentence group -mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center gap-2 rounded-lg px-2 py-1.5 text-left leading-snug text-zinc-600 hover:bg-blue-50 focus-visible:bg-blue-50 @3xl:min-h-9"
								data-pair={sentence.pair}
								onclick={() => onpick(sentence.other.id)}
								onpointerenter={() => (store.hotPair = sentence.pair)}
								onpointerleave={() => (store.hotPair = null)}
								onfocus={() => (store.hotPair = sentence.pair)}
								onblur={() => (store.hotPair = null)}
							>
								<span class="flex-1">
									{#if sentence.selfIsSubject}
										{node.label}
										{sentence.verb}
										<strong class="font-semibold text-zinc-900">{sentence.other.name}</strong>
									{:else}
										<strong class="font-semibold text-zinc-900">{sentence.other.name}</strong>
										{sentence.verb}
										{node.label}
									{/if}
								</span>
								<span
									aria-hidden="true"
									class="text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600"
									>→</span
								>
							</button>
						</li>
					{/each}
				</ul>
			{/each}

			{#if store.scene.kind === 'focus' && total > shown}
				<button
					type="button"
					class="mt-4 inline-flex min-h-9 items-center rounded-full px-4 text-sm font-medium text-zinc-800 ring-1 ring-zinc-300 hover:bg-zinc-100"
					onclick={() => store.toggleExpanded()}
					data-testid="map-more"
				>
					{m.map_more_label({ n: store.scene.hidden })}
				</button>
			{:else if store.expanded}
				<button
					type="button"
					class="mt-4 inline-flex min-h-9 items-center rounded-full px-4 text-sm font-medium text-zinc-800 ring-1 ring-zinc-300 hover:bg-zinc-100"
					onclick={() => store.toggleExpanded()}
					data-testid="map-fewer"
				>
					{m.map_show_fewer()}
				</button>
			{/if}

			<p
				class="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-zinc-100 pt-4 text-sm font-medium"
			>
				<a
					href={localeHref(locale, `entity/${node.id}`)}
					class="text-blue-700 underline decoration-blue-700/40 underline-offset-2 hover:text-blue-900"
					data-testid="map-entry-link">{m.map_see_entry()} <span aria-hidden="true">→</span></a
				>
				{#if node.wp}
					<ExternalLink
						href={node.wp}
						class="text-blue-700 underline decoration-blue-700/40 underline-offset-2 hover:text-blue-900"
						>{m.map_wikipedia()} <span aria-hidden="true">↗</span></ExternalLink
					>
				{/if}
			</p>
		</div>
	</aside>
{/if}

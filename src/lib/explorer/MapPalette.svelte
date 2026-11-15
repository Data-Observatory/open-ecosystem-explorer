<script lang="ts">
	import { tick } from 'svelte';
	import * as m from '#lib/paraglide/messages.js';
	import NodeGlyph from './NodeGlyph.svelte';
	import { fold, searchScore } from './graph';
	import type { MapStore } from './store.svelte';

	/**
	 * Search as a command palette (map-ideas report, idea 11): `/` opens it, it lists entries and
	 * the guided stories, Enter goes there. A native modal <dialog>: focus is trapped and Escape
	 * closes it without any code here.
	 */
	let {
		store,
		onpick,
		onstory
	}: { store: MapStore; onpick: (id: string) => void; onstory: (id: string) => void } = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let input: HTMLInputElement | undefined = $state();
	let query = $state('');
	let active = $state(0);

	type Option =
		| { kind: 'story'; id: string; title: string }
		| { kind: 'entry'; id: string; title: string; type: string; summary: string };

	const options = $derived.by((): Option[] => {
		const needle = fold(query.trim());
		const stories = store.index.graph.stories
			.filter((story) => !needle || fold(story.question).includes(needle))
			.map((story): Option => ({ kind: 'story', id: story.id, title: story.question }));
		if (!needle) return stories;
		const entries = store.index.graph.nodes
			.map((node) => ({ node, score: searchScore(node, needle) }))
			.filter((hit) => hit.score > 0)
			.sort(
				(a, b) =>
					b.score - a.score ||
					Number(b.node.anchor) - Number(a.node.anchor) ||
					b.node.degree - a.node.degree ||
					a.node.name.localeCompare(b.node.name, store.locale)
			)
			.slice(0, 8)
			.map(({ node }): Option => ({
				kind: 'entry',
				id: node.id,
				title: node.name,
				type: node.typeLabel,
				summary: node.summary
			}));
		return [...entries, ...stories];
	});

	$effect(() => {
		if (!dialog) return;
		if (store.paletteOpen && !dialog.open) {
			query = '';
			active = 0;
			dialog.showModal();
			void tick().then(() => input?.focus());
		} else if (!store.paletteOpen && dialog.open) {
			dialog.close();
		}
	});

	function choose(option: Option | undefined) {
		if (!option) return;
		store.paletteOpen = false;
		if (option.kind === 'story') onstory(option.id);
		else onpick(option.id);
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const n = options.length;
			if (n > 0) active = (active + (event.key === 'ArrowDown' ? 1 : n - 1)) % n;
			void tick().then(() =>
				dialog?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
			);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			choose(options[active]);
		}
	}

	const firstStory = $derived(options.findIndex((option) => option.kind === 'story'));
	const firstEntry = $derived(options.findIndex((option) => option.kind === 'entry'));
</script>

<dialog
	bind:this={dialog}
	aria-label={m.map_search_label()}
	data-testid="map-palette"
	class="m-auto mt-[12vh] w-[min(36rem,calc(100vw-2rem))] rounded-2xl bg-white p-0 text-zinc-800 shadow-2xl ring-1 ring-zinc-200 backdrop:bg-zinc-900/30"
	onclose={() => (store.paletteOpen = false)}
	onclick={(event) => {
		if (event.target === dialog) store.paletteOpen = false;
	}}
>
	<div class="flex items-center gap-3 border-b border-zinc-200 px-4">
		<svg viewBox="0 0 20 20" class="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" fill="none">
			<circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="1.75" />
			<path d="m14 14 4 4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
		</svg>
		<input
			bind:this={input}
			bind:value={query}
			oninput={() => (active = 0)}
			{onkeydown}
			type="text"
			style="outline: none"
			autocomplete="off"
			spellcheck="false"
			role="combobox"
			aria-expanded="true"
			aria-controls="map-palette-list"
			aria-autocomplete="list"
			aria-activedescendant={options[active] ? `map-option-${active}` : undefined}
			aria-label={m.map_search_label()}
			placeholder={m.map_search_placeholder()}
			class="h-14 min-w-0 flex-1 bg-transparent text-base text-zinc-900 placeholder:text-zinc-500 focus:outline-none"
			data-testid="map-palette-input"
		/>
		<kbd class="rounded border border-zinc-300 px-1.5 py-0.5 text-xs text-zinc-600">Esc</kbd>
	</div>
	<ul
		id="map-palette-list"
		role="listbox"
		aria-label={m.map_search_label()}
		class="max-h-[min(24rem,55vh)] overflow-y-auto p-2"
	>
		{#each options as option, i (option.kind + option.id)}
			{#if i === firstEntry || i === firstStory}
				<li
					role="presentation"
					class="px-3 pt-3 pb-1 text-xs font-semibold tracking-wide text-zinc-600 uppercase"
				>
					{option.kind === 'story' ? m.map_palette_stories() : m.map_palette_entries()}
				</li>
			{/if}
			<!-- keyboard goes through the combobox input (aria-activedescendant) -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<li
				id="map-option-{i}"
				role="option"
				aria-selected={i === active}
				class={[
					'flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2',
					i === active && 'bg-blue-50'
				]}
				data-option-kind={option.kind}
				data-option-id={option.id}
				onclick={() => choose(option)}
				onpointermove={() => (active = i)}
			>
				{#if option.kind === 'entry'}
					{@const node = store.index.byId.get(option.id)}
					<svg viewBox="-8 -8 16 16" class="mt-1 h-4 w-4 shrink-0" aria-hidden="true">
						{#if node}<NodeGlyph family={node.family} size={11} />{/if}
					</svg>
					<span class="min-w-0">
						<span class="font-medium text-zinc-900">{option.title}</span>
						<span class="ml-1 text-sm text-zinc-600">{option.type}</span>
						<span class="block truncate text-sm text-zinc-600">{option.summary}</span>
					</span>
				{:else}
					<span class="mt-0.5 text-blue-600" aria-hidden="true">▸</span>
					<span class="text-zinc-900">{option.title}</span>
				{/if}
			</li>
		{:else}
			<li role="presentation" class="px-3 py-6 text-center text-sm text-zinc-600">
				{m.map_no_results()}
			</li>
		{/each}
	</ul>
	<p class="border-t border-zinc-200 px-5 py-2.5 text-xs text-zinc-600">{m.map_palette_hint()}</p>
</dialog>

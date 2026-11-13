<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import type { ResolvedPathname } from '$app/types';
	import { pagePath } from '$lib/locale';
	import {
		filterFromQuery,
		filterToQuery,
		isFilterActive,
		matchesFilter,
		type GlossaryFilter
	} from '$lib/glossary-filter';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();
	const href = (path = '') => pagePath(base, data.locale, path) as ResolvedPathname;

	// Progressive enhancement: the prerendered page lists every entry. The filter is read from
	// the query string after mount (prerendering has none) and written back with replaceState.
	let query = $state('');
	const selectedTypes = new SvelteSet<string>();
	const filter = $derived<GlossaryFilter>({ query, types: [...selectedTypes] });
	const active = $derived(isFilterActive(filter));
	const visibleIds = $derived(
		new Set(data.entries.filter((entry) => matchesFilter(entry, filter)).map((entry) => entry.id))
	);

	const groups = $derived.by(() => {
		const byLetter: Record<string, typeof data.entries> = {};
		for (const entry of data.entries) (byLetter[entry.letter] ??= []).push(entry);
		return Object.entries(byLetter)
			.sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))
			.map(([letter, entries]) => ({ letter, entries }));
	});
	const letterId = (letter: string) => (letter === '#' ? 'letter-other' : `letter-${letter}`);

	onMount(() => {
		const initial = filterFromQuery(
			new URLSearchParams(window.location.search),
			data.types.map((t) => t.id)
		);
		query = initial.query;
		for (const type of initial.types) selectedTypes.add(type);
	});

	function syncUrl() {
		const params = filterToQuery(filter).toString();
		const url = new URL(page.url);
		url.search = params;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- same page, only the query changes
		replaceState(url, page.state);
	}

	function toggleType(type: string) {
		if (selectedTypes.has(type)) selectedTypes.delete(type);
		else selectedTypes.add(type);
		syncUrl();
	}

	function clear() {
		query = '';
		selectedTypes.clear();
		syncUrl();
	}
</script>

<svelte:head>
	<title>{m.glossary_title()} · {m.site_name()}</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 pb-8 sm:px-6">
	<header class="pt-6 pb-6 sm:pt-10">
		<h1 class="font-heading text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
			{m.glossary_title()}
		</h1>
		<p class="mt-3 text-lg font-light text-zinc-700">{m.glossary_intro()}</p>
	</header>

	<div
		data-requires-js
		data-testid="glossary-filter"
		class="rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200 sm:p-5"
	>
		<label for="glossary-q" class="block text-sm font-medium text-zinc-800">
			{m.glossary_filter_label()}
		</label>
		<input
			id="glossary-q"
			type="search"
			autocomplete="off"
			bind:value={query}
			oninput={syncUrl}
			placeholder={m.glossary_filter_placeholder()}
			class="mt-2 w-full rounded-full border-0 bg-white px-4 py-2.5 text-base text-zinc-900 ring-1 ring-zinc-300 placeholder:text-zinc-500 focus:ring-2 focus:ring-blue-600"
		/>

		<div
			role="group"
			aria-label={m.glossary_types_label()}
			class="mt-4 flex flex-wrap gap-2"
			data-testid="type-chips"
		>
			{#each data.types as type (type.id)}
				<button
					type="button"
					aria-pressed={selectedTypes.has(type.id)}
					data-type={type.id}
					onclick={() => toggleType(type.id)}
					class={[
						'rounded-full px-3 py-1.5 text-sm transition-colors',
						selectedTypes.has(type.id)
							? 'bg-blue-600 text-white'
							: 'bg-white text-zinc-800 ring-1 ring-zinc-300 hover:bg-zinc-100'
					]}
				>
					{type.label} <span class="tabular-nums opacity-80">({type.count})</span>
				</button>
			{/each}
		</div>

		<div class="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
			<p role="status" data-testid="glossary-count" class="text-zinc-700">
				{m.glossary_count({ shown: visibleIds.size, total: data.entries.length })}
			</p>
			{#if active}
				<button
					type="button"
					onclick={clear}
					class="rounded-full px-3 py-1.5 text-zinc-800 underline underline-offset-2 hover:bg-zinc-100"
				>
					{m.glossary_clear()}
				</button>
			{/if}
		</div>
	</div>

	<nav aria-label={m.glossary_letters_label()} class="mt-6">
		<ul class="flex flex-wrap gap-1 text-sm">
			{#each groups as group (group.letter)}
				{@const shown = group.entries.some((entry) => visibleIds.has(entry.id))}
				<li>
					<a
						href={`#${letterId(group.letter)}`}
						class={[
							'inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 font-medium',
							shown ? 'text-blue-700 hover:bg-blue-50' : 'pointer-events-none text-zinc-500'
						]}
						aria-disabled={shown ? undefined : 'true'}
						tabindex={shown ? undefined : -1}
					>
						{group.letter}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	{#if visibleIds.size === 0}
		<p class="mt-8 text-zinc-700" data-testid="glossary-empty">{m.glossary_empty()}</p>
	{/if}

	{#each groups as group (group.letter)}
		{@const shown = group.entries.some((entry) => visibleIds.has(entry.id))}
		<section
			id={letterId(group.letter)}
			aria-labelledby={`${letterId(group.letter)}-h`}
			hidden={!shown}
			class="mt-8 scroll-mt-24"
		>
			<h2
				id={`${letterId(group.letter)}-h`}
				class="border-b border-zinc-200 pb-1 font-heading text-xl font-semibold text-zinc-900"
			>
				{group.letter}
			</h2>
			<ul class="divide-y divide-zinc-100">
				{#each group.entries as entry (entry.id)}
					<li
						data-testid="glossary-entry"
						data-entry-id={entry.id}
						data-type={entry.type}
						hidden={!visibleIds.has(entry.id)}
						class="py-3"
					>
						<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
							<a
								href={href(`entity/${entry.id}`)}
								class="font-medium text-blue-700 underline decoration-blue-700/30 underline-offset-2 hover:text-blue-900"
							>
								{entry.name}
							</a>
							<span class="text-xs tracking-wide text-zinc-600 uppercase">{entry.typeLabel}</span>
						</div>
						<p class="mt-1 text-sm leading-relaxed text-zinc-700">{entry.summary}</p>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>

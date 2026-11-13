<script lang="ts">
	import { localeHref } from '$lib/paths';
	import type { Locale } from '$lib/locale';
	import * as m from '$lib/paraglide/messages';
	import NodeGlyph from './NodeGlyph.svelte';
	import type { MapStore } from './store.svelte';

	/**
	 * The map as text. Two shapes:
	 *  - `themes`: the starting view as theme headings with their members. On phones this is the
	 *    page under the map strip (list-first, idea 8); it is hidden on wide screens, where the
	 *    canvas nodes are the same links.
	 *  - `table`: expert mode's list view of everything the filters leave on the map.
	 * Rows are links to the entity page that select the node on the map when JavaScript runs.
	 */
	let {
		store,
		locale,
		mode,
		onpick
	}: {
		store: MapStore;
		locale: Locale;
		mode: 'themes' | 'table';
		onpick: (id: string) => void;
	} = $props();

	const themes = $derived(
		store.index.graph.themes.map((theme) => ({
			...theme,
			nodes: theme.members.flatMap((id) => store.index.byId.get(id) ?? [])
		}))
	);

	const rows = $derived.by(() => {
		const shown = new Set(store.scene.nodes.map((node) => node.id));
		return store.index.graph.nodes
			.filter((node) => shown.has(node.id))
			.sort((a, b) => a.name.localeCompare(b.name, locale, { sensitivity: 'base' }));
	});

	function click(event: MouseEvent, id: string) {
		if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return;
		event.preventDefault();
		onpick(id);
	}
</script>

{#if mode === 'themes'}
	<nav aria-label={m.map_themes_heading()} class="mt-4 @3xl:hidden" data-testid="map-themes">
		{#each themes as theme (theme.id)}
			{#if theme.id !== 'centre'}
				<h3 class="mt-5 text-xs font-semibold tracking-wide text-zinc-600 uppercase">
					{theme.label}
				</h3>
			{/if}
			<ul class="mt-1 divide-y divide-zinc-100">
				{#each theme.nodes as node (node.id)}
					<li>
						<a
							href={localeHref(locale, `entity/${node.id}`)}
							class="flex min-h-12 items-center gap-3 py-2 text-zinc-900"
							data-theme-node={node.id}
							onclick={(event) => click(event, node.id)}
						>
							<svg viewBox="-8 -8 16 16" class="h-4 w-4 shrink-0" aria-hidden="true">
								<NodeGlyph family={node.family} size={11} />
							</svg>
							<span
								class={['flex-1', theme.id === 'centre' && 'font-heading text-lg font-semibold']}
								>{node.name}</span
							>
							<span aria-hidden="true" class="text-zinc-400">→</span>
						</a>
					</li>
				{/each}
			</ul>
		{/each}
	</nav>
{:else}
	<div class="px-4 pb-4 @3xl:px-6" data-testid="map-table">
		<p class="text-sm text-zinc-600" data-testid="map-count">
			{m.map_count({ n: rows.length, total: store.index.graph.nodes.length })}
		</p>
		<table class="mt-2 w-full text-left text-sm">
			<caption class="sr-only">{m.map_list_caption()}</caption>
			<thead>
				<tr class="border-b border-zinc-200 text-xs tracking-wide text-zinc-600 uppercase">
					<th scope="col" class="py-2 pr-3 font-semibold">{m.map_col_name()}</th>
					<th scope="col" class="py-2 pr-3 font-semibold">{m.map_col_type()}</th>
					<th scope="col" class="py-2 text-right font-semibold">{m.map_col_links()}</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as node (node.id)}
					<tr class="border-b border-zinc-100">
						<th scope="row" class="py-1.5 pr-3 font-medium">
							<a
								href={localeHref(locale, `entity/${node.id}`)}
								class="inline-flex min-h-6 items-center gap-2 text-zinc-900 hover:text-blue-700"
								aria-current={store.selected?.id === node.id ? 'true' : undefined}
								data-row-node={node.id}
								onclick={(event) => click(event, node.id)}
							>
								<svg viewBox="-8 -8 16 16" class="h-3.5 w-3.5 shrink-0" aria-hidden="true">
									<NodeGlyph family={node.family} size={11} />
								</svg>
								{node.name}
							</a>
						</th>
						<td class="py-1.5 pr-3 text-zinc-700">{node.typeLabel}</td>
						<td class="py-1.5 text-right text-zinc-700 tabular-nums">{node.degree}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

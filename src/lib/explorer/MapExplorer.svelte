<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { Tween, prefersReducedMotion } from 'svelte/motion';
	import { afterNavigate } from '$app/navigation';
	import { CENTRE_ANCHOR_ID } from '#lib/map/anchors.ts';
	import { localeHref } from '#lib/paths.ts';
	import type { Locale } from '#lib/locale.ts';
	import * as m from '#lib/paraglide/messages.js';
	import MapCanvas from './MapCanvas.svelte';
	import MapCard from './MapCard.svelte';
	import MapList from './MapList.svelte';
	import MapPalette from './MapPalette.svelte';
	import StoryBar from './StoryBar.svelte';
	import { indexGraph } from './graph';
	import { geometryOf, interpolateGeometry } from './scene';
	import { MapStore } from './store.svelte';
	import type { MapGraph } from './types';

	/**
	 * The map explorer: toolbar, canvas, card, story caption, list views and search palette
	 * around one MapStore. See docs/architecture.md ("The map") for the design.
	 */
	let { graph, locale }: { graph: MapGraph; locale: Locale } = $props();

	// The payload and locale never change while the component is mounted (a locale switch is a
	// full page load), so the store is built once.
	const store = untrack(
		() =>
			new MapStore(indexGraph(graph), locale, localeHref(locale), {
				selected: (name, n) => m.map_selected({ name, n }),
				cleared: () => m.map_cleared(),
				related: () => m.relations_related()
			})
	);

	// One tween carries every transition: camera and node positions move together, 280 ms,
	// ease-out, and not at all under prefers-reduced-motion.
	const geometry = new Tween(geometryOf(store.scene), {
		interpolate: interpolateGeometry,
		easing: cubicOut
	});
	$effect(() => {
		const target = geometryOf(store.scene);
		const instant = store.instant || prefersReducedMotion.current;
		store.instant = false;
		void geometry.set(target, { duration: instant ? 0 : 280 });
	});

	let wrapper: HTMLElement | undefined = $state();
	let stage: HTMLElement | undefined = $state();
	let cardTitle: HTMLElement | undefined = $state();
	let storyBar: HTMLElement | undefined = $state();
	let width = $state(0);
	let height = $state(0);
	$effect(() => store.resize(width, height));

	const listView = $derived(store.url.expert && store.url.view === 'list' && !store.story);
	const themeLabel = $derived(new Map(graph.themes.map((theme) => [theme.id, theme.label])));
	const captions = $derived(
		store.scene.captions.map((caption) => ({
			...caption,
			text: themeLabel.get(caption.id) ?? ''
		}))
	);
	const trail = $derived(store.trail.flatMap((id) => store.index.byId.get(id) ?? []));

	afterNavigate((navigation) => {
		if (navigation.shallow && navigation.type === 'goto') return;

		const before = store.url.story;
		store.sync(window.location.search);
		// A question chip (or a "play on the map" link) started a story: bring the map and its
		// caption to the reader. Not on Back/Forward, and not on the story's own step changes.
		if (navigation.type !== 'popstate' && navigation.type !== 'enter' && store.story) {
			if (store.url.story !== before || navigation.type === 'link') void revealStory();
		}
	});

	async function revealStory() {
		await tick();
		storyBar?.focus({ preventScroll: true });
		wrapper?.scrollIntoView({ block: 'nearest' });
	}

	/** Selects a node. Picks made outside the canvas move focus to the card that opens. */
	async function pick(id: string, from: 'canvas' | 'elsewhere') {
		// On phones the table gives way to the map strip and the card.
		if (store.compact && listView) store.setView('map');
		store.select(id);
		if (from === 'canvas') return;
		await tick();
		cardTitle?.focus({ preventScroll: true });
		if (store.compact && wrapper && wrapper.getBoundingClientRect().top < 0) {
			wrapper.scrollIntoView({ block: 'start' });
		}
	}

	function playStory(id: string) {
		store.playStory(id);
		void revealStory();
	}

	// Full screen: the Fullscreen API where it exists, and in every case a fixed overlay that
	// fills the viewport (iOS Safari has no element fullscreen). Local state, not in the URL.
	let section: HTMLElement | undefined = $state();
	let fullButton: HTMLButtonElement | undefined = $state();
	let full = $state(false);

	async function setFull(on: boolean) {
		if (on === full) return;
		full = on;
		try {
			if (on) await section?.requestFullscreen?.();
			else if (document.fullscreenElement) await document.exitFullscreen();
		} catch {
			// Refused or unsupported: the overlay alone does the job.
		}
		if (!on) {
			await tick();
			fullButton?.focus();
		}
	}
	// The browser's own Escape (or its exit control) leaves the Fullscreen API without telling us.
	function onfullscreenchange() {
		if (!document.fullscreenElement && full) void setFull(false);
	}
	// While the overlay is up the page behind it must not scroll.
	$effect(() => {
		if (!full) return;
		const root = document.documentElement;
		const before = root.style.overflow;
		root.style.overflow = 'hidden';
		return () => (root.style.overflow = before);
	});

	const inField = (target: EventTarget | null) =>
		target instanceof HTMLElement &&
		(target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

	function onkeydown(event: KeyboardEvent) {
		if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
		if (store.paletteOpen || inField(event.target)) return;
		const onNode = event.target instanceof Element && event.target.closest('[data-node-id]');
		if (event.key === '/') {
			event.preventDefault();
			store.paletteOpen = true;
		} else if (event.key === 'Escape' && full) {
			event.preventDefault();
			void setFull(false);
		} else if (event.key === 'Escape' && (store.story || store.selected)) {
			event.preventDefault();
			store.back();
		} else if (store.story && !onNode && event.key === 'ArrowRight') {
			event.preventDefault();
			store.step(1);
		} else if (store.story && !onNode && event.key === 'ArrowLeft') {
			event.preventDefault();
			store.step(-1);
		} else if (store.canPan && stage?.contains(event.target as Node)) {
			if (event.key === '+' || event.key === '=') store.zoom(1.3, undefined, true);
			else if (event.key === '-') store.zoom(1 / 1.3, undefined, true);
			else if (event.key === '0') store.fit();
		}
	}

	// Expert mode: drag to pan, Ctrl + wheel (or a trackpad pinch) to zoom. A plain wheel keeps
	// scrolling the page: the map never traps the scroll.
	let drag: { id: number; x: number; y: number; moved: boolean } | null = null;

	function onpointerdown(event: PointerEvent) {
		if (!store.canPan || event.button !== 0) return;
		drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
	}
	function onpointermove(event: PointerEvent) {
		if (!drag || event.pointerId !== drag.id) return;
		const dx = event.clientX - drag.x;
		const dy = event.clientY - drag.y;
		if (!drag.moved && Math.hypot(dx, dy) < 5) return;
		if (!drag.moved) (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		drag = { ...drag, x: event.clientX, y: event.clientY, moved: true };
		store.pan(dx, dy);
	}
	function onpointerup(event: PointerEvent) {
		if (drag?.moved) {
			// The click that ends a drag must not select the node under the pointer.
			window.addEventListener('click', (e) => e.preventDefault(), { capture: true, once: true });
			setTimeout(() => (drag = null), 0);
			(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
		} else {
			drag = null;
		}
	}
	$effect(() => {
		const el = stage;
		if (!el) return;
		const onwheel = (event: WheelEvent) => {
			if (!store.canPan || !event.ctrlKey) return;
			event.preventDefault();
			const box = el.getBoundingClientRect();
			store.zoom(Math.exp(-event.deltaY * 0.01), {
				x: event.clientX - box.left,
				y: event.clientY - box.top
			});
		};
		el.addEventListener('wheel', onwheel, { passive: false });
		return () => el.removeEventListener('wheel', onwheel);
	});

	const pill =
		'pointer-events-auto inline-flex h-10 items-center rounded-full bg-white text-sm text-zinc-800 shadow-sm ring-1 ring-zinc-200';
	const select =
		'pointer-events-auto h-10 max-w-[11rem] rounded-full bg-white pr-8 pl-4 text-sm text-zinc-800 shadow-sm ring-1 ring-zinc-200';
	const round =
		'flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg text-zinc-800 shadow-sm ring-1 ring-zinc-200 hover:bg-zinc-100';
</script>

<svelte:window {onkeydown} />
<svelte:document {onfullscreenchange}></svelte:document>

<section
	bind:this={section}
	aria-label={m.home_map_label()}
	class={['@container bg-white', full && 'fixed inset-0 z-50 overflow-y-auto p-3']}
	data-full={full ? '' : undefined}
	data-testid="map-explorer"
	data-ready={store.ready ? '' : undefined}
	data-scene={store.scene.kind}
>
	<div bind:this={wrapper} class={['relative scroll-mt-4', full && '@3xl:h-full']}>
		<div
			class="pointer-events-none z-10 mb-2 flex flex-wrap items-start justify-between gap-2 @3xl:absolute @3xl:inset-x-3 @3xl:top-3 @3xl:mb-0"
			data-requires-js
		>
			<div class="flex min-w-0 items-center gap-3">
				<button
					type="button"
					class={[pill, 'gap-2 pr-3 pl-3.5 hover:bg-zinc-50']}
					aria-keyshortcuts="/"
					onclick={() => (store.paletteOpen = true)}
					data-testid="map-search"
				>
					<svg viewBox="0 0 20 20" class="h-4 w-4 text-zinc-500" aria-hidden="true" fill="none">
						<circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="1.75"></circle>

						<path d="m14 14 4 4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
						></path>
					</svg>
					{m.map_search_button()}
					<kbd
						class="rounded border border-zinc-300 px-1.5 text-xs leading-5 text-zinc-600"
						aria-hidden="true">/</kbd
					>
				</button>

				{#if trail.length > 0 && !store.story}
					<nav
						aria-label={m.map_trail_label()}
						class="pointer-events-auto hidden min-w-0 @3xl:block"
						data-testid="map-trail"
					>
						<ol class="flex items-center gap-1 text-sm text-zinc-600">
							<li>
								<button
									type="button"
									class="rounded-full px-2 py-1 hover:bg-zinc-100 hover:text-zinc-900"
									onclick={() => store.select(null)}>{m.map_trail_start()}</button
								>
							</li>
							{#each trail as crumb, i (crumb.id)}
								<li class="flex min-w-0 items-center gap-1">
									<span aria-hidden="true" class="text-zinc-400">›</span>
									{#if i === trail.length - 1}
										<span class="truncate px-2 py-1 font-medium text-zinc-900" aria-current="true"
											>{crumb.label}</span
										>
									{:else}
										<button
											type="button"
											class="truncate rounded-full px-2 py-1 hover:bg-zinc-100 hover:text-zinc-900"
											onclick={() => pick(crumb.id, 'elsewhere')}
											data-crumb={crumb.id}>{crumb.label}</button
										>
									{/if}
								</li>
							{/each}
						</ol>
					</nav>
				{/if}
			</div>

			<div class="flex flex-wrap items-center justify-end gap-2">
				{#if store.url.expert && !store.story}
					<select
						class={select}
						aria-label={m.map_filter_type()}
						value={store.url.type}
						onchange={(event) => store.setFilter({ type: event.currentTarget.value })}
						data-testid="map-filter-type"
					>
						<option value="">{m.map_all_types()}</option>
						{#each graph.types as type (type.id)}
							<option value={type.id}>{type.label}</option>
						{/each}
					</select>
					<select
						class={select}
						aria-label={m.map_filter_family()}
						value={store.url.family}
						onchange={(event) => store.setFilter({ family: event.currentTarget.value })}
						data-testid="map-filter-family"
					>
						<option value="">{m.map_all_families()}</option>
						{#each graph.families as family (family.id)}
							<option value={family.id}>{family.label}</option>
						{/each}
					</select>
					<div class={[pill, 'gap-0.5 p-1']} role="group" aria-label={m.map_view_label()}>
						{#each [['map', m.map_view_map()], ['list', m.map_view_list()]] as const as [view, text] (view)}
							<button
								type="button"
								class={[
									'h-8 rounded-full px-3 text-sm font-medium',
									store.url.view === view
										? 'bg-zinc-900 text-white'
										: 'text-zinc-700 hover:bg-zinc-100'
								]}
								aria-pressed={store.url.view === view}
								onclick={() => store.setView(view)}
								data-testid="map-view-{view}">{text}</button
							>
						{/each}
					</div>
				{/if}
				<button
					bind:this={fullButton}
					type="button"
					class={[pill, 'gap-2 px-3 hover:bg-zinc-50']}
					aria-pressed={full}
					onclick={() => setFull(!full)}
					data-testid="map-fullscreen"
				>
					<svg viewBox="0 0 20 20" class="h-4 w-4 text-zinc-600" aria-hidden="true" fill="none">
						{#if full}
							<path
								d="M7 3v4H3M13 3v4h4M7 17v-4H3M13 17v-4h4"
								stroke="currentColor"
								stroke-width="1.75"
								stroke-linecap="round"
								stroke-linejoin="round"
							></path>
						{:else}
							<path
								d="M3 7V3h4M17 7V3h-4M3 13v4h4M17 13v4h-4"
								stroke="currentColor"
								stroke-width="1.75"
								stroke-linecap="round"
								stroke-linejoin="round"
							></path>
						{/if}
					</svg>
					<span class="sr-only @3xl:not-sr-only"
						>{full ? m.map_fullscreen_exit() : m.map_fullscreen()}</span
					>
				</button>
				<button
					type="button"
					role="switch"
					aria-checked={store.url.expert}
					class={[pill, 'gap-2 pr-4 pl-2 hover:bg-zinc-50']}
					onclick={() => store.setExpert(!store.url.expert)}
					data-testid="map-expert"
				>
					<span
						class={[
							'flex h-6 w-10 items-center rounded-full p-0.5 transition-colors',
							store.url.expert ? 'bg-blue-600' : 'bg-zinc-300'
						]}
						aria-hidden="true"
					>
						<span
							class={[
								'h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
								store.url.expert && 'translate-x-4'
							]}
						></span>
					</span>
					{m.map_expert()}
				</button>
			</div>
		</div>

		<div
			bind:this={stage}
			role="presentation"
			class={[
				'relative z-[5] overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200 @3xl:relative @3xl:top-0 @3xl:rounded-3xl',
				full
					? '@3xl:h-full'
					: // Expert mode shows the whole corpus: it gets most of the screen.
						store.url.expert && !store.story
						? '@3xl:h-[max(34rem,calc(100vh-9rem))]'
						: '@3xl:h-[min(56rem,max(27rem,calc(100vh-25.5rem)))]',
				listView
					? '@3xl:overflow-y-auto'
					: ['sticky min-h-[15rem]', full ? 'top-0 h-[52dvh]' : 'top-2 h-[38vh]'],
				store.canPan && !listView && 'cursor-grab touch-none active:cursor-grabbing'
			]}
			{onpointerdown}
			{onpointermove}
			{onpointerup}
			onpointercancel={onpointerup}
			data-testid="map-stage"
		>
			{#if listView}
				<div class="pt-4 @3xl:pt-16">
					<MapList {store} {locale} mode="table" onpick={(id) => pick(id, 'elsewhere')} />
				</div>
			{:else}
				<div class="absolute inset-0" bind:clientWidth={width} bind:clientHeight={height}>
					<MapCanvas
						nodes={store.scene.nodes}
						edges={store.scene.edges}
						geometry={geometry.current}
						vp={store.vp}
						info={(id) => store.index.byId.get(id)}
						href={(id) => localeHref(locale, `entity/${id}`)}
						label={m.map_canvas_label()}
						describedby="map-keys"
						{captions}
						startTag={store.scene.kind === 'start' && !store.compact
							? { id: CENTRE_ANCHOR_ID, text: m.map_start_here() }
							: undefined}
						compact={store.compact}
						dense={store.scene.kind === 'expert'}
						hotPair={store.hotPair}
						hotNode={store.hotNode}
						onpick={(id) => pick(id, 'canvas')}
						onhover={(id) => (store.hotNode = id)}
					/>
				</div>
				{#if store.scene.kind === 'start'}
					<p
						class="pointer-events-none absolute inset-x-0 bottom-3 hidden text-center text-sm text-zinc-600 @3xl:block"
						data-requires-js
					>
						{m.map_hint()}
					</p>
				{/if}
				{#if store.canPan}
					<div class="absolute bottom-3 left-3 flex gap-1.5" data-testid="map-zoom">
						<button
							type="button"
							class={round}
							aria-label={m.map_zoom_out()}
							onclick={() => store.zoom(1 / 1.4, undefined, true)}>−</button
						>
						<button
							type="button"
							class={round}
							aria-label={m.map_zoom_in()}
							onclick={() => store.zoom(1.4, undefined, true)}>+</button
						>
						<button
							type="button"
							class={[round, 'w-auto px-3 text-sm']}
							onclick={() => store.fit()}
							data-testid="map-fit">{m.map_zoom_fit()}</button
						>
					</div>
				{/if}
			{/if}
		</div>

		<p id="map-keys" class="sr-only">{m.map_keys_help()}</p>
		<p class="sr-only" aria-live="polite" data-testid="map-live">{store.announcement}</p>
		<p class="mt-3 text-sm text-zinc-600" data-no-js-only>{m.map_noscript()}</p>

		{#if store.story}
			<StoryBar {store} bind:bar={storyBar} />
		{:else if store.cardOpen}
			<MapCard {store} {locale} bind:title={cardTitle} onpick={(id) => pick(id, 'elsewhere')} />
		{:else if !store.url.expert}
			<MapList {store} {locale} mode="themes" onpick={(id) => pick(id, 'elsewhere')} />
		{/if}
	</div>

	<MapPalette {store} onpick={(id) => pick(id, 'elsewhere')} onstory={playStory} />
</section>

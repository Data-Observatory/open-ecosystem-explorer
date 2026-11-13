<script lang="ts">
	import QuestionChips from '$lib/components/QuestionChips.svelte';
	import MapExplorer from '$lib/explorer/MapExplorer.svelte';
	import { localeHref } from '$lib/paths';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();
	const linkClass =
		'text-blue-700 underline decoration-blue-700/40 underline-offset-2 hover:text-blue-900';
</script>

<svelte:head>
	<title>{m.site_name()}</title>
</svelte:head>

<div class="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
	<section class="mx-auto max-w-3xl pt-2 text-center sm:pt-4">
		<h1
			class="font-heading text-2xl font-semibold tracking-tight text-balance text-zinc-900 sm:text-4xl"
		>
			{m.site_name()}
		</h1>
		<p class="mx-auto mt-2 max-w-2xl text-sm text-balance text-zinc-700 sm:mt-3 sm:text-lg">
			{m.home_intro()}
		</p>
	</section>

	<!-- Where to start: each chip plays a guided story on the map below. -->
	<section
		aria-labelledby="questions-heading"
		class="mx-auto mt-4 flex max-w-5xl flex-col items-center gap-2 sm:mt-6 sm:gap-3"
	>
		<h2 id="questions-heading" class="font-heading text-sm font-semibold text-zinc-900">
			{m.home_questions_heading()}
		</h2>
		<QuestionChips stories={data.stories} locale={data.locale} scroll class="sm:justify-center" />
	</section>

	<div class="mt-4 sm:mt-6">
		<MapExplorer graph={data.graph} locale={data.locale} />
	</div>

	<p class="mt-5 text-center text-sm text-zinc-700">
		<span data-testid="home-stats"
			>{m.home_stats({ entities: data.summary.entities, relations: data.summary.relations })}</span
		>
		<span aria-hidden="true"> · </span>
		<a href={localeHref(data.locale, 'glossary')} class={linkClass}>{m.home_glossary_cta()}</a>
		<span aria-hidden="true"> · </span>
		<a href={localeHref(data.locale, 'views')} class={linkClass}>{m.home_questions_cta()}</a>
	</p>
</div>

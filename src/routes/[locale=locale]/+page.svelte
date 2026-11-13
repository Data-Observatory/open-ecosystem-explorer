<script lang="ts">
	import { base } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { pagePath } from '$lib/locale';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();
	const href = (path = '') => pagePath(base, data.locale, path) as ResolvedPathname;
</script>

<svelte:head>
	<title>{m.site_name()}</title>
</svelte:head>

<div class="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
	<section class="mx-auto max-w-3xl pt-8 pb-8 text-center sm:pt-12">
		<h1
			class="font-heading text-3xl font-semibold tracking-tight text-balance text-zinc-900 sm:text-5xl"
		>
			{m.site_name()}
		</h1>
		<p class="mx-auto mt-5 max-w-2xl text-lg font-light text-zinc-700">{m.home_intro()}</p>
		<p class="mt-3 text-sm text-zinc-700" data-testid="home-stats">
			{m.home_stats({ entities: data.summary.entities, relations: data.summary.relations })}
		</p>
	</section>

	<!-- Question chips: today they open the guided questions; the map port turns each into a
	     story played on the map (see MIGRATION.md). -->
	<section aria-labelledby="questions-heading" class="mx-auto max-w-4xl">
		<h2
			id="questions-heading"
			class="text-center font-heading text-lg font-semibold text-zinc-900 sm:text-xl"
		>
			{m.home_questions_heading()}
		</h2>
		<ul class="mt-4 flex flex-wrap justify-center gap-2" data-testid="question-chips">
			{#each data.questions as question (question.id)}
				<li>
					<a
						href={href(`views/${question.id}`)}
						class="inline-block rounded-full bg-white px-4 py-2 text-sm text-zinc-800 ring-1 ring-zinc-300 transition-colors hover:bg-blue-50 hover:ring-blue-600"
					>
						{question.question}
					</a>
				</li>
			{/each}
		</ul>
	</section>

	<!-- Placeholder for the interactive map (ported later from src/components/MapExplorer*). -->
	<section
		aria-label={m.home_map_label()}
		data-testid="map-placeholder"
		class="mx-auto mt-10 flex min-h-[18rem] max-w-5xl flex-col items-center justify-center rounded-3xl bg-zinc-50 px-6 py-12 text-center ring-1 ring-zinc-200 sm:min-h-[26rem]"
	>
		<svg
			viewBox="0 0 120 80"
			class="h-20 w-32 text-zinc-300"
			aria-hidden="true"
			focusable="false"
			fill="none"
		>
			<g stroke="currentColor" stroke-width="1.5">
				<line x1="60" y1="40" x2="20" y2="18" />
				<line x1="60" y1="40" x2="100" y2="16" />
				<line x1="60" y1="40" x2="28" y2="66" />
				<line x1="60" y1="40" x2="96" y2="64" />
				<line x1="100" y1="16" x2="96" y2="64" />
			</g>
			<circle cx="60" cy="40" r="9" class="fill-blue-600" />
			<circle cx="20" cy="18" r="5" class="fill-zinc-500" />
			<circle cx="100" cy="16" r="5" class="fill-zinc-500" />
			<circle cx="28" cy="66" r="5" class="fill-zinc-500" />
			<circle cx="96" cy="64" r="5" class="fill-zinc-500" />
		</svg>
		<h2 class="mt-4 font-heading text-xl font-semibold text-zinc-900">
			{m.home_map_placeholder_title()}
		</h2>
		<p class="mt-2 max-w-xl text-zinc-700">{m.home_map_placeholder_body()}</p>
		<div class="mt-6 flex flex-wrap justify-center gap-3">
			<a
				href={href('glossary')}
				class="inline-flex rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
			>
				{m.home_glossary_cta()}
			</a>
			<a
				href={href('views')}
				class="inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-medium text-zinc-800 ring-1 ring-zinc-300 hover:bg-zinc-100"
			>
				{m.home_questions_cta()}
			</a>
		</div>
	</section>
</div>

<script lang="ts">
	import type { ResolvedPathname } from '$app/types';
	import QuestionChips from '#lib/components/QuestionChips.svelte';
	import { pagePath } from '#lib/locale.ts';
	import * as m from '#lib/paraglide/messages.js';
	import { basePath } from '#lib/paths.ts';

	let { data } = $props();
	const href = (path = '') => pagePath(basePath(), data.locale, path) as ResolvedPathname;
</script>

<svelte:head>
	<title>{m.questions_title()} · {m.site_name()}</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 pb-8 sm:px-6">
	<header class="pt-6 pb-6 sm:pt-10">
		<h1 class="font-heading text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
			{m.questions_title()}
		</h1>
		<p class="mt-3 text-lg font-light text-zinc-700">{m.questions_intro()}</p>
	</header>

	<section aria-labelledby="stories-h">
		<h2 id="stories-h" class="font-heading text-xl font-semibold text-zinc-900">
			{m.questions_stories_heading()}
		</h2>
		<p class="mt-2 text-zinc-700">{m.questions_stories_intro()}</p>
		<QuestionChips stories={data.stories} locale={data.locale} class="mt-4" />
	</section>

	<section aria-labelledby="views-h" class="mt-12">
		<h2 id="views-h" class="font-heading text-xl font-semibold text-zinc-900">
			{m.questions_views_heading()}
		</h2>
		<ul class="mt-4 space-y-3" data-testid="question-list">
			{#each data.questions as question (question.id)}
				<li>
					<a
						href={href(`views/${question.id}`)}
						class="block rounded-2xl p-5 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 hover:ring-blue-600"
					>
						<span class="block font-heading text-lg font-semibold text-zinc-900"
							>{question.question}</span
						>
						<span class="mt-1 block text-sm text-zinc-700">{question.title}</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
</div>

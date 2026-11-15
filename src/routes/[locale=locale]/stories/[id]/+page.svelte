<script lang="ts">
	import type { ResolvedPathname } from '$app/types';
	import { pagePath } from '#lib/locale.ts';
	import * as m from '#lib/paraglide/messages.js';
	import { basePath } from '#lib/paths.ts';

	let { data } = $props();
	const story = $derived(data.story);
	const href = (path = '') => pagePath(basePath(), data.locale, path) as ResolvedPathname;
	const linkClass =
		'text-blue-700 underline decoration-blue-700/40 underline-offset-2 hover:text-blue-900';
</script>

<svelte:head>
	<title>{story.title} · {m.site_name()}</title>
	<meta name="description" content={story.question} />
</svelte:head>

<article class="mx-auto max-w-3xl px-4 pb-8 sm:px-6" data-testid="story-page">
	<p class="pt-6 text-sm sm:pt-10">
		<a href={href('views')} class={linkClass}>← {m.questions_back()}</a>
	</p>
	<header class="pt-4">
		{#if story.theme}
			<p class="text-sm font-medium tracking-wide text-zinc-600 uppercase">
				{m.story_theme({ theme: story.theme })}
			</p>
		{/if}
		<h1 class="mt-1 font-heading text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
			{story.question}
		</h1>
		<p class="mt-3 text-sm text-zinc-700">{m.story_steps({ n: story.steps })}</p>
	</header>

	<p class="mt-6" data-requires-js>
		<a
			href={`${href()}?historia=${story.id}&paso=1` as ResolvedPathname}
			class="inline-flex rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
			data-testid="story-play"
		>
			{m.story_play_on_map()} <span aria-hidden="true" class="ml-1.5">→</span>
		</a>
	</p>
	<p class="mt-6 text-sm text-zinc-600">{m.story_list_note()}</p>

	<ol class="mt-4 space-y-6" data-testid="story-steps">
		{#each story.stepList as step, i (i)}
			<li class="flex gap-4">
				<span
					class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 font-heading text-sm font-semibold text-white"
					aria-hidden="true">{i + 1}</span
				>
				<div>
					<h2 class="sr-only">{m.story_step({ n: i + 1 })}</h2>
					<p class="leading-relaxed text-zinc-800">{step.text}</p>
					<ul class="mt-2 flex flex-wrap gap-2 text-sm">
						{#each step.entities as entity (entity.id)}
							<li>
								<a
									href={href(`entity/${entity.id}`)}
									class="inline-block rounded-full px-3 py-1 text-zinc-800 ring-1 ring-zinc-300 hover:bg-zinc-100"
									>{entity.name}</a
								>
							</li>
						{/each}
					</ul>
				</div>
			</li>
		{/each}
	</ol>
</article>

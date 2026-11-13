<script lang="ts">
	import type { ClassValue } from 'svelte/elements';
	import { base } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { pagePath, type Locale } from '$lib/locale';

	// Question chips for the guided stories. Today each opens the story's step list
	// (/{locale}/stories/{id}/); the map port makes the same chips play the story on the map.
	let {
		stories,
		locale,
		class: className
	}: {
		stories: { id: string; question: string }[];
		locale: Locale;
		class?: ClassValue;
	} = $props();
</script>

<ul class={['flex flex-wrap gap-2', className]} data-testid="question-chips">
	{#each stories as story (story.id)}
		<li>
			<a
				href={pagePath(base, locale, `stories/${story.id}`) as ResolvedPathname}
				data-story-id={story.id}
				class="inline-block rounded-full bg-white px-4 py-2 text-sm text-zinc-800 ring-1 ring-zinc-300 transition-colors hover:bg-blue-50 hover:ring-blue-600"
			>
				{story.question}
			</a>
		</li>
	{/each}
</ul>

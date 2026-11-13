<script lang="ts">
	import type { ClassValue } from 'svelte/elements';
	import type { ResolvedPathname } from '$app/types';
	import { localeHref } from '$lib/paths';
	import type { Locale } from '$lib/locale';

	// Question chips for the guided stories: each one plays its story on the home page's map
	// (`?historia=<id>&paso=1`, read by the explorer after the navigation). The same steps are an
	// ordered list on /{locale}/stories/{id}/ for readers without JavaScript.
	let {
		stories,
		locale,
		scroll = false,
		class: className
	}: {
		stories: { id: string; question: string }[];
		locale: Locale;
		/** On phones, one row that scrolls sideways instead of wrapping (home page). */
		scroll?: boolean;
		class?: ClassValue;
	} = $props();

	const play = (id: string) => `${localeHref(locale)}?historia=${id}&paso=1` as ResolvedPathname;
</script>

<ul
	class={[
		'flex gap-2',
		scroll
			? 'max-w-full [scrollbar-width:none] flex-nowrap overflow-x-auto px-1 py-1 whitespace-nowrap sm:flex-wrap sm:overflow-visible sm:whitespace-normal'
			: 'flex-wrap',
		className
	]}
	data-testid="question-chips"
>
	{#each stories as story (story.id)}
		<li class="shrink-0 sm:shrink">
			<a
				href={play(story.id)}
				data-story-id={story.id}
				data-sveltekit-noscroll
				class="inline-block rounded-full bg-white px-4 py-2 text-sm text-zinc-800 ring-1 ring-zinc-300 transition-colors hover:bg-blue-50 hover:ring-blue-600"
			>
				{story.question}
			</a>
		</li>
	{/each}
</ul>

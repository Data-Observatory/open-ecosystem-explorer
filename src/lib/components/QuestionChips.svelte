<script lang="ts">
	import type { ClassValue } from 'svelte/elements';
	import { goto } from '$app/navigation';
	import type { ResolvedPathname } from '$app/types';
	import { localeHref } from '#lib/paths.ts';
	import type { Locale } from '#lib/locale.ts';

	// Question chips for the guided stories. Progressive enhancement: the link goes to the
	// story's step list (/{locale}/stories/{id}/), which works without JavaScript; with
	// JavaScript a plain click plays the story on the home page's map instead
	// (`?historia=<id>&paso=1`, read by the explorer after the navigation).
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

	function onclick(event: MouseEvent, id: string) {
		if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
			return;
		event.preventDefault();
		void goto(play(id), { reset: false });
	}
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
		<li class={scroll ? 'shrink-0 sm:shrink' : 'max-w-full'}>
			<a
				href={localeHref(locale, `stories/${story.id}`)}
				data-story-id={story.id}
				onclick={(event) => onclick(event, story.id)}
				class="inline-block rounded-full bg-white px-4 py-2 text-sm text-zinc-800 ring-1 ring-zinc-300 transition-colors hover:bg-blue-50 hover:ring-blue-600"
			>
				{story.question}
			</a>
		</li>
	{/each}
</ul>

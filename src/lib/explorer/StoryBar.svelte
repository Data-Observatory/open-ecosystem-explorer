<script lang="ts">
	import * as m from '#lib/paraglide/messages.js';
	import type { MapStore } from './store.svelte';

	/**
	 * Caption bar of a story being played: the question, the current step's sentence, and
	 * previous / next. Nothing plays by itself. The same steps exist as an ordered list on
	 * /{locale}/stories/<id>/ for readers without JavaScript.
	 */
	let { store, bar = $bindable() }: { store: MapStore; bar?: HTMLElement } = $props();

	const story = $derived(store.story);
	const step = $derived(store.url.step);
	const last = $derived(story ? step === story.steps.length - 1 : false);
	const button =
		'inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors';
</script>

{#if story}
	<section
		bind:this={bar}
		bind:clientHeight={store.captionHeight}
		tabindex="-1"
		aria-label={m.map_story_label()}
		data-testid="story-bar"
		class="z-10 mt-4 rounded-2xl bg-white p-4 ring-1 ring-zinc-200 focus:outline-none @3xl:absolute @3xl:inset-x-0 @3xl:bottom-4 @3xl:mx-auto @3xl:mt-0 @3xl:w-[min(44rem,calc(100%-2rem))] @3xl:px-6 @3xl:py-4 @3xl:shadow-lg @3xl:shadow-zinc-900/5"
	>
		<div class="flex items-start justify-between gap-3">
			<p class="text-xs font-semibold tracking-wide text-blue-700 uppercase">
				{m.map_story_label()}
				<span class="font-medium text-zinc-600" data-testid="story-progress"
					>· {m.map_story_progress({ n: step + 1, total: story.steps.length })}</span
				>
			</p>
			<button
				type="button"
				class="-mt-2 -mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl leading-none text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
				aria-label={m.map_story_exit()}
				onclick={() => store.exitStory(false)}
				data-testid="story-exit"
			>
				<span aria-hidden="true">×</span>
			</button>
		</div>
		<h2 class="font-heading text-base font-semibold text-zinc-900">{story.question}</h2>
		<p
			class="mt-2 text-[1.0625rem] leading-relaxed text-zinc-800"
			aria-live="polite"
			data-testid="story-text"
		>
			{story.steps[step]?.text}
		</p>
		<div class="mt-3 flex flex-wrap items-center justify-between gap-3">
			<div class="flex gap-1.5" aria-hidden="true">
				{#each story.steps, i (i)}
					<span
						class={[
							'h-1.5 rounded-full transition-all',
							i === step
								? 'w-5 bg-blue-600'
								: i < step
									? 'w-1.5 bg-blue-600/40'
									: 'w-1.5 bg-zinc-300'
						]}
					></span>
				{/each}
			</div>
			<div class="flex gap-2">
				<button
					type="button"
					class={[
						button,
						'text-zinc-800 ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-40'
					]}
					disabled={step === 0}
					onclick={() => store.step(-1)}
					data-testid="story-prev"
				>
					<span aria-hidden="true">←</span>
					{m.map_story_prev()}
				</button>
				{#if last}
					<button
						type="button"
						class={[button, 'bg-blue-600 text-white hover:bg-blue-700']}
						onclick={() => store.exitStory(true)}
						data-testid="story-continue"
					>
						{m.map_story_continue()}
					</button>
				{:else}
					<button
						type="button"
						class={[button, 'bg-blue-600 text-white hover:bg-blue-700']}
						onclick={() => store.step(1)}
						data-testid="story-next"
					>
						{m.map_story_next()}
						<span aria-hidden="true">→</span>
					</button>
				{/if}
			</div>
		</div>
	</section>
{/if}

<script lang="ts">
	import { base } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import { pagePath } from '$lib/locale';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();
	const question = $derived(data.question);
	const href = (path = '') => pagePath(base, data.locale, path) as ResolvedPathname;
	const proseLang = $derived(question.fallback ? question.proseLocale : undefined);
	const linkClass =
		'text-blue-700 underline decoration-blue-700/40 underline-offset-2 hover:text-blue-900';
</script>

<svelte:head>
	<title>{question.title} · {m.site_name()}</title>
	<meta name="description" content={question.question} />
</svelte:head>

<article class="mx-auto max-w-3xl px-4 pb-8 sm:px-6" data-testid="question-page">
	<p class="pt-6 text-sm sm:pt-10">
		<a href={href('views')} class={linkClass}>← {m.questions_back()}</a>
	</p>

	{#if question.fallback}
		<p
			role="note"
			class="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-zinc-800 ring-1 ring-amber-200"
		>
			{m.question_fallback_notice()}
		</p>
	{/if}

	<header class="pt-4" lang={proseLang}>
		<h1 class="font-heading text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
			{question.title}
		</h1>
		<p class="mt-3 text-lg text-zinc-700 italic">{question.question}</p>
	</header>

	<!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped by renderMarkdown, repository content -->
	<div class="prose-content mt-6 text-zinc-800" lang={proseLang}>{@html question.bodyHtml}</div>

	{#if question.sentences.length > 0}
		<section aria-labelledby="q-relations-h" class="mt-10">
			<h2 id="q-relations-h" class="font-heading text-xl font-semibold text-zinc-900">
				{m.question_relations_heading()}
			</h2>
			<ul class="mt-3 space-y-2">
				{#each question.sentences as sentence, i (i)}
					<li>
						<a href={href(`entity/${sentence.subject.id}`)} class={linkClass}
							>{sentence.subject.name}</a
						>
						{sentence.verb}
						<a href={href(`entity/${sentence.object.id}`)} class={linkClass}
							>{sentence.object.name}</a
						>.
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if question.entries.length > 0}
		<section aria-labelledby="q-entries-h" class="mt-10">
			<h2 id="q-entries-h" class="font-heading text-xl font-semibold text-zinc-900">
				{m.question_entries_heading()}
			</h2>
			<div class="mt-3 overflow-x-auto">
				<table class="w-full text-left text-sm">
					<thead>
						<tr class="border-b border-zinc-300">
							<th scope="col" class="py-2 pr-4 font-semibold">{m.col_name()}</th>
							<th scope="col" class="py-2 pr-4 font-semibold">{m.col_type()}</th>
							<th scope="col" class="py-2 pr-4 font-semibold">{m.col_governance()}</th>
							{#each question.optionalColumns as column (column)}
								<th scope="col" class="py-2 pr-4 font-semibold">{column}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each question.entries as entry (entry.id)}
							<tr class="border-b border-zinc-100 align-top">
								<td class="py-2 pr-4"
									><a href={href(`entity/${entry.id}`)} class={linkClass}>{entry.name}</a></td
								>
								<td class="py-2 pr-4">{entry.typeLabel}</td>
								<td class="py-2 pr-4">{entry.governance}</td>
								{#each entry.optional as value, i (i)}
									<td class="py-2 pr-4">{value || '-'}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}

	{#if question.sources.length > 0}
		<section aria-labelledby="q-sources-h" class="mt-10">
			<h2 id="q-sources-h" class="font-heading text-xl font-semibold text-zinc-900">
				{m.sources_heading()}
			</h2>
			<ul class="mt-2 list-disc space-y-1 pl-6 text-sm">
				{#each question.sources as source (source.url)}
					<li class="break-words">
						<ExternalLink href={source.url} class={linkClass}
							>{source.title ?? source.url}</ExternalLink
						>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</article>

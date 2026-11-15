<script lang="ts">
	import type { ResolvedPathname } from '$app/types';
	import ExternalLink from '#lib/components/ExternalLink.svelte';
	import MiniGraph from '#lib/explorer/MiniGraph.svelte';
	import { pagePath } from '#lib/locale.ts';
	import { fileHref, basePath } from '#lib/paths.ts';
	import { entryIssueUrl } from '#lib/repo.ts';
	import * as m from '#lib/paraglide/messages.js';

	let { data } = $props();
	const entity = $derived(data.entity);
	const href = (path = '') => pagePath(basePath(), data.locale, path) as ResolvedPathname;
	// Fallback prose is shown in its own language (lang attribute) under a notice.
	const proseLang = $derived(entity.fallback ? entity.proseLocale : undefined);

	const linkLabel = (link: (typeof entity.links)[number]) =>
		link.kind === 'website'
			? m.entity_official_site()
			: link.kind === 'wikipedia'
				? m.entity_wikipedia()
				: link.kind === 'wikidata'
					? m.entity_wikidata({ qid: link.value ?? '' })
					: m.entity_ror({ ror: link.value ?? '' });

	const linkClass =
		'text-blue-700 underline decoration-blue-700/40 underline-offset-2 hover:text-blue-900';
	const sectionHeading = 'font-heading text-xl font-semibold text-zinc-900';
</script>

<svelte:head>
	<title>{entity.name} · {m.site_name()}</title>
	<meta name="description" content={entity.summary} />
</svelte:head>

<article class="mx-auto max-w-3xl px-4 pb-8 sm:px-6" data-testid="entity-page">
	{#if entity.fallback}
		<p
			role="note"
			class="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-zinc-800 ring-1 ring-amber-200"
		>
			{m.entity_fallback_notice()}
		</p>
	{/if}

	<header class="pt-6 sm:pt-10">
		<p class="text-sm font-medium tracking-wide text-zinc-600 uppercase" data-testid="entity-type">
			{entity.typeLabel}
		</p>
		<h1
			class="mt-1 font-heading text-3xl font-semibold tracking-tight break-words text-zinc-900 sm:text-4xl"
		>
			{entity.name}
		</h1>
		<p
			class="mt-4 text-lg leading-relaxed text-zinc-800"
			lang={proseLang}
			data-testid="entity-summary"
		>
			{entity.summary}
		</p>
	</header>

	{#if entity.localNote}
		<aside
			aria-labelledby="local-note-h"
			class="mt-6 rounded-xl border-l-4 border-blue-600 bg-blue-50 px-4 py-3 text-zinc-800"
			lang={proseLang}
			data-testid="local-note"
		>
			<h2 id="local-note-h" class="font-heading text-sm font-semibold text-zinc-900">
				{m.entity_local_note()}
			</h2>
			<p class="mt-1">{entity.localNote}</p>
		</aside>
	{/if}

	<section aria-labelledby="relations-h" class="mt-10">
		<h2 id="relations-h" class={sectionHeading}>{m.entity_relations_heading()}</h2>
		{#if entity.relations.length === 0}
			<p class="mt-3 text-zinc-700">{m.entity_no_relations()}</p>
		{/if}
		{#if data.graph}
			<MiniGraph graph={data.graph} id={entity.id} name={entity.name} locale={data.locale} />
		{/if}
		{#each entity.relations as group (group.family)}
			<h3 class="mt-6 text-sm font-semibold tracking-wide text-zinc-600 uppercase">
				{group.label}
			</h3>
			<ul class="mt-2 space-y-2" data-testid="relation-sentences">
				{#each group.sentences as sentence, i (i)}
					<li class="leading-relaxed">
						{#if sentence.selfIsSubject}
							{entity.name}
							{sentence.verb}
							<a href={href(`entity/${sentence.other.id}`)} class={linkClass}
								>{sentence.other.name}</a
							>.
						{:else}
							<a href={href(`entity/${sentence.other.id}`)} class={linkClass}
								>{sentence.other.name}</a
							>
							{sentence.verb}
							{entity.name}.
						{/if}
						{#if sentence.note}
							<span class="block text-sm text-zinc-600">{sentence.note}</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/each}
	</section>

	<section aria-labelledby="links-h" class="mt-10">
		<h2 id="links-h" class={sectionHeading}>{m.entity_links_heading()}</h2>
		<ul class="mt-3 flex flex-wrap gap-2" data-testid="external-links">
			{#each entity.links as link (link.kind)}
				<li>
					<ExternalLink
						href={link.href}
						data-link-kind={link.kind}
						class="inline-flex rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-800 ring-1 ring-zinc-300 hover:bg-zinc-100"
					>
						{linkLabel(link)}
					</ExternalLink>
				</li>
			{/each}
		</ul>
	</section>

	<details class="group mt-10 rounded-2xl ring-1 ring-zinc-200" data-testid="entity-details">
		<summary
			class="cursor-pointer list-none rounded-2xl px-5 py-4 font-heading text-lg font-semibold text-zinc-900 hover:bg-zinc-50"
		>
			<span aria-hidden="true" class="mr-2 inline-block transition-transform group-open:rotate-90"
				>›</span
			>{m.entity_details()}
		</summary>
		<div class="space-y-8 px-5 pt-2 pb-6">
			{#if entity.aka.length > 0}
				<p><span class="font-medium">{m.entity_also_known_as()}:</span> {entity.aka.join(', ')}</p>
			{/if}

			{#if entity.bodyHtml}
				<section aria-labelledby="description-h">
					<h3 id="description-h" class="font-heading text-base font-semibold text-zinc-900">
						{m.entity_description()}
					</h3>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped by renderMarkdown, repository content -->
					<div class="prose-content" lang={proseLang}>{@html entity.bodyHtml}</div>
				</section>
			{/if}

			<section aria-labelledby="attributes-h">
				<h3 id="attributes-h" class="font-heading text-base font-semibold text-zinc-900">
					{m.entity_attributes()}
				</h3>
				<div class="mt-2 overflow-x-auto">
					<table class="w-full text-left text-sm">
						<caption class="sr-only">{m.entity_attributes_caption({ name: entity.name })}</caption>
						<tbody>
							{#each entity.attributes as row (row.key)}
								<tr class="border-b border-zinc-100 align-top">
									<th scope="row" class="py-2 pr-4 font-medium whitespace-nowrap text-zinc-700"
										>{row.key}</th
									>
									<td class="py-2 break-words">{row.value}</td>
								</tr>
							{/each}
							<tr class="border-b border-zinc-100 align-top">
								<th scope="row" class="py-2 pr-4 font-medium text-zinc-700">{m.entity_tags()}</th>
								<td class="py-2">{entity.tags.join(', ')}</td>
							</tr>
							{#if entity.disciplines.length > 0}
								<tr class="border-b border-zinc-100 align-top">
									<th scope="row" class="py-2 pr-4 font-medium text-zinc-700"
										>{m.entity_disciplines()}</th
									>
									<td class="py-2">{entity.disciplines.join(', ')}</td>
								</tr>
							{/if}
							{#if entity.geography.length > 0}
								<tr class="border-b border-zinc-100 align-top">
									<th scope="row" class="py-2 pr-4 font-medium text-zinc-700"
										>{m.entity_geography()}</th
									>
									<td class="py-2">{entity.geography.join(', ')}</td>
								</tr>
							{/if}
						</tbody>
					</table>
				</div>
			</section>

			<section aria-labelledby="sources-h">
				<h3 id="sources-h" class="font-heading text-base font-semibold text-zinc-900">
					{m.sources_heading()}
				</h3>
				<ul class="mt-2 list-disc space-y-1 pl-6 text-sm">
					{#each entity.sources as source (source.url)}
						<li class="break-words">
							<ExternalLink href={source.url} class={linkClass}
								>{source.title ?? source.url}</ExternalLink
							>
							({m.entity_accessed({ date: source.accessed })}){#if source.note}: {source.note}{/if}
						</li>
					{/each}
				</ul>
			</section>

			<p class="text-sm text-zinc-700">{m.entity_last_reviewed({ date: entity.lastReviewed })}</p>
			<p class="text-sm">
				<a href={fileHref(`/entity/${entity.id}.json`)} class={linkClass} data-sveltekit-reload
					>{m.entity_raw_json()}</a
				>
			</p>
		</div>
	</details>

	<p class="mt-6 text-sm text-zinc-700" data-testid="entity-suggest">
		{m.entity_suggest_prompt()}
		<ExternalLink
			href={entryIssueUrl('description', entity.id, entity.name)}
			class={linkClass}
			data-testid="entity-suggest-description">{m.entity_suggest_description()}</ExternalLink
		>
		·
		<ExternalLink
			href={entryIssueUrl('connection', entity.id, entity.name)}
			class={linkClass}
			data-testid="entity-suggest-connection">{m.entity_suggest_connection()}</ExternalLink
		>
	</p>
</article>

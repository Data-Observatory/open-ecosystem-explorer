<script lang="ts">
	import type { ResolvedPathname } from '$app/types';
	import { pagePath } from '#lib/locale.ts';
	import { fileHref, basePath } from '#lib/paths.ts';
	import * as m from '#lib/paraglide/messages.js';
	import ConsentChange from '#lib/components/ConsentChange.svelte';
	import ExternalLink from '#lib/components/ExternalLink.svelte';
	import { NEW_ISSUE_CHOOSER_URL } from '#lib/repo.ts';

	let { data } = $props();
	const about = $derived(data.about);
	const href = (path = '') => pagePath(basePath(), data.locale, path) as ResolvedPathname;

	const sections = [
		{ id: 'scope', label: m.about_scope_heading },
		{ id: 'reading', label: m.about_reading_heading },
		{ id: 'model', label: m.about_model_heading },
		{ id: 'downloads', label: m.about_downloads_heading },
		{ id: 'contribute', label: m.about_contribute_heading },
		{ id: 'changelog', label: m.about_changelog_heading },
		{ id: 'privacy', label: m.about_privacy_heading }
	];

	const h2 = 'scroll-mt-24 font-heading text-2xl font-semibold text-zinc-900';
	const h3 = 'mt-8 font-heading text-lg font-semibold text-zinc-900';
	const linkClass =
		'text-blue-700 underline decoration-blue-700/40 underline-offset-2 hover:text-blue-900';
	const th = 'py-2 pr-4 font-semibold';
	const td = 'py-2 pr-4 align-top';
</script>

<svelte:head>
	<title>{m.about_title()} · {m.site_name()}</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 pb-8 sm:px-6">
	<header class="pt-6 pb-4 sm:pt-10">
		<h1 class="font-heading text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
			{m.about_title()}
		</h1>
	</header>

	<nav aria-label={m.about_toc_label()} class="rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
		<ul class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
			{#each sections as section (section.id)}
				<li>
					<a href={`#${section.id}`} class={['inline-block py-1', linkClass]}>{section.label()}</a>
				</li>
			{/each}
		</ul>
	</nav>

	<section aria-labelledby="scope" class="mt-10">
		<h2 id="scope" class={h2}>{m.about_scope_heading()}</h2>
		<p class="mt-3 leading-relaxed">
			{m.about_scope_body({
				entities: about.summary.entities,
				relations: about.summary.relations
			})}
		</p>
		<p class="mt-3 leading-relaxed">{m.about_scope_not()}</p>
		<h3 class={h3}>{m.about_inclusion_heading()}</h3>
		<p class="mt-2 leading-relaxed">{m.about_inclusion_body()}</p>
		<h3 class={h3}>{m.about_policy_heading()}</h3>
		<ul class="mt-2 list-disc space-y-1 pl-6">
			<li>{m.about_policy_one_place()}</li>
			<li>{m.about_policy_canonical()}</li>
			<li>{m.about_policy_descriptive()}</li>
			<li>{m.about_policy_sources()}</li>
			<li>{m.about_policy_freshness()}</li>
		</ul>
	</section>

	<section aria-labelledby="reading" class="mt-12">
		<h2 id="reading" class={h2}>{m.about_reading_heading()}</h2>
		<p class="mt-3 leading-relaxed">{m.about_reading_nodes()}</p>
		<p class="mt-3 leading-relaxed">
			{m.about_reading_families({ count: about.families.length })}
		</p>
		<dl class="mt-3 space-y-3">
			{#each about.families as family (family.id)}
				<div>
					<dt class="font-semibold text-zinc-900">{family.label}</dt>
					<dd class="text-zinc-700">{family.definition}</dd>
				</div>
			{/each}
		</dl>
	</section>

	<section aria-labelledby="model" class="mt-12">
		<h2 id="model" class={h2}>{m.about_model_heading()}</h2>
		<p class="mt-3 leading-relaxed">{m.about_model_intro()}</p>

		<h3 class={h3}>{m.about_types_heading()}</h3>
		<div class="mt-2 overflow-x-auto">
			<table class="w-full text-left text-sm" data-testid="types-table">
				<thead>
					<tr class="border-b border-zinc-300">
						<th scope="col" class={th}>{m.col_type()}</th>
						<th scope="col" class={th}>{m.col_definition()}</th>
						<th scope="col" class={[th, 'text-right']}>{m.col_count()}</th>
					</tr>
				</thead>
				<tbody>
					{#each about.types as type (type.id)}
						<tr class="border-b border-zinc-100">
							<th scope="row" class={[td, 'font-medium']}>{type.label}</th>
							<td class={td}>{type.definition}</td>
							<td class={[td, 'text-right tabular-nums']}>{type.count}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<h3 class={h3}>{m.about_predicates_heading()}</h3>
		<div class="mt-2 overflow-x-auto">
			<table class="w-full text-left text-sm" data-testid="predicates-table">
				<thead>
					<tr class="border-b border-zinc-300">
						<th scope="col" class={th}>{m.col_predicate()}</th>
						<th scope="col" class={th}>{m.col_inverse()}</th>
						<th scope="col" class={th}>{m.col_family()}</th>
						<th scope="col" class={[th, 'text-right']}>{m.col_edges()}</th>
					</tr>
				</thead>
				<tbody>
					{#each about.predicates as predicate (predicate.id)}
						<tr class="border-b border-zinc-100">
							<th scope="row" class={[td, 'font-medium']}>{predicate.label}</th>
							<td class={td}>{predicate.inverseLabel}</td>
							<td class={td}>{predicate.family}</td>
							<td class={[td, 'text-right tabular-nums']}>{predicate.count}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<details class="mt-6 rounded-xl ring-1 ring-zinc-200">
			<summary class="cursor-pointer rounded-xl px-4 py-3 font-medium hover:bg-zinc-50">
				{m.about_invariants_summary({ count: about.rules.length })}
			</summary>
			<div class="overflow-x-auto px-4 pb-4">
				<table class="w-full text-left text-sm" lang="en">
					<thead>
						<tr class="border-b border-zinc-300">
							<th scope="col" class={th}>{m.col_rule()}</th>
							<th scope="col" class={th}>{m.col_level()}</th>
							<th scope="col" class={th}>{m.col_definition()}</th>
						</tr>
					</thead>
					<tbody>
						{#each about.rules as rule (rule.id)}
							<tr class="border-b border-zinc-100">
								<td class={[td, 'font-mono']}>{rule.id}</td>
								<td class={td}>{rule.level}</td>
								<td class={[td, 'break-words']}>{rule.description}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</details>
	</section>

	<section aria-labelledby="downloads" class="mt-12">
		<h2 id="downloads" class={h2}>{m.about_downloads_heading()}</h2>
		<p class="mt-3 leading-relaxed">{m.about_downloads_intro()}</p>
		<ul class="mt-3 list-disc space-y-2 pl-6" data-testid="downloads">
			<li>
				<a href={fileHref('/data/entities.csv')} class={linkClass} data-sveltekit-reload download
					>{m.download_entities()}</a
				>
			</li>
			<li>
				<a href={fileHref('/data/relations.csv')} class={linkClass} data-sveltekit-reload download
					>{m.download_relations()}</a
				>
			</li>
			<li>
				<a href={fileHref('/data/graph.json')} class={linkClass} data-sveltekit-reload
					>{m.download_graph()}</a
				>
			</li>
			<li>
				{m.download_entity_json()}
				<a
					href={fileHref(`/entity/${about.exampleEntity}.json`)}
					class={[linkClass, 'font-mono text-sm break-all']}
					data-sveltekit-reload>/entity/{about.exampleEntity}.json</a
				>
			</li>
			<li>
				<a href={fileHref(`/${data.locale}/feed.xml`)} class={linkClass} data-sveltekit-reload
					>{m.download_feed()}</a
				>
			</li>
			<li>
				<a href={fileHref('/sitemap.xml')} class={linkClass} data-sveltekit-reload
					>{m.download_sitemap()}</a
				>
			</li>
		</ul>
	</section>

	<section aria-labelledby="contribute" class="mt-12">
		<h2 id="contribute" class={h2}>{m.about_contribute_heading()}</h2>
		<p class="mt-3 leading-relaxed" data-testid="about-issues">
			{m.about_contribute_issues()}
			<ExternalLink
				href={NEW_ISSUE_CHOOSER_URL}
				class="text-blue-700 underline decoration-blue-700/40 underline-offset-2 hover:text-blue-900"
				>{m.about_contribute_issues_link()}</ExternalLink
			>
		</p>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped by renderMarkdown, repository content -->
		<div class="prose-content mt-3" lang="en">{@html about.contributeHtml}</div>
		<details class="mt-4 rounded-xl ring-1 ring-zinc-200">
			<summary class="cursor-pointer rounded-xl px-4 py-3 font-medium hover:bg-zinc-50">
				{m.about_contribute_template()}
			</summary>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped by renderMarkdown, repository content -->
			<div class="prose-content px-4 pb-4" lang="en">{@html about.templateHtml}</div>
		</details>
	</section>

	<section aria-labelledby="changelog" class="mt-12">
		<h2 id="changelog" class={h2}>{m.about_changelog_heading()}</h2>
		<p class="mt-3 leading-relaxed">{m.about_changelog_body()}</p>
		<ul class="mt-3 list-disc space-y-1 pl-6 text-sm" lang="en">
			{#each about.changelogHeadings as heading (heading)}
				<li>{heading}</li>
			{/each}
		</ul>
		<p class="mt-4">
			<a href={href('changelog')} class={linkClass}>{m.about_changelog_link()}</a>
		</p>
	</section>

	<section aria-labelledby="privacy" class="mt-12" data-testid="privacy">
		<h2 id="privacy" class={h2}>{m.about_privacy_heading()}</h2>
		<p class="mt-3 leading-relaxed">{m.about_privacy_collected()}</p>
		<p class="mt-3 leading-relaxed">{m.about_privacy_default()}</p>
		<p class="mt-3 leading-relaxed">{m.about_privacy_off()}</p>
		<p class="mt-3 leading-relaxed">{m.about_privacy_storage()}</p>
		<p class="mt-4 min-h-11">
			<ConsentChange
				class="rounded-full border border-zinc-400 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100"
			/>
		</p>
	</section>
</div>

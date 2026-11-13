<script lang="ts">
	import { base } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { pagePath } from '$lib/locale';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();
	const target = $derived(
		pagePath(base, data.locale, data.target.path) +
			(data.target.query ? `?${data.target.query}` : '') +
			(data.target.hash ? `#${data.target.hash}` : '')
	);
	// Runs while the prerendered <head> is parsed, before the meta refresh: keeps the visitor's
	// query string where the target wants it (/search/?q=doi -> /glossary/?q=doi).
	const keepQueryScript = $derived(
		data.target.keepQuery
			? `<script>location.replace(${JSON.stringify(target)} + location.search);<` + `/script>`
			: ''
	);
</script>

<svelte:head>
	<title>{m.redirect_title()} · {m.site_name()}</title>
	<meta name="robots" content="noindex" />
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- constant script built from route data -->
	{@html keepQueryScript}
	<meta http-equiv="refresh" content={`0; url=${target}`} />
	<link rel="canonical" href={target} />
</svelte:head>

<div class="mx-auto max-w-md px-6 py-16 text-center" data-testid="legacy-redirect">
	<h1 class="font-heading text-2xl font-semibold text-zinc-900">{m.redirect_title()}</h1>
	<p class="mt-3 text-sm text-zinc-700">{m.redirect_body()}</p>
	<p class="mt-4">
		<a
			href={target as ResolvedPathname}
			class="inline-flex rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
		>
			{target}
		</a>
	</p>
</div>

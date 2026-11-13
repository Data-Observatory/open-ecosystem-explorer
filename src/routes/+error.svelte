<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import type { ResolvedPathname } from '$app/types';
	import { DEFAULT_LOCALE, isLocale, pagePath } from '$lib/locale';
	import * as m from '$lib/paraglide/messages';

	const locale = $derived(
		isLocale(page.params.locale ?? '') ? page.params.locale! : DEFAULT_LOCALE
	);
</script>

<svelte:head>
	<title>{page.status === 404 ? m.not_found_title() : page.status}</title>
</svelte:head>

<main class="mx-auto max-w-md px-6 py-16 text-center">
	<h1 class="font-heading text-2xl font-semibold text-zinc-900">
		{page.status === 404 ? m.not_found_title() : page.error?.message}
	</h1>
	{#if page.status === 404}
		<p class="mt-3 text-sm text-zinc-700">{m.not_found_body()}</p>
	{/if}
	<p class="mt-6">
		<a
			href={pagePath(base, locale as 'es' | 'en') as ResolvedPathname}
			class="inline-flex rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
		>
			{m.not_found_back()}
		</a>
	</p>
</main>

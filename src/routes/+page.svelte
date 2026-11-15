<script lang="ts">
	import { DEFAULT_LOCALE, LOCALES, LOCALE_NAMES, pagePath } from '#lib/locale.ts';
	import { localeHref, basePath } from '#lib/paths.ts';
	import * as m from '#lib/paraglide/messages.js';

	// The language gateway: `/` is never a content page. A 0-second meta
	// refresh sends every visitor to the default locale (es); the links cover browsers that
	// ignore the refresh. No JavaScript needed.
	const target = pagePath(basePath(), DEFAULT_LOCALE);
</script>

<svelte:head>
	<title>{m.site_name()}</title>
	<meta http-equiv="refresh" content={`0; url=${target}`} />
	<meta name="robots" content="noindex" />
	{#each LOCALES as locale (locale)}
		<link rel="alternate" hreflang={locale} href={pagePath(basePath(), locale)} />
	{/each}
	<link rel="alternate" hreflang="x-default" href={target} />
</svelte:head>

<main class="mx-auto max-w-md px-6 py-24 text-center">
	<h1 class="font-heading text-2xl font-semibold text-zinc-900">{m.site_name()}</h1>
	<p class="mt-4 text-sm text-zinc-700">{m.gateway_redirecting()}</p>
	<p class="mt-4 text-sm text-zinc-700">{m.gateway_choose()}</p>
	<ul class="mt-3 flex justify-center gap-3">
		{#each LOCALES as locale (locale)}
			<li>
				<a
					href={localeHref(locale)}
					data-sveltekit-reload
					hreflang={locale}
					lang={locale}
					class="inline-block rounded-full px-4 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-50"
				>
					{LOCALE_NAMES[locale]}
				</a>
			</li>
		{/each}
	</ul>
</main>

<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { fileHref } from '$lib/paths';
	import {
		LOCALES,
		LOCALE_NAMES,
		absoluteUrl,
		pagePath,
		switchLocalePath,
		type Locale
	} from '$lib/locale';
	import * as m from '$lib/paraglide/messages';

	let { children, data } = $props();

	const locale = $derived(data.locale);
	const href = (path = '') => pagePath(base, locale, path) as ResolvedPathname;

	// Each nav item owns a set of route ids: entity pages belong to the glossary, the changelog
	// to "About".
	const navLinks = $derived([
		{ href: href(), label: m.nav_explore(), routes: ['/[locale=locale]'] },
		{
			href: href('glossary'),
			label: m.nav_glossary(),
			routes: ['/[locale=locale]/glossary', '/[locale=locale]/entity/[id]']
		},
		{
			href: href('views'),
			label: m.nav_questions(),
			routes: [
				'/[locale=locale]/views',
				'/[locale=locale]/views/[id]',
				'/[locale=locale]/stories/[id]'
			]
		},
		{
			href: href('about'),
			label: m.nav_about(),
			routes: ['/[locale=locale]/about', '/[locale=locale]/changelog']
		}
	]);

	const isActive = (routes: string[]) => routes.includes(page.route.id ?? '');

	// The query string is only known in the browser (prerendering has none), so the locale links
	// gain it after mount and on every navigation (the glossary keeps its filter in the URL).
	let search = $state('');
	onMount(() => (search = window.location.search));
	afterNavigate(() => (search = window.location.search));
	const localeHref = (target: Locale) =>
		(switchLocalePath(base, page.url.pathname, target) + search) as ResolvedPathname;

	// Canonical and hreflang alternates for every real page (not the error page).
	const alternates = $derived(
		page.status < 400
			? LOCALES.map((code) => ({
					hreflang: code,
					href: absoluteUrl(__SITE_URL__, switchLocalePath(base, page.url.pathname, code))
				}))
			: []
	);
	const canonical = $derived(
		page.status < 400 ? absoluteUrl(__SITE_URL__, page.url.pathname) : undefined
	);

	function skipToContent(event: MouseEvent) {
		const main = document.getElementById('main-content');
		if (!main) return;
		event.preventDefault();
		main.focus();
		main.scrollIntoView();
	}

	const linkClass =
		'text-blue-300 underline decoration-blue-300/40 underline-offset-2 hover:text-blue-200';
</script>

<svelte:head>
	<meta name="description" content={m.site_description()} />
	{#if canonical}
		<link rel="canonical" href={canonical} />
	{/if}
	{#each alternates as alternate (alternate.hreflang)}
		<link rel="alternate" hreflang={alternate.hreflang} href={alternate.href} />
	{/each}
	<link
		rel="alternate"
		type="application/rss+xml"
		title={m.footer_feed()}
		href={fileHref(`/${locale}/feed.xml`)}
	/>
</svelte:head>

<a
	href="#main-content"
	onclick={skipToContent}
	class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
>
	{m.skip_to_content()}
</a>

<div class="flex min-h-screen flex-col bg-white">
	<header
		class="z-40 flex w-full flex-wrap items-center justify-center gap-2 px-4 py-3 sm:sticky sm:top-0 sm:py-6 print:hidden"
	>
		<nav
			aria-label={m.nav_primary()}
			class="flex h-12 items-center gap-0.5 rounded-full bg-white p-1 shadow-sm ring-1 ring-zinc-200 sm:h-14 sm:gap-1"
		>
			<a
				href={href()}
				class="mr-1 hidden pl-3 font-heading text-sm font-semibold tracking-tight text-zinc-800 md:mr-2 md:inline"
			>
				{m.site_short_name()}
			</a>
			{#each navLinks as link (link.href)}
				<a
					href={link.href}
					aria-current={isActive(link.routes) ? 'page' : undefined}
					class={[
						'rounded-full px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-colors sm:px-4',
						isActive(link.routes) ? 'bg-blue-600 text-white' : 'text-zinc-700 hover:bg-zinc-100'
					]}
				>
					{link.label}
				</a>
			{/each}
		</nav>

		<div
			class="flex h-12 items-center gap-0.5 rounded-full bg-white p-1 shadow-sm ring-1 ring-zinc-200 sm:h-14"
			role="group"
			aria-label={m.language_switcher_label()}
		>
			{#each LOCALES as code (code)}
				<a
					href={localeHref(code)}
					data-testid={`locale-switch-${code}`}
					hreflang={code}
					lang={code}
					title={LOCALE_NAMES[code]}
					data-sveltekit-reload
					aria-current={locale === code ? 'true' : undefined}
					class={[
						'rounded-full px-3 py-2 text-xs font-semibold transition-colors',
						locale === code
							? 'bg-zinc-900 text-white'
							: 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-800'
					]}
				>
					{code.toUpperCase()}
				</a>
			{/each}
		</div>
	</header>

	<main id="main-content" tabindex="-1" class="flex-1 focus:outline-none">
		{@render children()}
	</main>

	<footer class="mt-16 bg-zinc-900 py-10 text-zinc-300 print:hidden">
		<div class="mx-auto max-w-5xl px-6">
			<ul class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
				<li>
					<a href={`${href('about')}#downloads` as ResolvedPathname} class={linkClass}
						>{m.footer_data()}</a
					>
				</li>
				<li>
					<a href={`${href('about')}#contribute` as ResolvedPathname} class={linkClass}
						>{m.footer_contribute()}</a
					>
				</li>
				<li>
					<a href={href('changelog')} class={linkClass} data-testid="last-updated"
						>{m.footer_changelog()}</a
					>
				</li>
				<li>
					<a href={fileHref(`/${locale}/feed.xml`)} class={linkClass} data-sveltekit-reload
						>{m.footer_feed()}</a
					>
				</li>
			</ul>
			<p class="mt-4 text-sm">{m.footer_last_reviewed({ date: data.summary.lastReviewed })}</p>
			<p class="mt-2 text-xs text-zinc-300">{m.footer_license()}</p>
		</div>
	</footer>
</div>

<script lang="ts">
	import * as m from '#lib/paraglide/messages.js';

	let { data } = $props();
</script>

<svelte:head>
	<title>{m.changelog_title()} · {m.site_name()}</title>
</svelte:head>

<!-- CHANGELOG.md is written in English; it starts with its own `# Changelog` h1. -->
<div class="mx-auto max-w-3xl px-4 pb-8 sm:px-6">
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped by renderMarkdown, repository content -->
	<div class="prose-content changelog pt-6 sm:pt-10" lang="en">{@html data.html}</div>
</div>

<style>
	.changelog :global(h1) {
		font-size: 2.25rem;
		font-weight: 600;
		color: var(--color-zinc-900);
	}
</style>

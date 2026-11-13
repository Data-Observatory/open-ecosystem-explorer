<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';
	import * as m from '$lib/paraglide/messages';

	// External links open in a new tab; the hidden text tells screen reader users (WCAG 3.2.5).
	let {
		href,
		class: className,
		children,
		...rest
	}: { href: string; class?: ClassValue; children: Snippet; [key: string]: unknown } = $props();
</script>

<a {href} target="_blank" rel="noopener noreferrer" class={className} {...rest}
	>{@render children()}<span class="sr-only"> {m.opens_in_new_tab()}</span></a
>

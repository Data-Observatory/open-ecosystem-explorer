<script lang="ts">
	import { tick } from 'svelte';
	import { changeChoice, consentState } from '#lib/consent/state.svelte.ts';
	import * as m from '#lib/paraglide/messages.js';

	let { class: className = '' }: { class?: string } = $props();

	async function change() {
		changeChoice();
		// The visitor asked for the question, so the banner (when shown) receives focus.
		await tick();
		document.getElementById('consent-banner')?.focus();
	}
</script>

<!-- Rendered only after mount: the prerendered HTML and the page without JavaScript have no control. -->
{#if consentState.ready}
	<button type="button" data-testid="consent-change" class={className} onclick={change}>
		{m.consent_change()}
	</button>
{/if}

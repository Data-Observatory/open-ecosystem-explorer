import { readdirSync } from 'node:fs';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { buildUrlPatterns } from './src/lib/url-patterns.ts';

const LOCALES = ['es', 'en'] as const;

// Deploy target/base path is not fixed at dev/test time (a static host, possibly at a
// sub-path): always driven by an env var, never hardcoded.
const base = (process.env.BASE_PATH ?? '') as '' | `/${string}`;

// Public origin used for absolute URLs (sitemap, feeds, canonical links). Undecided domain:
// configurable, never hardcoded. Empty means "emit root-relative URLs" (the Astro behaviour).
const siteUrl = (process.env.SITE_URL ?? '').replace(/\/+$/, '');

// One prerender entry per entity and per view, for every locale: explicit, not
// crawl-dependent, so every page exists in the static build even if nothing links to it.
const yamlIds = (dir: string) =>
	readdirSync(dir)
		.filter((name) => name.endsWith('.yaml'))
		.map((name) => name.slice(0, -'.yaml'.length))
		.sort();
const entityIds = yamlIds('src/content/entities');
const viewIds = yamlIds('src/content/views');
const storyIds = yamlIds('src/content/stories');

const perLocale = (paths: string[]): `/${string}`[] =>
	LOCALES.flatMap((locale) => paths.map((path) => `/${locale}${path}` as `/${string}`));

export default defineConfig({
	define: {
		// Baked in once at build time (not `new Date()` inside app code, which would re-run
		// on client hydration and drift from the prerendered server output).
		__BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
		__SITE_URL__: JSON.stringify(siteUrl)
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ pages: process.env.BUILD_DIR ?? 'build' }),
			prerender: {
				entries: [
					'*',
					'/',
					...perLocale([
						'/',
						'/glossary/',
						'/views/',
						'/about/',
						'/changelog/',
						...viewIds.map((id) => `/views/${id}/`),
						...storyIds.map((id) => `/stories/${id}/`),
						...entityIds.map((id) => `/entity/${id}/`)
					])
				]
			},
			paths: {
				base,
				// Absolute (base-rooted) links, not page-relative ones.
				relative: false
			}
		}),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			emitTsDeclarations: true,
			// No 'cookie': fully static site, nothing to persist a preference in. The locale is
			// always read from the URL prefix (see src/lib/url-patterns.ts).
			strategy: ['url', 'baseLocale'],
			urlPatterns: buildUrlPatterns(base)
		})
	],
	server: {
		// Reach the dev server through a Tailscale hostname, as the Astro config allowed.
		allowedHosts: ['.ts.net']
	}
});

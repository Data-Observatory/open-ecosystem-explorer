import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	{
		ignores: [
			// Legacy Astro map sources, kept only for the later map port (see MIGRATION.md).
			'src/components/**',
			'src/types/**',
			'src/pages/**',
			'src/layouts/**',
			'astro.config.mjs',
			// Pre-migration TypeScript, linted after the post-merge reformat (see MIGRATION.md).
			'src/lib/{a11y,export,graph,i18n,invariants,map,markdown,mermaid,model,stories,views}/**',
			'src/i18n/**',
			'scripts/**',
			'tests/unit/**',
			'tests/fixtures/**',
			'src/lib/paraglide/**',
			'src/generated/**'
		]
	},
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	}
);

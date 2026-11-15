#!/usr/bin/env tsx
// Link report. Requests every http(s) URL found in the content (entities, prose, vocabularies,
// stories) with HEAD, GET as fallback, prints a Markdown report and writes it to link-report.md.
// The exit code is 0 whether or not the report has findings; it is non-zero only when the script
// itself fails. Only HEAD and GET requests are made; nothing is submitted to a third party.
// Usage: npm run links
//        npm run links -- --only <entity-id>   (only the URLs of that entity's facts file)
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';

import { checkLinks, collectUrls, formatLinkReport } from '../src/lib/links/check.js';
import { REPO_URL } from '../src/lib/repo.js';

const ROOT = join(import.meta.dirname, '..');
const CONTENT = join(ROOT, 'src', 'content');

function usage(message?: string): never {
	if (message) console.error(`links: ${message}`);
	console.error('Usage: npm run links -- [--only <entity-id>]');
	process.exit(2);
}

let only: string | undefined;
const args = process.argv.slice(2);
for (let index = 0; index < args.length; index += 1) {
	const arg = args[index]!;
	if (arg === '--only') {
		only = args[++index];
		if (!only || only.startsWith('--')) usage('--only needs an entity id');
	} else if (arg.startsWith('--only=')) {
		only = arg.slice('--only='.length) || usage('--only needs an entity id');
	} else {
		usage(`unknown argument ${arg}`);
	}
}

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const full = join(dir, name);
		return statSync(full).isDirectory() ? walk(full) : [full];
	});
}

let files = walk(CONTENT).filter((file) => file.endsWith('.yaml'));
if (only !== undefined) {
	files = files.filter((file) => file === join(CONTENT, 'entities', `${only}.yaml`));
	if (files.length === 0)
		usage(`no entity with id "${only}" (expected src/content/entities/${only}.yaml)`);
}
const documents = files.sort().map((file) => ({
	file: relative(ROOT, file).split('\\').join('/'),
	data: parseYaml(readFileSync(file, 'utf8')) as unknown
}));

// Generic client name with the public repository, as Wikimedia and others ask. Nothing personal.
const userAgent = `open-ecosystem-explorer-link-check (+${REPO_URL})`;
const entries = collectUrls(documents);
const today = new Date();
const results = await checkLinks(
	entries.map((entry) => entry.url),
	{
		fetch,
		concurrency: 6,
		hostDelayMs: 500,
		timeoutMs: 15000,
		retries: 2,
		retryDelayMs: 1000,
		userAgent
	}
);

const { markdown } = formatLinkReport({
	results,
	usages: new Map(entries.map((entry) => [entry.url, entry.usages])),
	today
});

writeFileSync(join(ROOT, 'link-report.md'), markdown);
process.stdout.write(markdown);

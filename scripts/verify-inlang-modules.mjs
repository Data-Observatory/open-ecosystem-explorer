#!/usr/bin/env node
// The translation compiler (Paraglide, through the inlang SDK) downloads its two plugins from a
// CDN every time it compiles, and runs them. This pins what it may run:
//   - project.inlang/settings.json names each plugin at an exact version (npm versions are
//     immutable), and
//   - inlang-modules.lock.json holds the SHA-256 of each file.
// This script fetches each file and compares. A different file stops the build before the
// compiler runs it (`npm run paraglide:compile` runs this first, so `npm ci`, CI and the deploy
// all pass through it). To change a plugin on purpose, edit the version in settings.json and run
//   node scripts/verify-inlang-modules.mjs --update
// then read the diff of the lock file and check the files against the package on npm.
//
// No dependencies, so it can run before `npm ci` has finished. No personal data is sent: a plain
// GET with a generic user agent.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = join(import.meta.dirname, '..');
const SETTINGS = join(ROOT, 'project.inlang', 'settings.json');
const LOCK = join(ROOT, 'inlang-modules.lock.json');

/** An exact version on the one CDN we use, for a file under dist/. Anything else is refused. */
const PINNED =
	/^https:\/\/cdn\.jsdelivr\.net\/npm\/@[a-z0-9._-]+\/[a-z0-9._-]+@\d+\.\d+\.\d+\/dist\/[A-Za-z0-9._/-]+\.js$/;

/** @param {string} url */
export const isPinned = (url) => PINNED.test(url);

/** @param {Uint8Array} bytes */
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/**
 * Compares the modules in settings with the lock and with what `fetchBytes(url)` returns.
 * Returns a list of problems; empty means the build may go on.
 * @param {string[]} modules
 * @param {Record<string, string>} lock
 * @param {(url: string) => Promise<Uint8Array>} fetchBytes
 * @returns {Promise<string[]>}
 */
export async function verify(modules, lock, fetchBytes) {
	/** @type {string[]} */
	const problems = [];
	for (const url of modules) {
		if (!isPinned(url)) problems.push(`not pinned to an exact version on the CDN: ${url}`);
	}
	for (const url of modules) {
		if (!(url in lock)) problems.push(`no hash in inlang-modules.lock.json for ${url}`);
	}
	for (const url of Object.keys(lock)) {
		if (!modules.includes(url))
			problems.push(`the lock has a hash for a module that is not used: ${url}`);
	}
	for (const url of modules) {
		if (!(url in lock) || !isPinned(url)) continue;
		let found;
		try {
			found = sha256(await fetchBytes(url));
		} catch (error) {
			problems.push(`could not fetch ${url}: ${error instanceof Error ? error.message : error}`);
			continue;
		}
		if (found !== lock[url]) {
			problems.push(`the file at ${url} changed: expected sha256 ${lock[url]}, got ${found}`);
		}
	}
	return problems;
}

/** @param {string} url */
async function fetchBytes(url) {
	const response = await fetch(url, { headers: { 'user-agent': 'open-ecosystem-explorer-build' } });
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return new Uint8Array(await response.arrayBuffer());
}

async function main() {
	const modules = JSON.parse(readFileSync(SETTINGS, 'utf8')).modules ?? [];
	if (process.argv.includes('--update')) {
		/** @type {Record<string, string>} */
		const lock = {};
		for (const url of modules) {
			if (!isPinned(url)) throw new Error(`not pinned to an exact version: ${url}`);
			lock[url] = sha256(await fetchBytes(url));
		}
		writeFileSync(LOCK, JSON.stringify(lock, null, '\t') + '\n');
		console.log(`Wrote ${LOCK} for ${modules.length} modules.`);
		return;
	}
	const lock = JSON.parse(readFileSync(LOCK, 'utf8'));
	const problems = await verify(modules, lock, fetchBytes);
	if (problems.length) {
		console.error('inlang modules: refusing to compile the translations.');
		for (const problem of problems) console.error(`  - ${problem}`);
		process.exit(1);
	}
	console.log(`inlang modules: ${modules.length} pinned and verified.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error(error);
		process.exit(1);
	});
}

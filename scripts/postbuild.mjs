// Post-build fix-ups of the static output (adapted from the sister sites'
// remove-unlocalized-pages.mjs). static/404.html uses relative links; set the document base to
// the deploy base path so they resolve to /<base>/es/ and /<base>/en/ whatever the missing URL was.
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const buildDir = process.env.BUILD_DIR
	? pathToFileURL(`${resolve(process.env.BUILD_DIR)}/`)
	: new URL('../build/', import.meta.url);

const notFound = new URL('404.html', buildDir);
if (existsSync(notFound)) {
	const base = (process.env.BASE_PATH ?? '').replace(/\/+$/, '');
	const html = await readFile(notFound, 'utf8');
	if (!/<base\s/i.test(html)) {
		await writeFile(notFound, html.replace(/<head>/i, `<head>\n\t\t<base href="${base}/" />`));
		console.log(`set <base href="${base}/"> in build/404.html`);
	}
}

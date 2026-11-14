/**
 * Locale-free exports and machine-readable files: data dumps, per-entity JSON, sitemap,
 * per-locale RSS feed and search index. URLs become absolute when SITE_URL is set at build
 * time.
 */
import { getSiteIndex } from '../../content/site-index.js';
import {
	buildGraphExport,
	exportEntity,
	toEntitiesCsv,
	toRelationsCsv
} from '../export/build-export.js';
import { resolveProse } from '../i18n/resolve.js';
import { absoluteUrl, LOCALES, pagePath, type Locale } from '../locale.js';
import { entityIds, storyIds, viewIds } from './site.js';

export async function entitiesCsv(): Promise<string> {
	return toEntitiesCsv(buildGraphExport(await getSiteIndex()));
}

export async function relationsCsv(): Promise<string> {
	return toRelationsCsv(buildGraphExport(await getSiteIndex()));
}

export async function graphJson(): Promise<string> {
	return JSON.stringify(buildGraphExport(await getSiteIndex()), null, 2);
}

export async function entityJson(id: string): Promise<string | undefined> {
	const entity = exportEntity(await getSiteIndex(), id);
	return entity ? JSON.stringify(entity, null, 2) : undefined;
}

function esc(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** Every real page below the locale (not the legacy redirects). */
async function pagePaths(): Promise<string[]> {
	return [
		'',
		'glossary',
		'views',
		'about',
		'changelog',
		...(await viewIds()).map((id) => `views/${id}`),
		...(await storyIds()).map((id) => `stories/${id}`),
		...(await entityIds()).map((id) => `entity/${id}`)
	];
}

export async function sitemapXml(base: string, siteUrl: string): Promise<string> {
	const url = (locale: Locale, path: string) =>
		esc(absoluteUrl(siteUrl, pagePath(base, locale, path)));
	const urls = (await pagePaths())
		.flatMap((path) =>
			LOCALES.map((locale) => {
				const alternates = LOCALES.map(
					(alt) => `    <xhtml:link rel="alternate" hreflang="${alt}" href="${url(alt, path)}"/>`
				).join('\n');
				return `  <url>\n    <loc>${url(locale, path)}</loc>\n${alternates}\n  </url>`;
			})
		)
		.join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
}

export function robotsTxt(base: string, siteUrl: string): string {
	return `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl(siteUrl, `${base}/sitemap.xml`)}\n`;
}

export async function feedXml(
	locale: Locale,
	base: string,
	siteUrl: string,
	text: { title: string; description: string }
): Promise<string> {
	const index = await getSiteIndex();
	const items = [...index.entities.values()]
		.sort((a, b) => b.lastReviewed.localeCompare(a.lastReviewed) || a.id.localeCompare(b.id))
		.slice(0, 30)
		.map((entity) => {
			const { prose } = resolveProse(index, entity.id, locale);
			const link = esc(absoluteUrl(siteUrl, pagePath(base, locale, `entity/${entity.id}`)));
			return `  <item>\n    <title>${esc(prose.name ?? entity.name)}</title>\n    <link>${link}</link>\n    <guid>${link}</guid>\n    <pubDate>${new Date(`${entity.lastReviewed}T00:00:00Z`).toUTCString()}</pubDate>\n    <description>${esc(prose.summary)}</description>\n  </item>`;
		})
		.join('\n');
	const home = esc(absoluteUrl(siteUrl, pagePath(base, locale)));
	return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>\n  <title>${esc(text.title)}</title>\n  <link>${home}</link>\n  <description>${esc(text.description)}</description>\n  <language>${locale}</language>\n${items}\n</channel></rss>\n`;
}

/** Per-locale search index (kept for compatibility; the glossary filters its own list). */
export async function searchIndexJson(locale: Locale): Promise<string> {
	const index = await getSiteIndex();
	const entries = [...index.entities.values()]
		.sort((a, b) => a.id.localeCompare(b.id))
		.map((entity) => {
			const { prose } = resolveProse(index, entity.id, locale);
			return {
				id: entity.id,
				name: prose.name ?? entity.name,
				aka: prose.aka ?? entity.aka ?? [],
				summary: prose.summary,
				tags: entity.tags,
				type: entity.type
			};
		});
	return JSON.stringify(entries);
}

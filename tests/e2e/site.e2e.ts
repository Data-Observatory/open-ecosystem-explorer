import { expect, test } from '@playwright/test';
import { pathOf } from './helpers';

test.describe('home', () => {
	test('/es/ has the title, intro, story chips and the map', async ({ page }) => {
		await page.goto('/es/');
		await expect(page.locator('html')).toHaveAttribute('lang', 'es');
		await expect(page.locator('h1')).toHaveText('Explorador del ecosistema abierto');
		await expect(page.getByTestId('home-stats')).toContainText('entradas');
		await expect(page.getByTestId('question-chips').locator('a')).toHaveCount(5);
		await expect(page.getByTestId('map-canvas')).toBeVisible();
	});

	test('the story page lists the steps and offers to play them on the map', async ({ page }) => {
		await page.goto('/en/stories/what-is-a-doi/');
		await expect(page.getByTestId('story-steps').locator('> li').first()).toBeVisible();
		await page.getByTestId('story-play').click();
		await page.waitForURL('**/en/?historia=what-is-a-doi&paso=1');
		await expect(page.getByTestId('story-bar')).toBeVisible();
	});

	test('/ redirects to the default locale', async ({ page }) => {
		await page.goto('/');
		await page.waitForURL((url) => pathOf(url.href) === '/es');
		await expect(page.locator('h1')).toBeVisible();
	});
});

test.describe('navigation', () => {
	test('the four nav items lead to their pages and mark the current one', async ({ page }) => {
		await page.goto('/es/');
		const nav = page.getByRole('navigation', { name: 'Principal' });
		const items = [
			['Glosario', '/es/glossary', 'Glosario'],
			['Preguntas', '/es/views', 'Preguntas'],
			['Acerca de', '/es/about', 'Acerca de'],
			['Explorar', '/es', 'Explorador del ecosistema abierto']
		] as const;
		for (const [label, path, heading] of items) {
			await nav.getByRole('link', { name: label, exact: true }).click();
			await page.waitForURL((url) => pathOf(url.href) === path);
			await expect(page.locator('h1')).toHaveText(heading);
			await expect(nav.getByRole('link', { name: label, exact: true })).toHaveAttribute(
				'aria-current',
				'page'
			);
		}
	});

	test('the skip link moves focus to the main content', async ({ page }) => {
		await page.goto('/es/glossary/');
		await page.keyboard.press('Tab');
		const skip = page.getByRole('link', { name: 'Saltar al contenido' });
		await expect(skip).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(page.locator('main#main-content')).toBeFocused();
	});
});

test.describe('language switch keeps the page', () => {
	for (const path of ['', 'glossary/', 'entity/doi/', 'views/vertical-integration/', 'about/']) {
		test(`/es/${path} <-> /en/${path}`, async ({ page }) => {
			await page.goto(`/es/${path}`);
			await page.getByTestId('locale-switch-en').click();
			await page.waitForURL((url) => url.pathname === `/en/${path}`);
			await expect(page.locator('html')).toHaveAttribute('lang', 'en');
			await page.getByTestId('locale-switch-es').click();
			await page.waitForURL((url) => url.pathname === `/es/${path}`);
			await expect(page.locator('html')).toHaveAttribute('lang', 'es');
		});
	}
});

test.describe('glossary', () => {
	test('lists every entry and filters by text and type, keeping the filter in the URL', async ({
		page
	}) => {
		await page.goto('/es/glossary/');
		const entries = page.getByTestId('glossary-entry');
		const total = await entries.count();
		expect(total).toBeGreaterThan(100);

		await page.getByLabel('Filtrar el glosario').fill('indice');
		await expect(page.getByTestId('glossary-count')).not.toContainText(`${total} de ${total}`);
		const shownByText = await page.locator('[data-testid=glossary-entry]:visible').count();
		expect(shownByText).toBeGreaterThan(0);
		expect(shownByText).toBeLessThan(total);
		await expect(page).toHaveURL(/\?q=indice/);

		await page.getByLabel('Filtrar el glosario').fill('');
		await page.getByTestId('type-chips').locator('button[data-type=identifier]').click();
		await expect(
			page.getByTestId('type-chips').locator('button[data-type=identifier]')
		).toHaveAttribute('aria-pressed', 'true');
		const visibleTypes = await page
			.locator('[data-testid=glossary-entry]:visible')
			.evaluateAll((nodes) => [...new Set(nodes.map((n) => n.getAttribute('data-type')))]);
		expect(visibleTypes).toEqual(['identifier']);

		await page.getByRole('button', { name: 'Quitar filtros' }).click();
		await expect(page.locator('[data-testid=glossary-entry]:visible')).toHaveCount(total);
	});

	test('reads the filter from the URL', async ({ page }) => {
		await page.goto('/en/glossary/?q=doi&type=identifier');
		await expect(page.getByLabel('Filter the glossary')).toHaveValue('doi');
		await expect(page.locator('[data-testid=glossary-entry]:visible').first()).toBeVisible();
		await expect(page.locator('[data-entry-id=doi]')).toBeVisible();
	});
});

test.describe('entity page', () => {
	test('shows type, definition, relations as sentences, links and collapsed details', async ({
		page
	}) => {
		await page.goto('/es/entity/doi/');
		await expect(page.locator('h1')).toHaveText('DOI');
		await expect(page.getByTestId('entity-type')).toHaveText('Identificador');
		await expect(page.getByTestId('entity-summary')).not.toBeEmpty();
		await expect(page.getByTestId('local-note')).toBeVisible();
		await expect(page.getByTestId('relation-sentences').first()).toContainText('DOI');
		// Neutral group headings; loose `related-to` links are their own last group.
		const headings = await page
			.locator('section[aria-labelledby=relations-h] h3')
			.allTextContents();
		expect(headings[0]?.trim()).toBe('Qué es');
		expect(headings.at(-1)?.trim()).toBe('Relacionado con');
		expect(headings.join(' ')).not.toContain('Es un/a');
		await expect(
			page.getByTestId('relation-sentences').getByRole('link', { name: 'Crossref' })
		).toHaveAttribute('href', '/es/entity/crossref/');

		const wikipedia = page.locator('[data-link-kind=wikipedia]');
		await expect(wikipedia).toHaveAttribute('href', /Special:GoToLinkedPage\/eswiki\/Q\d+/);
		await expect(wikipedia).toHaveAttribute('target', '_blank');
		await expect(wikipedia).toHaveAttribute('rel', /noopener/);

		const details = page.getByTestId('entity-details');
		await expect(details).not.toHaveAttribute('open', /.*/);
		await details.locator('summary').click();
		await expect(details.getByRole('table')).toBeVisible();
	});

	test('an unknown entity is a 404 page', async ({ page }) => {
		const response = await page.goto('/es/entity/no-such-entity/');
		expect(response?.status()).toBe(404);
	});
});

test.describe('about and data', () => {
	test('about has its six sections', async ({ page }) => {
		await page.goto('/en/about/');
		for (const id of ['scope', 'reading', 'model', 'downloads', 'contribute', 'changelog']) {
			await expect(page.locator(`h2#${id}`)).toBeVisible();
		}
	});

	for (const [path, type] of [
		['/data/entities.csv', 'text/csv'],
		['/data/relations.csv', 'text/csv'],
		['/data/graph.json', 'application/json'],
		['/entity/doi.json', 'application/json'],
		['/sitemap.xml', 'xml'],
		['/es/feed.xml', 'xml'],
		['/robots.txt', 'text/plain']
	] as const) {
		test(`${path} is served`, async ({ request }) => {
			const response = await request.get(path);
			expect(response.status()).toBe(200);
			expect(response.headers()['content-type']).toContain(type);
		});
	}
});

test.describe('suggest a change (GitHub issues)', () => {
	const repo = 'https://github.com/Data-Observatory/open-ecosystem-explorer';

	for (const [locale, footer, description, connection] of [
		[
			'es',
			'Sugerir un cambio',
			'Sugerir un cambio en la descripción o los datos',
			'Sugerir un cambio en sus conexiones'
		],
		[
			'en',
			'Suggest a change',
			'Suggest a change to the description or facts',
			'Suggest a change to its connections'
		]
	] as const) {
		test(`/${locale}/: the footer and the entry page link to the issue forms`, async ({ page }) => {
			await page.goto(`/${locale}/entity/doi/`);
			const foot = page.getByTestId('footer-suggest');
			await expect(foot).toContainText(footer);
			await expect(foot).toHaveAttribute('href', `${repo}/issues/new/choose`);
			await expect(foot).toHaveAttribute('target', '_blank');
			await expect(foot).toHaveAttribute('rel', /noopener/);

			for (const [testId, label, template, field, prefix] of [
				['entity-suggest-description', description, 'description.yml', 'entity', '[Description]'],
				['entity-suggest-connection', connection, 'connection.yml', 'entity_a', '[Connection]']
			] as const) {
				const link = page.getByTestId(testId);
				await expect(link).toContainText(label);
				const url = new URL((await link.getAttribute('href')) ?? '');
				expect(url.origin + url.pathname).toBe(`${repo}/issues/new`);
				expect(url.searchParams.get('template')).toBe(template);
				expect(url.searchParams.get(field)).toBe('doi');
				expect(url.searchParams.get('title')?.startsWith(`${prefix} `)).toBe(true);
				expect(url.searchParams.get('title')).toContain('DOI');
			}
		});

		test(`/${locale}/about/: the contribute section offers the issue forms and no email`, async ({
			page
		}) => {
			await page.goto(`/${locale}/about/`);
			await expect(page.getByTestId('about-issues').getByRole('link')).toHaveAttribute(
				'href',
				`${repo}/issues/new/choose`
			);
			await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
		});
	}

	test('opening a page sends nothing to GitHub', async ({ page }) => {
		const requests: string[] = [];
		page.on('request', (r) => requests.push(r.url()));
		await page.goto('/en/entity/doi/');
		await page.waitForLoadState('networkidle');
		expect(requests.filter((u) => u.includes('github.com'))).toEqual([]);
	});
});

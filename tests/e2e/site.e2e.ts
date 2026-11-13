import { expect, test } from '@playwright/test';
import { pathOf } from './helpers';

test.describe('home', () => {
	test('/es/ has the title, intro, story chips and the map placeholder', async ({ page }) => {
		await page.goto('/es/');
		await expect(page.locator('html')).toHaveAttribute('lang', 'es');
		await expect(page.locator('h1')).toHaveText('Explorador del ecosistema de ciencia abierta');
		await expect(page.getByTestId('home-stats')).toContainText('entradas');
		await expect(page.getByTestId('question-chips').locator('a')).toHaveCount(5);
		await expect(page.getByTestId('map-placeholder')).toBeVisible();
	});

	test('a question chip opens the story step list', async ({ page }) => {
		await page.goto('/en/');
		await page.getByRole('link', { name: 'What is a DOI and who issues it?' }).click();
		await page.waitForURL('**/en/stories/what-is-a-doi/');
		await expect(page.getByTestId('story-steps').locator('> li').first()).toBeVisible();
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
			['Explorar', '/es', 'Explorador del ecosistema de ciencia abierta']
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

	test('the old search URL lands on the glossary with its query', async ({ page }) => {
		await page.goto('/es/search/?q=orcid');
		await page.waitForURL('**/es/glossary/?q=orcid');
		await expect(page.locator('[data-entry-id=orcid]')).toBeVisible();
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

	for (const [legacy, target] of [
		['/es/entities/', '/es/glossary/'],
		['/es/entities/identifier/', '/es/glossary/?type=identifier'],
		['/en/relations/owned-by/', '/en/about/#model'],
		['/en/map2/', '/en/'],
		['/es/contribute/', '/es/about/#contribute']
	] as const) {
		test(`${legacy} redirects to ${target}`, async ({ page }) => {
			await page.goto(legacy);
			await page.waitForURL((url) => `${url.pathname}${url.search}${url.hash}` === target);
		});
	}
});

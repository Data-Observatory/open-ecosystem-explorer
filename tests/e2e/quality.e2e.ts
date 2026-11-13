import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, expectNoHorizontalScroll } from './helpers';

const KEY_PAGES = [
	'/es/',
	'/en/',
	'/es/glossary/',
	'/en/glossary/?q=doi&type=identifier',
	'/es/entity/doi/',
	'/en/entity/crossref/',
	'/es/views/',
	'/en/views/vertical-integration/',
	'/es/stories/what-is-a-doi/',
	'/es/about/',
	'/en/changelog/'
];

test.describe('accessibility (WCAG 2.2 AA, axe)', () => {
	for (const url of KEY_PAGES) {
		test(`${url} has no violations`, async ({ page }) => {
			await page.goto(url);
			await expect(page.locator('h1')).toHaveCount(1);
			await expectNoA11yViolations(page);
		});
	}

	test('entity page with Details open has no violations', async ({ page }) => {
		await page.goto('/es/entity/orcid/');
		await page.getByTestId('entity-details').locator('summary').click();
		await expectNoA11yViolations(page);
	});
});

test.describe('phone viewport 390x844', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	for (const url of KEY_PAGES) {
		test(`${url} has no horizontal scroll (header included)`, async ({ page }) => {
			await page.goto(url);
			await expect(page.getByRole('navigation', { name: /Principal|Main/ })).toBeVisible();
			await expectNoHorizontalScroll(page);
		});
	}
});

test.describe('no JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('the glossary lists every entry and hides the filter controls', async ({ page }) => {
		await page.goto('/es/glossary/');
		await expect(page.getByTestId('glossary-filter')).toBeHidden();
		const entries = page.getByTestId('glossary-entry');
		expect(await entries.count()).toBeGreaterThan(100);
		await expect(entries.first()).toBeVisible();
	});

	test('the entity Details disclosure works natively', async ({ page }) => {
		await page.goto('/en/entity/doi/');
		await page.getByTestId('entity-details').locator('summary').click();
		await expect(page.getByTestId('entity-details').getByRole('table')).toBeVisible();
	});
});

// The one third-party request is Google Tag Manager, on by default and opt-out (see
// consent.e2e.ts). With a stored "denied" choice nothing else leaves the site either.
test('no request leaves the site once analytics are turned off', async ({ page }) => {
	await page.addInitScript((key) => {
		const date = new Date();
		const iso = [
			date.getFullYear(),
			String(date.getMonth() + 1).padStart(2, '0'),
			String(date.getDate()).padStart(2, '0')
		].join('-');
		window.localStorage.setItem(key, JSON.stringify({ v: 1, choice: 'denied', date: iso }));
	}, 'oee-consent');
	const external: string[] = [];
	page.on('request', (request) => {
		if (!request.url().startsWith('http://127.0.0.1')) external.push(request.url());
	});
	for (const url of ['/es/', '/es/glossary/', '/es/entity/doi/', '/es/about/']) {
		await page.goto(url, { waitUntil: 'networkidle' });
	}
	expect(external).toEqual([]);
});

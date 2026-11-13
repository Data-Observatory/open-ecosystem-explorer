import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectNoA11yViolations, expectNoHorizontalScroll } from './helpers';

// Analytics are on by default: Google Tag Manager loads unless the visitor stored a current
// "denied" choice, and a notice lets the visitor turn it off at any time. The two buttons have equal
// weight and the choice can be changed from the footer and from the About page. The Google hosts
// are stubbed so a test run never reaches Google (playwright.config.ts also makes them unresolvable);
// the requests are still observed.

const GOOGLE_HOST = /(^|\.)(googletagmanager|google-analytics)\.com$|(^|\.)analytics\.google\.com$/;
const TAG_URL = 'https://www.googletagmanager.com/gtm.js?id=GTM-M9NXQLBC';
const KEY = 'oee-consent';

const PAGES = [
	'/es/',
	'/en/',
	'/es/about/',
	'/en/about/',
	'/es/glossary/',
	'/en/entity/doi/',
	'/es/views/',
	'/en/changelog/'
];

const TEXT = {
	en: { keep: 'Keep analytics on', disable: 'Turn off analytics', change: 'Analytics settings' },
	es: {
		keep: 'Mantener la analítica',
		disable: 'Desactivar la analítica',
		change: 'Ajustes de analítica'
	}
} as const;

const banner = (page: Page) => page.getByTestId('consent-banner');
const keepOn = (page: Page) => page.getByTestId('consent-keep');
const turnOff = (page: Page) => page.getByTestId('consent-disable');
// Rendered only after hydration, so its presence also shows that the page is interactive.
const footerChange = (page: Page) => page.locator('footer').getByTestId('consent-change');

/** Stubs the Google hosts and returns the list of requests made to them (filled as they happen). */
async function watchGoogle(page: Page): Promise<string[]> {
	const requests: string[] = [];
	page.on('request', (request) => {
		if (GOOGLE_HOST.test(new URL(request.url()).hostname)) requests.push(request.url());
	});
	await page.route(
		(target) => GOOGLE_HOST.test(target.hostname),
		(route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: '' })
	);
	return requests;
}

async function open(page: Page, url: string): Promise<void> {
	await page.goto(url);
	await expect(page.locator('h1')).toBeVisible();
	await expect(footerChange(page).or(banner(page)).first()).toBeVisible();
}

const stored = (page: Page) => page.evaluate((key) => window.localStorage.getItem(key), KEY);

/** Seeds a stored choice before the page's own scripts run (only when none is stored yet). */
async function seed(page: Page, choice: string, daysAgo: number, version = 1): Promise<void> {
	await page.addInitScript(
		([key, value, days, v]) => {
			try {
				if (window.localStorage.getItem(key) !== null) return;
				const date = new Date();
				date.setDate(date.getDate() - Number(days));
				const iso = [
					date.getFullYear(),
					String(date.getMonth() + 1).padStart(2, '0'),
					String(date.getDate()).padStart(2, '0')
				].join('-');
				window.localStorage.setItem(key, JSON.stringify({ v, choice: value, date: iso }));
			} catch {
				// Storage is not available: nothing to seed.
			}
		},
		[KEY, choice, daysAgo, version] as const
	);
}

const setCookies = (page: Page) =>
	page.evaluate(() => {
		document.cookie = '_ga=GA1.1.1.1; path=/';
		document.cookie = '_ga_ABC123DEF4=GS2.1.1; path=/';
		document.cookie = '_gid=GA1.1.2.2; path=/';
		document.cookie = 'theme=plain; path=/';
	});
const cookieNames = (page: Page) =>
	page.evaluate(() =>
		document.cookie
			.split('; ')
			.filter(Boolean)
			.map((pair) => pair.split('=')[0])
	);

const tagRequests = (google: string[]) =>
	google.filter((item) => item.startsWith('https://www.googletagmanager.com/gtm.js'));
const consentCalls = (page: Page) =>
	page.evaluate(() =>
		(window as unknown as { dataLayer: ArrayLike<unknown>[] }).dataLayer
			.map((entry) => (typeof entry.length === 'number' ? Array.from(entry) : entry))
			.filter((entry) => Array.isArray(entry) && entry[0] === 'consent')
	);

test.describe('first visit', () => {
	for (const url of PAGES) {
		test(`${url} shows the notice and loads the container once, without a stored choice`, async ({
			page
		}) => {
			const google = await watchGoogle(page);
			await open(page, url);
			await expect(banner(page)).toBeVisible();
			await expect(keepOn(page)).toBeVisible();
			await expect(turnOff(page)).toBeVisible();
			await expect.poll(() => tagRequests(google)).toEqual([TAG_URL]);
			expect(await stored(page)).toBeNull();
		});
	}

	test('Consent Mode v2 is set before the container: analytics granted, ads always denied', async ({
		page
	}) => {
		await watchGoogle(page);
		await open(page, '/es/');
		expect(await consentCalls(page)).toEqual([
			[
				'consent',
				'default',
				{
					analytics_storage: 'granted',
					ad_storage: 'denied',
					ad_user_data: 'denied',
					ad_personalization: 'denied'
				}
			]
		]);
	});

	test('the gateway page / counts one visit: the container loads once, on the locale page', async ({
		page
	}) => {
		const google = await watchGoogle(page);
		await page.goto('/');
		await page.waitForURL((target) => /^\/(es|en)\/?$/.test(target.pathname));
		await expect(banner(page)).toBeVisible();
		await expect.poll(() => tagRequests(google)).toEqual([TAG_URL]);
	});

	for (const locale of ['en', 'es'] as const) {
		test(`/${locale}/ notice buttons have the expected names`, async ({ page }) => {
			await watchGoogle(page);
			await open(page, `/${locale}/`);
			await expect(banner(page).getByRole('button', { name: TEXT[locale].keep })).toBeVisible();
			await expect(banner(page).getByRole('button', { name: TEXT[locale].disable })).toBeVisible();
		});
	}

	test('the notice names Google Tag Manager and says it can be turned off', async ({ page }) => {
		await watchGoogle(page);
		await open(page, '/en/');
		await expect(banner(page)).toContainText('Google Tag Manager');
		await expect(banner(page)).toContainText('turn it off');
		await open(page, '/es/');
		await expect(banner(page)).toContainText('Google Tag Manager');
		await expect(banner(page)).toContainText('desactivarla');
	});

	test('the two buttons have the same size and style', async ({ page }) => {
		await watchGoogle(page);
		await open(page, '/en/');
		await expect(banner(page)).toBeVisible();
		const style = (button: Locator) =>
			button.evaluate((element) => {
				const css = getComputedStyle(element);
				const box = element.getBoundingClientRect();
				return {
					color: css.color,
					background: css.backgroundColor,
					border: css.borderTopColor + css.borderTopWidth,
					font: css.fontSize + css.fontWeight,
					height: Math.round(box.height)
				};
			});
		expect(await style(turnOff(page))).toEqual(await style(keepOn(page)));
	});

	test('the notice is in the normal flow, right after the skip link, and is not fixed', async ({
		page
	}) => {
		await watchGoogle(page);
		await open(page, '/en/');
		await expect(banner(page)).toBeVisible();
		expect(await banner(page).evaluate((element) => getComputedStyle(element).position)).toBe(
			'static'
		);
		const order = await page.evaluate(() =>
			Array.from(document.body.querySelectorAll('a[href="#main-content"], header, section'))
				.slice(0, 3)
				.map((element) => element.getAttribute('data-testid') ?? element.tagName)
		);
		expect(order).toEqual(['A', 'consent-banner', 'HEADER']);
	});

	test('the loader script is served and the HTML carries no inline Google tag', async ({
		request
	}) => {
		const loader = await request.get('/consent-loader.js');
		expect(loader.ok()).toBe(true);
		expect(await loader.text()).toContain('oee-consent');
		for (const url of ['/es/', '/en/about/', '/es/entity/doi/', '/']) {
			const html = await (await request.get(url)).text();
			expect(html, url).toContain('consent-loader.js');
			expect(html, url).not.toContain('googletagmanager');
			expect(html, url).not.toContain('GTM-M9NXQLBC');
		}
	});
});

test.describe('phone viewport 390x844', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	for (const url of ['/es/', '/en/', '/es/about/', '/en/glossary/', '/es/entity/doi/']) {
		test(`${url} does not scroll sideways with the notice shown`, async ({ page }) => {
			await watchGoogle(page);
			await open(page, url);
			await expect(banner(page)).toBeVisible();
			await expect(turnOff(page)).toBeVisible();
			await expectNoHorizontalScroll(page);
		});
	}
});

test.describe('Turn off analytics', () => {
	for (const url of PAGES) {
		test(`${url} stores the choice and keeps Google silent after a reload`, async ({ page }) => {
			const google = await watchGoogle(page);
			await open(page, url);
			await turnOff(page).click();
			await expect(banner(page)).toHaveCount(0);
			expect(JSON.parse((await stored(page)) ?? 'null')).toMatchObject({ v: 1, choice: 'denied' });
			expect((await consentCalls(page)).at(-1)).toEqual([
				'consent',
				'update',
				{
					analytics_storage: 'denied',
					ad_storage: 'denied',
					ad_user_data: 'denied',
					ad_personalization: 'denied'
				}
			]);

			google.length = 0;
			await page.reload();
			await expect(footerChange(page)).toBeVisible();
			await page.waitForLoadState('networkidle');
			await expect(banner(page)).toHaveCount(0);
			// No request at all to googletagmanager.com (or any Google analytics host).
			expect(google).toEqual([]);
			expect(await page.locator('script[src*="googletagmanager"]').count()).toBe(0);
		});
	}

	test('deletes the Google Analytics cookies and keeps other cookies', async ({ page }) => {
		await watchGoogle(page);
		await open(page, '/en/');
		await setCookies(page);
		await turnOff(page).click();
		await expect(banner(page)).toHaveCount(0);
		expect(await cookieNames(page)).toEqual(['theme']);
	});
});

test.describe('Keep analytics on', () => {
	for (const url of ['/en/', '/es/', '/en/about/', '/es/glossary/']) {
		test(`${url} stores the choice and loads the container once, also after a reload`, async ({
			page
		}) => {
			const google = await watchGoogle(page);
			await open(page, url);
			await keepOn(page).click();
			await expect(banner(page)).toHaveCount(0);
			expect(JSON.parse((await stored(page)) ?? 'null')).toMatchObject({ v: 1, choice: 'granted' });
			await expect.poll(() => tagRequests(google)).toEqual([TAG_URL]);

			google.length = 0;
			await page.reload();
			await expect(footerChange(page)).toBeVisible();
			await page.waitForLoadState('networkidle');
			await expect(banner(page)).toHaveCount(0);
			expect(tagRequests(google)).toEqual([TAG_URL]);
		});
	}

	test('navigating inside the site does not load the container again', async ({ page }) => {
		const google = await watchGoogle(page);
		await open(page, '/en/');
		await keepOn(page).click();
		await expect.poll(() => google.length).toBeGreaterThan(0);
		await page
			.getByRole('navigation', { name: 'Main' })
			.getByRole('link', { name: 'About' })
			.click();
		await expect(page).toHaveURL(/\/en\/about\/?$/);
		await page.waitForLoadState('networkidle');
		expect(tagRequests(google)).toEqual([TAG_URL]);
		await expect(banner(page)).toHaveCount(0);
	});

	test('a choice made 364 days ago still applies', async ({ page }) => {
		const google = await watchGoogle(page);
		await seed(page, 'granted', 364);
		await page.goto('/en/');
		await expect(footerChange(page)).toBeVisible();
		await expect(banner(page)).toHaveCount(0);
		await expect.poll(() => tagRequests(google)).toEqual([TAG_URL]);
	});
});

test.describe('stored choices', () => {
	test('a denied choice made today keeps the notice away and Google silent', async ({ page }) => {
		const google = await watchGoogle(page);
		await seed(page, 'denied', 0);
		await page.goto('/en/');
		await expect(footerChange(page)).toBeVisible();
		await expect(banner(page)).toHaveCount(0);
		await page.waitForLoadState('networkidle');
		expect(google).toEqual([]);
	});

	test('a denied choice on the gateway page and on every locale page sends nothing to Google', async ({
		page
	}) => {
		const google = await watchGoogle(page);
		await seed(page, 'denied', 10);
		await page.goto('/');
		await page.waitForURL((target) => /^\/(es|en)\/?$/.test(target.pathname));
		for (const url of ['/es/about/', '/en/glossary/', '/es/entity/doi/']) {
			await page.goto(url);
			await expect(footerChange(page)).toBeVisible();
		}
		await page.waitForLoadState('networkidle');
		expect(google).toEqual([]);
	});

	test('a denied choice older than 365 days shows the notice again and loads the container', async ({
		page
	}) => {
		const google = await watchGoogle(page);
		await seed(page, 'denied', 366);
		await page.goto('/es/');
		await expect(banner(page)).toBeVisible();
		await expect.poll(() => tagRequests(google)).toEqual([TAG_URL]);
	});

	test('a stored value in another version shows the notice and loads the container', async ({
		page
	}) => {
		const google = await watchGoogle(page);
		await seed(page, 'denied', 1, 2);
		await page.goto('/en/');
		await expect(banner(page)).toBeVisible();
		await expect.poll(() => tagRequests(google)).toEqual([TAG_URL]);
	});

	test('a malformed stored value shows the notice and loads the container', async ({ page }) => {
		const google = await watchGoogle(page);
		await page.addInitScript((key) => window.localStorage.setItem(key, 'denied'), KEY);
		await page.goto('/en/');
		await expect(banner(page)).toBeVisible();
		await expect.poll(() => tagRequests(google)).toEqual([TAG_URL]);
	});
});

test.describe('storage that throws', () => {
	test.beforeEach(async ({ page }) => {
		await page.addInitScript(() => {
			Object.defineProperty(window, 'localStorage', {
				configurable: true,
				get() {
					throw new DOMException('blocked', 'SecurityError');
				}
			});
		});
	});

	test('the page works, the notice shows and the container loads, and Turn off works', async ({
		page
	}) => {
		const google = await watchGoogle(page);
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await open(page, '/en/');
		await expect(banner(page)).toBeVisible();
		await expect.poll(() => tagRequests(google)).toEqual([TAG_URL]);
		await turnOff(page).click();
		await expect(banner(page)).toHaveCount(0);
		expect(errors).toEqual([]);
	});
});

test.describe('keyboard', () => {
	test('Tab reaches Keep and Turn off, in that order, after the skip link', async ({ page }) => {
		await watchGoogle(page);
		await open(page, '/en/');
		await expect(banner(page)).toBeVisible();
		await page.keyboard.press('Tab');
		await expect(page.locator(':focus')).toHaveAttribute('href', '#main-content');
		await page.keyboard.press('Tab');
		await expect(keepOn(page)).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(turnOff(page)).toBeFocused();
	});

	test('Enter on Turn off records the choice and moves focus to the main content', async ({
		page
	}) => {
		await watchGoogle(page);
		await open(page, '/en/');
		await expect(banner(page)).toBeVisible();
		await keepOn(page).focus();
		await page.keyboard.press('Tab');
		await expect(turnOff(page)).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(banner(page)).toHaveCount(0);
		await expect(page.locator('main#main-content')).toBeFocused();
		expect(JSON.parse((await stored(page)) ?? 'null')).toMatchObject({ choice: 'denied' });
	});

	test('the notice does not take focus when the page loads', async ({ page }) => {
		await watchGoogle(page);
		await open(page, '/en/');
		await expect(banner(page)).toBeVisible();
		expect(
			await page.evaluate(
				() => document.activeElement === document.body || document.activeElement === null
			)
		).toBe(true);
	});
});

test.describe('change the choice', () => {
	for (const locale of ['en', 'es'] as const) {
		test(`/${locale}/about/: the control brings the notice back and keeps the stored choice`, async ({
			page
		}) => {
			const google = await watchGoogle(page);
			await open(page, `/${locale}/about/`);
			await turnOff(page).click();
			await expect(banner(page)).toHaveCount(0);
			const control = page.locator('main').getByTestId('consent-change');
			await expect(control).toHaveText(TEXT[locale].change);
			await control.click();
			await expect(banner(page)).toBeVisible();
			expect(JSON.parse((await stored(page)) ?? 'null')).toMatchObject({ choice: 'denied' });
			// Keep after a turn off in the same page view sets Consent Mode back to granted.
			await keepOn(page).click();
			await expect(banner(page)).toHaveCount(0);
			expect(JSON.parse((await stored(page)) ?? 'null')).toMatchObject({ choice: 'granted' });
			expect((await consentCalls(page)).at(-1)).toEqual([
				'consent',
				'update',
				expect.objectContaining({ analytics_storage: 'granted', ad_storage: 'denied' })
			]);
			expect(tagRequests(google)).toEqual([TAG_URL]);
			google.length = 0;
			await page.reload();
			await expect(footerChange(page)).toBeVisible();
			await expect.poll(() => tagRequests(google)).toEqual([TAG_URL]);
		});

		test(`/${locale}/: the footer control brings the notice back`, async ({ page }) => {
			await watchGoogle(page);
			await open(page, `/${locale}/`);
			await turnOff(page).click();
			await expect(banner(page)).toHaveCount(0);
			await expect(footerChange(page)).toHaveText(TEXT[locale].change);
			await footerChange(page).click();
			await expect(banner(page)).toBeVisible();
			await expect(banner(page)).toBeFocused();
		});
	}

	test('after Keep the control shows the notice without a reload, then Turn off clears the cookies', async ({
		page
	}) => {
		const google = await watchGoogle(page);
		await open(page, '/en/');
		await keepOn(page).click();
		await expect.poll(() => tagRequests(google)).toEqual([TAG_URL]);
		await setCookies(page);
		await page.evaluate(() => {
			(window as unknown as { marker: boolean }).marker = true;
		});

		await footerChange(page).click();
		await expect(banner(page)).toBeVisible();
		expect(await page.evaluate(() => (window as unknown as { marker?: boolean }).marker)).toBe(
			true
		);
		expect(await cookieNames(page)).toEqual(expect.arrayContaining(['_ga', 'theme']));

		await turnOff(page).click();
		await expect(banner(page)).toHaveCount(0);
		expect(await cookieNames(page)).toEqual(['theme']);
	});

	test('the About page describes the analytics in both languages', async ({ page }) => {
		await watchGoogle(page);
		await open(page, '/es/about/');
		await expect(page.getByTestId('privacy')).toContainText('Google Tag Manager');
		await expect(page.getByTestId('privacy')).toContainText('activada por defecto');
		await open(page, '/en/about/');
		await expect(page.getByTestId('privacy')).toContainText('Google Tag Manager');
		await expect(page.getByTestId('privacy')).toContainText('on by default');
	});
});

test.describe('accessibility (WCAG 2.2 AA, axe)', () => {
	for (const url of ['/es/', '/en/', '/es/about/', '/en/about/']) {
		test(`${url} has no violations with the notice shown`, async ({ page }) => {
			await watchGoogle(page);
			await open(page, url);
			await expect(banner(page)).toBeVisible();
			await expectNoA11yViolations(page);
		});

		test(`${url} has no violations after turning analytics off`, async ({ page }) => {
			await watchGoogle(page);
			await open(page, url);
			await turnOff(page).click();
			await expect(banner(page)).toHaveCount(0);
			await expect(footerChange(page)).toBeVisible();
			await expectNoA11yViolations(page);
		});
	}
});

test.describe('JavaScript disabled', () => {
	test.use({ javaScriptEnabled: false });

	for (const url of ['/es/', '/en/about/', '/en/entity/doi/']) {
		test(`${url} has no notice, no change control and sends no Google request`, async ({
			page
		}) => {
			const google = await watchGoogle(page);
			await page.goto(url);
			await expect(page.locator('h1')).toBeVisible();
			await page.waitForLoadState('networkidle');
			await expect(banner(page)).toHaveCount(0);
			await expect(page.getByTestId('consent-change')).toHaveCount(0);
			expect(google).toEqual([]);
		});
	}

	test('the prerendered HTML has neither the notice nor the control', async ({ request }) => {
		for (const url of ['/en/', '/en/about/']) {
			const html = await (await request.get(url)).text();
			expect(html, url).not.toContain('data-testid="consent-change"');
			expect(html, url).not.toContain('data-testid="consent-banner"');
		}
	});
});

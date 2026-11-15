import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_ANCHOR_IDS } from '../../src/lib/map/anchors';
import { expectNoA11yViolations, expectNoHorizontalScroll } from './helpers';

const ANCHORS = DEFAULT_ANCHOR_IDS.length;
const node = (page: Page, id: string) => page.locator(`[data-node-id="${id}"]`);
const nodes = (page: Page) => page.locator('[data-node-id]');
const ready = (page: Page) =>
	expect(page.getByTestId('map-explorer')).toHaveAttribute('data-ready', '');

async function open(page: Page, url: string) {
	await page.goto(url);
	await ready(page);
}

/** Screen position of every drawn node (centre of its glyph), by id. */
const positions = (page: Page) =>
	page.evaluate(() => {
		const out: Record<string, { x: number; y: number }> = {};
		for (const el of document.querySelectorAll('[data-testid=map-canvas] [data-node-id]')) {
			const box = el.querySelector('.hit')!.getBoundingClientRect();
			out[el.getAttribute('data-node-id')!] = {
				x: box.x + box.width / 2,
				y: box.y + box.height / 2
			};
		}
		return out;
	});

/**
 * Position of one node once it stops moving: the same value on two reads in a row, 100 ms apart.
 * Camera moves (zoom, centring, a resize after the first paint) land a frame or two after the
 * click that causes them, and CI machines are slower than ours, so a single read can catch one
 * mid-way.
 */
async function settled(page: Page, id: string) {
	let last = '';
	let at = { x: 0, y: 0 };
	await expect
		.poll(
			async () => {
				at = (await positions(page))[id]!;
				const now = `${at.x.toFixed(1)},${at.y.toFixed(1)}`;
				const same = now === last;
				last = now;
				return same;
			},
			{ intervals: [100], timeout: 10_000 }
		)
		.toBe(true);
	return at;
}

test.describe('starting view', () => {
	test('shows the anchors as one connected picture around open science', async ({ page }) => {
		await open(page, '/es/');
		await expect(page.getByTestId('map-explorer')).toHaveAttribute('data-scene', 'start');
		await expect(nodes(page)).toHaveCount(ANCHORS);
		// No isolated dots: every anchor is an end of at least one edge.
		const edges = await page
			.locator('[data-edge]')
			.evaluateAll((lines) => lines.map((line) => line.getAttribute('data-edge')!));
		const linked = new Set(edges.flatMap((edge) => edge.split('|')));
		for (const id of DEFAULT_ANCHOR_IDS) expect(linked.has(id), id).toBe(true);
		// Open science sits in the middle of the others, with the "start here" tag.
		const at = await positions(page);
		const xs = Object.values(at).map((p) => p.x);
		expect(at['open-science']!.x).toBeGreaterThan(Math.min(...xs) + 200);
		expect(at['open-science']!.x).toBeLessThan(Math.max(...xs) - 200);
		await expect(page.locator('.start-tag')).toHaveText('Empieza aquí');
		await expect(page.locator('.caption')).toHaveCount(4);
		// Labels use the short name; the accessible name is the full one.
		await expect(node(page, 'cris').locator('.label')).toHaveText('CRIS');
		await expect(node(page, 'cris')).toHaveAttribute('aria-label', /Sistema de información/);
	});

	test('size marks entry points, not hierarchy: the three open concepts share the top size', async ({
		page
	}) => {
		await open(page, '/en/');
		const sizes = await page.evaluate(() =>
			Object.fromEntries(
				[...document.querySelectorAll('[data-node-id]')].map((el) => [
					el.getAttribute('data-node-id')!,
					Math.round(el.querySelector('.glyph')!.getBoundingClientRect().width)
				])
			)
		);
		expect(sizes['open-data']).toBe(sizes['open-science']);
		expect(sizes['open-access']).toBe(sizes['open-science']);
		for (const [id, size] of Object.entries(sizes)) {
			if (!['open-science', 'open-data', 'open-access'].includes(id))
				expect(size, id).toBeLessThan(sizes['open-science']!);
		}
		// Open science keeps the centre and the tag.
		await expect(page.locator('.start-tag')).toHaveCount(1);
		await expect(page.locator('.start-tag')).toHaveText('Start here');
		// No two labels overlap.
		const boxes = await page
			.locator('[data-node-id] .label')
			.evaluateAll((labels) => labels.map((l) => l.getBoundingClientRect().toJSON()));
		for (let i = 0; i < boxes.length; i++)
			for (let j = i + 1; j < boxes.length; j++) {
				const a = boxes[i]!;
				const b = boxes[j]!;
				const apart =
					a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
				expect(apart, `labels ${i} and ${j}`).toBe(true);
			}
	});

	test('every node is a real link to its entry (works without the click handler)', async ({
		page
	}) => {
		await open(page, '/en/');
		await expect(node(page, 'doi')).toHaveAttribute('href', '/en/entity/doi/');
	});
});

test.describe('selecting a node', () => {
	test('opens the card, puts neighbours on a ring and keeps the node clear of the card', async ({
		page
	}) => {
		await open(page, '/es/');
		await node(page, 'doi').click();
		await expect(page).toHaveURL(/\?n=doi$/);
		const card = page.getByTestId('map-card');
		await expect(card.getByRole('heading', { level: 2 })).toHaveText('DOI');
		await expect(card.getByTestId('map-sentences').first()).toContainText('DOI');
		await expect(page.getByTestId('map-explorer')).toHaveAttribute('data-scene', 'focus');
		await expect(node(page, 'doi')).toHaveAttribute('data-tone', 'focus');
		await expect(nodes(page)).toHaveCount(9);

		const at = await positions(page);
		const focus = at.doi!;
		const radii = Object.entries(at)
			.filter(([id]) => id !== 'doi')
			.map(([, p]) => Math.hypot(p.x - focus.x, p.y - focus.y));
		expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(2);
		expect(Math.min(...radii)).toBeGreaterThan(100);
		const cardBox = (await card.boundingBox())!;
		for (const p of Object.values(at)) expect(p.x).toBeLessThan(cardBox.x);
		await expect(page.getByTestId('map-live')).toContainText('DOI');
	});

	test('"show more" puts every neighbour on the canvas and in the card', async ({ page }) => {
		await open(page, '/es/?n=research-repository');
		await expect(nodes(page)).toHaveCount(9);
		const before = await page.getByTestId('map-sentences').locator('button').count();
		await page.getByTestId('map-more').click();
		await expect.poll(() => nodes(page).count()).toBeGreaterThan(12);
		expect(await page.getByTestId('map-sentences').locator('button').count()).toBeGreaterThan(
			before
		);
		await page.getByTestId('map-fewer').click();
		await expect(nodes(page)).toHaveCount(9);
	});

	test('a sentence highlights its edge and leads to the other node; the trail goes back', async ({
		page
	}) => {
		await open(page, '/es/?n=doi');
		const sentence = page.locator('[data-pair="crossref|doi"]');
		await sentence.hover();
		await expect(page.locator('[data-edge="crossref|doi"]')).toHaveAttribute('data-hot', '');
		await sentence.click();
		await expect(page).toHaveURL(/\?n=crossref$/);
		const card = page.getByTestId('map-card');
		await expect(card.getByRole('heading', { level: 2 })).toHaveText('Crossref');
		await expect(card.getByRole('heading', { level: 2 })).toBeFocused();

		const trail = page.getByTestId('map-trail');
		await expect(trail.locator('li')).toHaveCount(3);
		await expect(trail.locator('[aria-current]')).toHaveText('Crossref');

		// Browser Back is a real history step.
		await page.goBack();
		await expect(page).toHaveURL(/\?n=doi$/);
		await expect(card.getByRole('heading', { level: 2 })).toHaveText('DOI');
		await page.goForward();
		await expect(card.getByRole('heading', { level: 2 })).toHaveText('Crossref');

		// A crumb steps back along the trail, the card's back button too.
		await trail.locator('[data-crumb=doi]').click();
		await expect(page).toHaveURL(/\?n=doi$/);
		await expect(trail.locator('li')).toHaveCount(2);
		await page.getByTestId('map-back').click();
		await expect(page).toHaveURL(/\/es\/$/);
		await expect(page.getByTestId('map-card')).toHaveCount(0);
		await expect(nodes(page)).toHaveCount(ANCHORS);
	});

	test('the language switch keeps the selection', async ({ page }) => {
		await open(page, '/es/');
		await node(page, 'orcid').click();
		await expect(page).toHaveURL(/\?n=orcid$/);
		await page.getByTestId('locale-switch-en').click();
		await page.waitForURL('**/en/?n=orcid');
		await ready(page);
		await expect(page.getByTestId('map-card').getByRole('heading', { level: 2 })).toHaveText(
			'ORCID iD'
		);
	});

	test('the card links to the full entry', async ({ page }) => {
		await open(page, '/en/?n=doi');
		await page.getByTestId('map-entry-link').click();
		await page.waitForURL('**/en/entity/doi/');
	});
});

test.describe('full screen', () => {
	test('the map fills the viewport, keeps working, and Escape restores the page and focus', async ({
		page
	}) => {
		await open(page, '/es/?n=doi');
		const explorer = page.getByTestId('map-explorer');
		const button = page.getByTestId('map-fullscreen');
		await expect(button).toHaveAttribute('aria-pressed', 'false');
		await expect(button).toContainText('Pantalla completa');
		const before = (await page.getByTestId('map-stage').boundingBox())!;

		await button.focus();
		await page.keyboard.press('Enter');
		await expect(explorer).toHaveAttribute('data-full', '');
		await expect(button).toHaveAttribute('aria-pressed', 'true');
		await expect(button).toContainText('Salir de pantalla completa');
		const viewport = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
		await expect
			.poll(async () => (await page.getByTestId('map-stage').boundingBox())!.height)
			.toBeGreaterThan(viewport.h - 40);
		const stage = (await page.getByTestId('map-stage').boundingBox())!;
		expect(stage.width).toBeGreaterThan(viewport.w - 40);
		expect(stage.height).toBeGreaterThan(before.height);

		// Card, trail, search, stories and the expert toggle all work inside it.
		await expect(page.getByTestId('map-card')).toBeVisible();
		await page.locator('[data-pair="crossref|doi"]').click();
		await expect(page.getByTestId('map-trail').locator('[aria-current]')).toHaveText('Crossref');
		await page.keyboard.press('/');
		await expect(page.getByTestId('map-palette')).toBeVisible();
		await page.keyboard.type('FAIR');
		await page.getByTestId('map-palette').locator('[data-option-kind=story]').first().click();
		await expect(page.getByTestId('story-bar')).toBeVisible();
		await expect(explorer).toHaveAttribute('data-full', '');
		await page.getByTestId('story-exit').click();
		await page.getByTestId('map-expert').click();
		await expect(explorer).toHaveAttribute('data-scene', 'expert');
		await page.getByTestId('map-expert').click();
		await expectNoA11yViolations(page);

		await page.keyboard.press('Escape');
		await expect(explorer).not.toHaveAttribute('data-full', '');
		await expect(button).toBeFocused();
		await expect
			.poll(async () => (await page.getByTestId('map-stage').boundingBox())!.height)
			.toBeLessThan(viewport.h - 100);
	});

	test('the frame is wider than the text column on a large screen', async ({ page }) => {
		await page.setViewportSize({ width: 1920, height: 1080 });
		await open(page, '/en/');
		const stage = (await page.getByTestId('map-stage').boundingBox())!;
		expect(stage.width).toBeGreaterThan(1500);
		expect(stage.width).toBeLessThanOrEqual(1600);
		expect(stage.height).toBeGreaterThan(600);
	});
});

test.describe('stories', () => {
	test('a question chip plays the story on the map, step by step, with the step in the URL', async ({
		page
	}) => {
		await open(page, '/es/');
		await page.getByRole('link', { name: '¿Qué es un DOI y quién lo emite?' }).click();
		await expect(page).toHaveURL(/\?historia=what-is-a-doi&paso=1$/);
		const bar = page.getByTestId('story-bar');
		await expect(bar).toBeVisible();
		await expect(bar).toBeFocused();
		await expect(page.getByTestId('story-progress')).toContainText('Paso 1 de 9');
		await expect(nodes(page)).toHaveCount(1);
		await expect(page.getByTestId('story-prev')).toBeDisabled();
		const first = await page.getByTestId('story-text').textContent();

		await page.getByTestId('story-next').click();
		await expect(page).toHaveURL(/paso=2$/);
		await expect(page.getByTestId('story-text')).not.toHaveText(first!);
		await expect(nodes(page)).toHaveCount(4);
		await expect(node(page, 'persistent-identifier')).toHaveAttribute('data-tone', 'focus');
		await expect(page.locator('.edge.accent')).toHaveCount(3);

		await page.keyboard.press('ArrowRight');
		await expect(page).toHaveURL(/paso=3$/);
		await page.keyboard.press('ArrowLeft');
		await expect(page).toHaveURL(/paso=2$/);
		await page.getByTestId('story-prev').click();
		await expect(page).toHaveURL(/paso=1$/);

		// Steps replace the history entry: Back leaves the story.
		await page.goBack();
		await expect(page).toHaveURL(/\/es\/$/);
		await expect(bar).toHaveCount(0);
		await expect(nodes(page)).toHaveCount(ANCHORS);
	});

	test('a deep link opens at its step; the last step hands over to free exploration', async ({
		page
	}) => {
		await open(page, '/en/?historia=what-is-a-doi&paso=9');
		await expect(page.getByTestId('story-progress')).toContainText('Step 9 of 9');
		await expect(page.getByTestId('story-next')).toHaveCount(0);
		await page.getByTestId('story-continue').click();
		await expect(page).toHaveURL(/\?n=opencitations$/);
		await expect(page.getByTestId('map-card')).toBeVisible();
	});

	test('an out-of-range step is clamped and Escape leaves the story', async ({ page }) => {
		await open(page, '/es/?historia=what-is-fair&paso=99');
		await expect(page.getByTestId('story-progress')).toContainText('Paso 9 de 9');
		await page.keyboard.press('Escape');
		await expect(page.getByTestId('story-bar')).toHaveCount(0);
		await expect(page).toHaveURL(/\/es\/$/);
	});
});

test.describe('search palette', () => {
	test('"/" opens it, lists the stories, finds entries and goes there on Enter', async ({
		page
	}) => {
		await open(page, '/es/');
		await page.keyboard.press('/');
		const palette = page.getByTestId('map-palette');
		await expect(palette).toBeVisible();
		await expect(page.getByTestId('map-palette-input')).toBeFocused();
		await expect(palette.locator('[data-option-kind=story]')).toHaveCount(5);

		await page.keyboard.type('orcid');
		await expect(palette.locator('[data-option-kind=entry]').first()).toContainText('ORCID');
		await page.keyboard.press('Enter');
		await expect(palette).toBeHidden();
		await expect(page).toHaveURL(/\?n=orcid$/);
		await expect(page.getByTestId('map-card').getByRole('heading', { level: 2 })).toBeFocused();
	});

	test('picks a story, and Escape closes it without changing the map', async ({ page }) => {
		await open(page, '/en/');
		await page.getByTestId('map-search').click();
		await page.keyboard.press('Escape');
		await expect(page.getByTestId('map-palette')).toBeHidden();
		await expect(page).toHaveURL(/\/en\/$/);

		await page.keyboard.press('/');
		await page.keyboard.type('FAIR');
		await page.getByTestId('map-palette').locator('[data-option-kind=story]').first().click();
		await expect(page).toHaveURL(/\?historia=what-is-fair&paso=1$/);
		await expect(page.getByTestId('story-bar')).toBeVisible();
	});
});

test.describe('expert mode', () => {
	test('shows the whole corpus, filters, lists, and is remembered', async ({ page }) => {
		await open(page, '/es/');
		const toggle = page.getByTestId('map-expert');
		await expect(toggle).toHaveAttribute('aria-checked', 'false');
		await toggle.click();
		await expect(page).toHaveURL(/\?modo=experto$/);
		await expect(toggle).toHaveAttribute('aria-checked', 'true');
		await expect(page.getByTestId('map-explorer')).toHaveAttribute('data-scene', 'expert');

		await page.getByTestId('map-fit').click();
		const all = await page.locator('[data-edge]').count();
		expect(all).toBeGreaterThan(200);

		await page.getByTestId('map-filter-type').selectOption('identifier');
		await expect(page).toHaveURL(/tipo=identifier/);
		await expect.poll(() => nodes(page).count()).toBeLessThan(40);
		const identifiers = await nodes(page).count();
		expect(identifiers).toBeGreaterThan(3);

		await page.getByTestId('map-view-list').click();
		await expect(page).toHaveURL(/vista=lista/);
		await expect(page.getByTestId('map-table').locator('tbody tr')).toHaveCount(identifiers);
		await expect(page.getByTestId('map-count')).toContainText(`${identifiers} de`);
		await page.getByTestId('map-table').locator('[data-row-node=doi]').click();
		await expect(page.getByTestId('map-card').getByRole('heading', { level: 2 })).toHaveText('DOI');

		// Remembered across visits (localStorage), until switched off.
		await open(page, '/es/');
		await expect(page).toHaveURL(/\?modo=experto$/);
		await page.getByTestId('map-expert').click();
		await expect(page).toHaveURL(/\/es\/$/);
		await open(page, '/es/');
		await expect(nodes(page)).toHaveCount(ANCHORS);
	});

	test('a selection keeps the layout, centres the node and can be zoomed and panned', async ({
		page
	}) => {
		await open(page, '/en/?modo=experto&n=crossref');
		await expect(node(page, 'crossref')).toHaveAttribute('data-tone', 'focus');
		await expect(page.getByTestId('map-card')).toBeVisible();
		await page.getByRole('button', { name: 'Zoom out' }).click();
		await page.getByRole('button', { name: 'Zoom in' }).click();
		// The map starts below the fold of a 720 px viewport: a drag that starts outside the
		// viewport loses part of its movement. Bring the stage into view and start inside it.
		await page.getByTestId('map-stage').evaluate((el) => el.scrollIntoView({ block: 'center' }));
		const before = await settled(page, 'crossref');
		const stage = (await page.getByTestId('map-stage').boundingBox())!;
		const view = page.viewportSize()!;
		expect(stage.y).toBeGreaterThanOrEqual(0);
		expect(stage.y + stage.height).toBeLessThanOrEqual(view.height);
		await page.mouse.move(stage.x + 200, stage.y + stage.height / 2);
		await page.mouse.down();
		await page.mouse.move(stage.x + 260, stage.y + stage.height / 2 + 40, { steps: 4 });
		await page.mouse.up();
		const after = await settled(page, 'crossref');
		expect(after.x - before.x).toBeGreaterThan(40);
		expect(after.y - before.y).toBeGreaterThan(20);
		// The drag did not select anything else.
		await expect(page).toHaveURL(/n=crossref/);
	});

	test('filters by relation family', async ({ page }) => {
		await open(page, '/es/?modo=experto');
		const all = await page.locator('[data-edge]').count();
		await page.getByTestId('map-filter-family').selectOption('behind');
		await expect(page).toHaveURL(/rel=behind/);
		await page.getByTestId('map-fit').click();
		await expect.poll(() => page.locator('[data-edge]').count()).toBeLessThan(all);
		expect(await page.locator('[data-edge]').count()).toBeGreaterThan(10);
	});
});

test.describe('keyboard', () => {
	test('one tab stop, arrows between nodes, Enter opens, Escape goes back', async ({ page }) => {
		await open(page, '/es/');
		await expect(page.locator('[data-node-id][tabindex="0"]')).toHaveCount(1);
		await node(page, 'open-science').focus();
		await page.keyboard.press('ArrowLeft');
		const left = await page.evaluate(() => document.activeElement?.getAttribute('data-node-id'));
		expect(left).not.toBe('open-science');
		expect(DEFAULT_ANCHOR_IDS).toContain(left);
		await page.keyboard.press('ArrowRight');
		await expect(node(page, 'open-science')).toBeFocused();

		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/\?n=open-science$/);
		await expect(node(page, 'open-science')).toBeFocused();
		await page.keyboard.press('ArrowRight');
		await page.keyboard.press('Enter');
		await expect(page).not.toHaveURL(/\?n=open-science$/);
		await expect(page).toHaveURL(/\?n=/);

		await page.keyboard.press('Escape');
		await expect(page).toHaveURL(/\?n=open-science$/);
		await page.keyboard.press('Escape');
		await expect(page).toHaveURL(/\/es\/$/);
		await expect(page.getByTestId('map-live')).toHaveText('Vista inicial.');
	});
});

test.describe('motion', () => {
	test('with reduced motion the change is immediate', async ({ page }) => {
		await open(page, '/es/');
		await node(page, 'doi').click();
		await expect(nodes(page)).toHaveCount(9);
		const at = await positions(page);
		await page.waitForTimeout(400);
		expect(await positions(page)).toEqual(at);
	});

	test.describe('without the preference', () => {
		test('the camera and nodes glide and settle in about 300 ms', async ({ page }) => {
			await page.emulateMedia({ reducedMotion: 'no-preference' });
			await open(page, '/es/');
			// Sample one neighbour's position on every frame after the click.
			const samples = await page.evaluate(async () => {
				const x = () =>
					document
						.querySelector('[data-node-id="persistent-identifier"] .hit')!
						.getBoundingClientRect().x;
				const out: { t: number; x: number }[] = [];
				const t0 = performance.now();
				document
					.querySelector('[data-node-id="doi"]')!
					.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
				while (performance.now() - t0 < 700) {
					await new Promise(requestAnimationFrame);
					out.push({ t: performance.now() - t0, x: x() });
				}
				return out;
			});
			const end = samples.at(-1)!.x;
			const distinct = new Set(samples.map((sample) => Math.round(sample.x)));
			expect(Math.abs(end - samples[0]!.x)).toBeGreaterThan(50);
			// It passes through intermediate positions (a glide, not a jump) ...
			expect(distinct.size).toBeGreaterThan(4);
			// ... and has settled within 200-300 ms plus a frame or two.
			const settled = samples.find((sample) => Math.abs(sample.x - end) < 0.5)!.t;
			expect(settled).toBeGreaterThan(120);
			expect(settled).toBeLessThan(400);
			await expect(nodes(page)).toHaveCount(9);
		});
	});
});

test.describe('accessibility (axe, WCAG 2.2 AA)', () => {
	for (const [name, url] of [
		['card open', '/es/?n=research-repository'],
		['story', '/en/?historia=what-is-a-doi&paso=3'],
		['expert map', '/es/?modo=experto'],
		['expert map with a selection', '/es/?modo=experto&n=datacite'],
		['expert list', '/en/?modo=experto&vista=lista']
	] as const) {
		test(`${name} has no violations`, async ({ page }) => {
			await open(page, url);
			await expectNoA11yViolations(page);
		});
	}

	test('search palette has no violations', async ({ page }) => {
		await open(page, '/es/');
		await page.keyboard.press('/');
		await page.keyboard.type('do');
		await expectNoA11yViolations(page);
	});
});

test.describe('phone 390x844: list first, map strip on top', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

	test('starting view: a short map strip and the themes as a list', async ({ page }) => {
		await open(page, '/es/');
		const stage = (await page.getByTestId('map-stage').boundingBox())!;
		expect(stage.height).toBeLessThan(844 * 0.45);
		expect(stage.height).toBeGreaterThan(200);
		const themes = page.getByTestId('map-themes');
		await expect(themes).toBeVisible();
		await expect(themes.locator('a')).toHaveCount(ANCHORS);
		await expect(themes.locator('h3')).toHaveCount(4);
		await expectNoHorizontalScroll(page);
		await expectNoA11yViolations(page);
		// Every node fits inside the strip.
		for (const p of Object.values(await positions(page))) {
			expect(p.x).toBeGreaterThan(stage.x);
			expect(p.x).toBeLessThan(stage.x + stage.width);
		}
	});

	test('tapping a row opens the card under the strip; sentences keep navigating', async ({
		page
	}) => {
		await open(page, '/es/');
		await page.getByTestId('map-themes').locator('[data-theme-node=doi]').click();
		await expect(page).toHaveURL(/\?n=doi$/);
		const card = page.getByTestId('map-card');
		await expect(card.getByRole('heading', { level: 2 })).toHaveText('DOI');
		const stage = (await page.getByTestId('map-stage').boundingBox())!;
		const cardBox = (await card.boundingBox())!;
		expect(cardBox.y).toBeGreaterThanOrEqual(stage.y + stage.height - 1);
		await expect(page.getByTestId('map-themes')).toHaveCount(0);
		await expect(nodes(page)).toHaveCount(7);
		await expectNoHorizontalScroll(page);
		await expectNoA11yViolations(page);

		await card.locator('[data-pair="crossref|doi"]').click();
		await expect(card.getByRole('heading', { level: 2 })).toHaveText('Crossref');
		await page.getByTestId('map-back').click();
		await expect(card.getByRole('heading', { level: 2 })).toHaveText('DOI');
	});

	test('full screen: the strip grows, the card stays below it, nothing overflows', async ({
		page
	}) => {
		await open(page, '/es/?n=doi');
		const before = (await page.getByTestId('map-stage').boundingBox())!;
		await page.getByTestId('map-fullscreen').click();
		await expect(page.getByTestId('map-explorer')).toHaveAttribute('data-full', '');
		await expect
			.poll(async () => (await page.getByTestId('map-stage').boundingBox())!.height)
			.toBeGreaterThan(before.height + 50);
		await expect(page.getByTestId('map-card')).toBeVisible();
		await expectNoHorizontalScroll(page);
		await expectNoA11yViolations(page);
		await page.getByTestId('map-fullscreen').click();
		await expect(page.getByTestId('map-explorer')).not.toHaveAttribute('data-full', '');
	});

	for (const url of [
		'/en/?historia=latin-america-indexing&paso=4',
		'/es/?modo=experto',
		'/es/?modo=experto&vista=lista',
		'/es/entity/research-repository/'
	]) {
		test(`${url} has no horizontal scroll and no violations`, async ({ page }) => {
			await page.goto(url);
			if (!url.includes('/entity/')) await ready(page);
			await expectNoHorizontalScroll(page);
			await expectNoA11yViolations(page);
		});
	}
});

test.describe('entity page mini-graph', () => {
	test('draws the entity with its neighbours as links and offers the map', async ({ page }) => {
		await page.goto('/es/entity/doi/');
		const graph = page.getByTestId('mini-graph');
		const canvas = graph.getByTestId('map-canvas').first();
		await expect(canvas).toBeVisible();
		await expect(canvas.locator('[data-node-id=doi]')).toHaveAttribute('data-tone', 'focus');
		expect(await canvas.locator('[data-node-id]').count()).toBeGreaterThan(4);
		await canvas.locator('[data-node-id=crossref]').click();
		await page.waitForURL('**/es/entity/crossref/');
		await page.getByTestId('see-on-map').click();
		await page.waitForURL('**/es/?n=crossref');
		await ready(page);
		await expect(page.getByTestId('map-card')).toBeVisible();
	});
});

test.describe('no JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('the map is a still picture of links, with a note; controls are hidden', async ({
		page
	}) => {
		await page.goto('/es/');
		await expect(page.locator('[data-node-id]')).toHaveCount(ANCHORS);
		await expect(page.locator('[data-node-id=doi]')).toHaveAttribute('href', '/es/entity/doi/');
		await expect(page.getByTestId('map-search')).toBeHidden();
		await expect(page.getByText('Sin JavaScript el mapa es una imagen fija')).toBeVisible();
	});

	test('the question chips are plain links to the step-list pages', async ({ page }) => {
		await page.goto('/es/');
		const chip = page.getByTestId('question-chips').locator('a').first();
		await expect(chip).toHaveAttribute('href', /\/es\/stories\/[a-z-]+\/$/);
		await chip.click();
		await expect(page.getByTestId('story-steps')).toBeVisible();
	});

	test('the entity mini-graph is in the HTML', async ({ page }) => {
		await page.goto('/en/entity/orcid/');
		await expect(
			page.getByTestId('mini-graph').locator('[data-node-id=orcid]').first()
		).toBeVisible();
	});
});

test('the map makes no request outside the site', async ({ page }) => {
	const external: string[] = [];
	page.on('request', (request) => {
		const url = request.url();
		// The analytics container is the one allowed third party (on by default, opt-out).
		if (url.startsWith('https://www.googletagmanager.com/gtm.js')) return;
		if (!url.startsWith('http://127.0.0.1')) external.push(url);
	});
	await open(page, '/es/');
	await node(page, 'doi').click();
	await page.keyboard.press('/');
	await page.keyboard.type('zenodo');
	await page.keyboard.press('Enter');
	await page.getByTestId('map-expert').click();
	await page.goto('/es/?historia=where-to-deposit-data&paso=2', { waitUntil: 'networkidle' });
	expect(external).toEqual([]);
});

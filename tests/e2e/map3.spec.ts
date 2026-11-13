import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// specs.md §7 `/{loc}/map3` row: the minimal map. 15 anchors by default,
// detail on click, everything else behind the expert toggle.

const visibleIds = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __cyMap3: import('cytoscape').Core }).__cyMap3
      .nodes()
      .filter((n) => n.style('display') !== 'none')
      .map((n) => n.id())
      .sort(),
  );

async function ready(page: Page, url: string) {
  await page.goto(url);
  await page.waitForSelector('#m3[data-ready]');
}

test.describe('/map3 minimal map', () => {
  test('loads 15 anchors, no card, one search box, a hint', async ({ page }) => {
    await ready(page, '/es/map3/');
    expect(await visibleIds(page)).toHaveLength(15);
    expect(await visibleIds(page)).toContain('doi');
    await expect(page.locator('#m3-card')).toBeHidden();
    await expect(page.locator('#m3-q')).toBeVisible();
    await expect(page.locator('#m3-hint')).toBeVisible();
    await expect(page.locator('.m3-expert-tools')).toBeHidden();
  });

  test('selecting a node opens the card, reveals neighbours and updates the URL', async ({ page }) => {
    await ready(page, '/es/map3/');
    await page.evaluate(() => (window as unknown as { __cyMap3: import('cytoscape').Core }).__cyMap3.getElementById('doi').emit('tap'));
    const card = page.locator('#m3-card');
    await expect(card).toBeVisible();
    await expect(card.locator('h2')).toHaveText('DOI');
    await expect(card.locator('#m3-card-rels li')).not.toHaveCount(0);
    expect(await card.locator('#m3-card-rels li').count()).toBeLessThanOrEqual(5);
    await expect(card.locator('#m3-card-entry')).toHaveAttribute('href', '/es/entity/doi/');
    await expect(card.locator('#m3-card-wp')).toHaveAttribute('href', /wikidata\.org\/wiki\/Special:GoToLinkedPage\/eswiki\/Q/);
    const words = (await card.locator('#m3-card-summary').innerText()).split(/\s+/).length;
    expect(words).toBeLessThanOrEqual(25);
    expect((await visibleIds(page)).length).toBeGreaterThan(15);
    expect(page.url()).toContain('n=doi');
  });

  test('deep link ?n= restores the selection; +N badge expands hidden neighbours', async ({ page }) => {
    await ready(page, '/es/map3/?n=persistent-identifier');
    await expect(page.locator('#m3-card h2')).toBeVisible();
    const badge = page.locator('#m3-badge');
    await expect(badge).toBeVisible();
    const before = (await visibleIds(page)).length;
    const n = Number((await badge.innerText()).replace('+', ''));
    await badge.click();
    await expect(badge).toBeHidden();
    expect((await visibleIds(page)).length).toBe(before + n);
  });

  test('search selects a node; Esc steps back to the starting view', async ({ page }) => {
    await ready(page, '/en/map3/');
    await page.keyboard.press('/');
    await expect(page.locator('#m3-q')).toBeFocused();
    await page.keyboard.type('orcid');
    await expect(page.locator('#m3-results [role="option"]').first()).toContainText('ORCID');
    await page.keyboard.press('Enter');
    await expect(page.locator('#m3-card h2')).toHaveText('ORCID iD');
    await page.keyboard.press('Escape');
    await expect(page.locator('#m3-card')).toBeHidden();
    expect(await visibleIds(page)).toHaveLength(15);
    expect(page.url()).not.toContain('n=');
  });

  test('keyboard: arrows move between neighbours, Enter follows one', async ({ page }) => {
    await ready(page, '/es/map3/?n=doi');
    await page.locator('#m3-cy').focus();
    await page.keyboard.press('ArrowRight');
    const announced = await page.locator('#m3-live').innerText();
    expect(announced.length).toBeGreaterThan(0);
    await page.keyboard.press('Enter');
    await expect(page.locator('#m3-card h2')).not.toHaveText('DOI');
    await page.keyboard.press('Escape');
    await expect(page.locator('#m3-card h2')).toHaveText('DOI');
  });

  test('expert toggle shows the whole corpus, filters and list view, and is remembered', async ({ page }) => {
    await ready(page, '/es/map3/');
    const total = await page.evaluate(() => (window as unknown as { __cyMap3: import('cytoscape').Core }).__cyMap3.nodes().length);
    await page.locator('#m3-expert').click();
    await expect(page.locator('#m3-expert')).toHaveAttribute('aria-checked', 'true');
    expect(page.url()).toContain('modo=experto');
    expect(await visibleIds(page)).toHaveLength(total);
    await page.locator('#m3-type').selectOption('concept');
    const concepts = (await visibleIds(page)).length;
    expect(concepts).toBeLessThan(total);
    await page.locator('#m3-view-list').click();
    await expect(page.locator('#m3-rows tr')).toHaveCount(concepts);
    await page.goto('/es/map3/');
    await page.waitForSelector('#m3[data-ready]');
    await expect(page.locator('#m3-expert')).toHaveAttribute('aria-checked', 'true');
  });

  test('reduced motion: selection applies instantly, no animation queued', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page, '/es/map3/');
    const animating = await page.evaluate(() => {
      const cy = (window as unknown as { __cyMap3: import('cytoscape').Core }).__cyMap3;
      cy.getElementById('orcid').emit('tap');
      return cy.animated() || cy.nodes().some((n) => (n as unknown as { animated(): boolean }).animated());
    });
    expect(animating).toBe(false);
    await expect(page.locator('#m3-card')).toBeVisible();
  });

  test('dark mode drives the canvas from tokens (no white canvas)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await ready(page, '/es/map3/');
    const bg = await page.locator('#m3').evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('rgb(255, 255, 255)');
    expect(bg).toBe('rgb(17, 20, 24)');
  });

  test('mobile: card is a bottom sheet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ready(page, '/es/map3/?n=doi');
    const box = await page.locator('#m3-card').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(380);
    expect(Math.round(box!.y + box!.height)).toBeGreaterThanOrEqual(840);
    // The map itself never overflows sideways (the site header's nav row is
    // Base.astro chrome, shared with every page, and out of scope here).
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll('#m3 *')].some((el) => el.getBoundingClientRect().right > window.innerWidth + 1),
    );
    expect(overflow).toBe(false);
  });

  for (const url of ['/es/map3/', '/en/map3/?n=doi', '/es/map3/?modo=experto']) {
    test(`axe: no WCAG 2.2 AA violations on ${url}`, async ({ page }) => {
      await ready(page, url);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });
  }
});

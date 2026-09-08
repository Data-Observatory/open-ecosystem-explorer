import { test, expect } from '@playwright/test';

// specs.md §9.3: "Automated check that every route renders usefully with
// JavaScript disabled, including the language switcher." — Blocking.
// Every route in this project is prerendered static HTML; the only JS on
// any page is progressive enhancement (search live-filter, the
// entity-page detail-level toggle) — nothing here should be load-bearing.

async function noJsContext(browser: import('@playwright/test').Browser) {
  return browser.newContext({ javaScriptEnabled: false });
}

const ROUTES: { path: string; check: (page: import('@playwright/test').Page) => Promise<void> }[] = [
  {
    path: '/es/entity/figshare/',
    check: async (page) => {
      await expect(page.locator('h1')).toBeVisible();
      // `.diagram__svg svg` (not the broader `figure.diagram svg`): the
      // legend added per the interactivity follow-up also renders small
      // inline SVG shape icons inside `figure.diagram`, so the bare
      // selector now matches multiple elements (strict-mode violation).
      // `.diagram__svg` is the one wrapper that holds the actual Mermaid
      // diagram SVG specifically.
      await expect(page.locator('.diagram__svg svg')).toBeAttached();
      // Standard/Technical <details> exist and are natively expandable —
      // no script required (§7.1). `> summary` (direct child) matters:
      // Technical is nested inside Standard, so a descendant selector
      // would also match Technical's own <summary> and make `.click()`
      // ambiguous (Playwright strict mode).
      const standard = page.locator('details.disclosure--standard');
      await expect(standard).toBeAttached();
      expect(await standard.getAttribute('open')).toBeNull(); // collapsed by default
      await standard.locator('> summary').click();
      await expect(standard).toHaveJSProperty('open', true);
    },
  },
  {
    path: '/es/entities/',
    check: async (page) => {
      await expect(page.locator('table, ul').first()).toBeVisible();
    },
  },
  {
    path: '/es/map/',
    check: async (page) => {
      // specs.md §6.2 amendment (2026-09-04): /map is now a client-side
      // Cytoscape.js canvas — it does NOT work with JS disabled, by design
      // (§9/A9.5 designates /entities as its accessible/no-JS equivalent).
      // What must still hold with JS off: a sane degrade, not a blank page.
      // Chromium's javaScriptEnabled:false context still parses <noscript>
      // content into the DOM but Playwright's own text-content read comes
      // back empty for it in this mode (a Playwright/CDP quirk, not a page
      // bug) — assert on the fallback link, which is the actual functional
      // requirement, rather than the <noscript> wrapper's text.
      const entitiesLink = page.locator('a[href="/es/entities/"]').first();
      await expect(entitiesLink).toBeVisible();
    },
  },
  {
    path: '/es/search/',
    check: async (page) => {
      // Base functionality is the plain alphabetical list (Phase 6b) —
      // the live-filter fetch()/JS enhancement simply won't run.
      const list = page.locator('#results li, main a[href*="/entity/"]');
      expect(await list.count()).toBeGreaterThan(0);
    },
  },
  {
    path: '/es/views/vertical-integration/',
    check: async (page) => {
      await expect(page.locator('main')).toContainText(/./);
      // This is a predicate-kind view: its only <table> is the diagram's
      // own accessible table (A9.1), which lives inside a collapsed
      // <details> by design (§7.1) — present in the DOM, not immediately
      // visible. That's correct, not a bug: assert attachment, not
      // visibility, then prove it's genuinely reachable with one native
      // click and no JS.
      const table = page.locator('table').first();
      await expect(table).toBeAttached();
      const details = page.locator('details.diagram__data').first();
      await details.locator('> summary').click();
      await expect(table).toBeVisible();
    },
  },
  {
    path: '/es/taxonomy/',
    check: async (page) => {
      await expect(page.locator('svg, table, ul').first()).toBeVisible();
    },
  },
];

test.describe('No-JS smoke pass (§9.3)', () => {
  for (const { path, check } of ROUTES) {
    test(`${path} renders and is usable with JS disabled`, async ({ browser }) => {
      const context = await noJsContext(browser);
      const page = await context.newPage();
      await page.goto(path);
      await check(page);
      await context.close();
    });
  }

  test('language switcher is a plain link that works with JS disabled', async ({ browser }) => {
    const context = await noJsContext(browser);
    const page = await context.newPage();
    await page.goto('/es/entity/figshare/');
    const switcherLink = page.locator('a[hreflang="en"]').first();
    await expect(switcherLink).toBeVisible();
    const href = await switcherLink.getAttribute('href');
    expect(href).toBe('/en/entity/figshare/');
    await switcherLink.click();
    await expect(page).toHaveURL(/\/en\/entity\/figshare\/?$/);
    await context.close();
  });
});

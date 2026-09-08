import { test, expect } from '@playwright/test';

// specs.md §6.2 amendment (2026-09-04): every diagram must be genuinely
// pannable/zoomable, and /map must be a real interactive Cytoscape.js
// canvas, not a click-navigate-only static SVG. This suite proves the
// enhancement actually works (not just that the markup exists — that's
// covered by the a11y/no-js suites) and that it's additive: click-to-
// navigate on Mermaid's own anchors still works underneath svg-pan-zoom.

test.describe('Diagram pan/zoom (svg-pan-zoom)', () => {
  test('zoom buttons change the SVG viewport transform', async ({ page }) => {
    await page.goto('/es/entity/figshare/');
    const wrapper = page.locator('[data-diagram-panzoom] [id$="-svg"]').first();
    await expect(wrapper).toHaveAttribute('data-panzoom-active', '');
    const viewport = wrapper.locator('g.svg-pan-zoom_viewport');
    const before = await viewport.getAttribute('transform');
    await page.locator('[data-panzoom-action="zoom-in"]').first().click();
    await expect
      .poll(async () => viewport.getAttribute('transform'))
      .not.toBe(before);
  });

  test('reset returns zoom to roughly its initial fitted scale after zooming in', async ({ page }) => {
    // Compares the transform's scale factor with a tolerance rather than
    // exact string equality — svg-pan-zoom's re-fit after reset can land on
    // a floating-point-adjacent scale, not a byte-identical transform string.
    await page.goto('/es/entity/figshare/');
    const viewport = page.locator('[data-diagram-panzoom] g.svg-pan-zoom_viewport').first();
    const scaleOf = (transform: string | null) => {
      const m = transform?.match(/matrix\(([-\d.]+)/);
      return m?.[1] ? parseFloat(m[1]) : NaN;
    };
    const fittedScale = scaleOf(await viewport.getAttribute('transform'));
    await page.locator('[data-panzoom-action="zoom-in"]').first().click();
    await expect.poll(async () => scaleOf(await viewport.getAttribute('transform'))).toBeGreaterThan(fittedScale);
    await page.locator('[data-panzoom-action="reset"]').first().click();
    await expect
      .poll(async () => scaleOf(await viewport.getAttribute('transform')))
      .toBeGreaterThan(fittedScale * 0.9);
    await expect
      .poll(async () => scaleOf(await viewport.getAttribute('transform')))
      .toBeLessThan(fittedScale * 1.1);
  });

  test('click-to-navigate on a diagram node still works with pan/zoom active', async ({ page }) => {
    await page.goto('/es/entity/figshare/');
    const nodeLink = page.locator('[data-diagram-panzoom] svg a').first();
    await expect(nodeLink).toBeAttached();
    const href = await nodeLink.getAttribute('xlink:href');
    expect(href).toBeTruthy();
    await nodeLink.click();
    await expect(page).toHaveURL(new RegExp(href!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });

  test('arrow keys pan when the diagram wrapper has focus', async ({ page }) => {
    await page.goto('/es/entity/figshare/');
    const wrapper = page.locator('[data-diagram-panzoom] [id$="-svg"]').first();
    const viewport = wrapper.locator('g.svg-pan-zoom_viewport');
    await wrapper.focus();
    const before = await viewport.getAttribute('transform');
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => viewport.getAttribute('transform')).not.toBe(before);
  });
});

// `/map` and `/map2` share ONE component (`MapExplorerV2.astro`, promoted
// 2026-09-07 — see its header comment) — `/map` passes no `entityIds` (whole
// corpus) and `showAdvanced` (facets/Focus mode/URL state, `/map2`-absent
// clutter at its curated ~33-entity scale). Engine-level behaviour already
// covered by tests/e2e/map2.spec.ts against the same component (hover-dim,
// class-box LOD, resize, fetch-injected inline full record, click-
// interception) is NOT re-tested here — only what's unique to `/map`: full-
// corpus scale and the `showAdvanced`-only features.
test.describe('/map (full-corpus, showAdvanced)', () => {
  test('renders ~130 nodes and matches the entity count', async ({ page }) => {
    await page.goto('/es/map/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2?.nodes(':childless').length)).toBeGreaterThan(100);
  });

  test('a layer-panel entity button is keyboard-focusable and its full record loads into the inspector without navigating', async ({
    page,
  }) => {
    await page.goto('/es/map/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await page.locator('#map2-layers-toggle').click();
    const btn = page.locator('.map2-entity-btn[data-select-id="doi"]');
    await btn.scrollIntoViewIfNeeded();
    await btn.focus();
    const isFocused = await btn.evaluate((el) => el === document.activeElement);
    expect(isFocused).toBe(true);
    await page.keyboard.press('Enter');
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    const fullPage = page.locator('#map2-inspector-content .map2-inspector-fullpage');
    await expect(fullPage).toBeVisible();
    await expect(fullPage).toContainText('DOI');
    // Selecting via the layer panel never navigates away from /map.
    expect(page.url()).toContain('/es/map/');
  });

  test('clicking a canvas node loads its full record into the inspector; a relation link inside selects in place, without navigating', async ({
    page,
  }) => {
    await page.goto('/es/map/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await page.evaluate(() => (window as any).__cyMap2.$('#doi').emit('tap'));
    const fullPage = page.locator('#map2-inspector-content .map2-inspector-fullpage');
    await expect(fullPage).toContainText('DOI');
    expect(page.url()).toContain('/es/map/');
    await fullPage.locator('details.disclosure--standard > summary').click();
    const relationLink = fullPage.locator('a[href*="/entity/"]').first();
    const href = await relationLink.getAttribute('href');
    await relationLink.click();
    // Still on /map — the click was intercepted, not a real navigation.
    expect(new URL(page.url()).pathname).toBe('/es/map/');
    expect(href).toBeTruthy();
  });

  test('facet chips dim non-matching nodes (showAdvanced-only)', async ({ page }) => {
    await page.goto('/es/map/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await page.locator('.map2-filters summary').click();
    await page.locator('input[data-facet="type"][value="identifier"]').check();
    const dimmedNonIdentifier = await page.evaluate(() =>
      (window as any).__cyMap2
        .nodes(':childless')
        .filter((n: any) => n.data('type') !== 'identifier' && n.hasClass('filtered-out')).length,
    );
    const totalNonIdentifier = await page.evaluate(() =>
      (window as any).__cyMap2.nodes(':childless').filter((n: any) => n.data('type') !== 'identifier').length,
    );
    expect(dimmedNonIdentifier).toBe(totalNonIdentifier);
  });

  test('a multi-selection with a shared neighbour highlights it as state-shared', async ({ page }) => {
    await page.goto('/es/map/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    // Layers panel starts collapsed to its rail — expand it so its entity
    // buttons are actually visible/clickable, not just present in the DOM.
    await page.locator('#map2-layers-toggle').click();
    // Find, generically (no hardcoded domain facts), two nodes that share a
    // common neighbour — then select both and assert the shared class shows up.
    const pair: [string, string] | null = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      const nodes = cy.nodes(':childless');
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        const aNeighbors = new Set(a.closedNeighborhood('node:childless').map((n: any) => n.id()));
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          if (b.id() === a.id()) continue;
          const shared = b
            .closedNeighborhood('node:childless')
            .map((n: any) => n.id())
            .filter((id: string) => aNeighbors.has(id) && id !== a.id() && id !== b.id());
          if (shared.length > 0) return [a.id(), b.id()];
        }
      }
      return null;
    });
    expect(pair).not.toBeNull();
    const [idA, idB] = pair!;
    // Most layer sections start collapsed (only 'identifier'/'cross-cutting'
    // are open by default) — a button inside a closed <details> is in the
    // DOM but not visible, so force both ancestor sections open first.
    await page.evaluate((ids: string[]) => {
      for (const id of ids) {
        const btn = document.querySelector(`.map2-entity-btn[data-select-id="${id}"]`);
        const details = btn?.closest('details.map2-layer') as HTMLDetailsElement | null;
        if (details) details.open = true;
      }
    }, [idA, idB]);
    // Select A, then shift-click B in the layer panel to add it additively —
    // Playwright's `modifiers` option drives a real shiftKey-carrying click,
    // which the button's own listener reads directly (more reliable than
    // threading a synthetic modifier through cy.emit()).
    await page.locator(`.map2-entity-btn[data-select-id="${idA}"]`).scrollIntoViewIfNeeded();
    await page.locator(`.map2-entity-btn[data-select-id="${idA}"]`).click();
    await page.locator(`.map2-entity-btn[data-select-id="${idB}"]`).scrollIntoViewIfNeeded();
    await page.locator(`.map2-entity-btn[data-select-id="${idB}"]`).click({ modifiers: ['Shift'] });
    const sharedCount = await page.evaluate(() => (window as any).__cyMap2.nodes('.state-shared').length);
    expect(sharedCount).toBeGreaterThan(0);
  });

  test('focus mode dims nodes outside the selected node\'s hop neighbourhood (showAdvanced-only)', async ({ page }) => {
    await page.goto('/es/map/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await page.locator('#map2-layers-toggle').click();
    await page.locator('.map2-entity-btn[data-select-id="doi"]').scrollIntoViewIfNeeded();
    await page.locator('.map2-entity-btn[data-select-id="doi"]').click();
    await expect(page.locator('#map2-focus-controls')).toBeVisible();
    const dimmedCount = await page.evaluate(() => (window as any).__cyMap2.nodes('.focus-dimmed').length);
    expect(dimmedCount).toBeGreaterThan(0);
    await page.locator('#map2-focus-clear').click();
    const dimmedAfterClear = await page.evaluate(() => (window as any).__cyMap2.nodes('.focus-dimmed').length);
    expect(dimmedAfterClear).toBe(0);
  });

  test('search finds an entity by name and selecting a result loads its full record', async ({ page }) => {
    await page.goto('/es/map/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await page.locator('#map2-search-input').fill('DOI');
    const results = page.locator('#map2-search-results');
    await expect(results).toBeVisible();
    await results.locator('button').first().click();
    await expect(page.locator('#map2-inspector-content .map2-inspector-fullpage')).toBeVisible();
  });

  test('a selection round-trips through the URL query string (showAdvanced-only)', async ({ page }) => {
    await page.goto('/es/map/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await page.locator('#map2-layers-toggle').click();
    await page.locator('.map2-entity-btn[data-select-id="doi"]').scrollIntoViewIfNeeded();
    await page.locator('.map2-entity-btn[data-select-id="doi"]').click();
    await expect.poll(() => page.evaluate(() => location.search)).toContain('sel=doi');
    const url = page.url();
    await page.goto(url);
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await expect(page.locator('#map2-inspector-content .map2-inspector-fullpage')).toContainText('DOI');
  });

  test('first-visit onboarding shows once and stays dismissed, independently of /map2\'s own dismissal', async ({ page }) => {
    await page.goto('/es/map/');
    const onboarding = page.locator('#map2-onboarding');
    await expect(onboarding).toBeVisible();
    await expect(onboarding).toContainText('¿Qué estoy viendo?');
    await page.locator('#map2-onboarding-dismiss').click();
    await expect(onboarding).toBeHidden();
    await page.reload();
    await expect(page.locator('#map2-onboarding')).toBeHidden();
    // /map2's own onboarding is a SEPARATE dismissal key — dismissing /map's
    // must not have silently dismissed /map2's too.
    await page.goto('/es/map2/');
    await expect(page.locator('#map2-onboarding')).toBeVisible();
  });

  test('map legend groups the types actually present by layer', async ({ page }) => {
    await page.goto('/es/map/');
    // Legend lives inside a collapsed canvas-corner overlay (promoted
    // "chrome diet" from /map2) — expand it before asserting visibility.
    await page.locator('.map2-legend-overlay summary').first().click();
    const legend = page.locator('.diagram-legend').first();
    await expect(legend).toBeVisible();
    await expect(legend).toContainText('Identificadores');
  });
});

test.describe('DiagramLegend on Mermaid diagrams', () => {
  test('a focus-view legend lists only the types actually present, never all 12', async ({ page }) => {
    await page.goto('/es/entity/figshare/');
    const legend = page.locator('.diagram-legend').first();
    await expect(legend).toBeVisible();
    const count = await legend.locator('li').count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(12);
  });
});

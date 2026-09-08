import { test, expect } from '@playwright/test';

// specs.md §7 `/{loc}/map2` row: a curated ~33-entity subset of the
// ecosystem, rendered by its own component (`MapExplorerV2.astro` — a
// separate component from `/map`'s `MapExplorer.astro`, not a shared one;
// see that file's header comment for the full rationale). This suite proves
// the curated scope actually renders (not the whole ~130-node corpus), that
// the hierarchical layout produces a real vertical ordering, that panel
// selection/inspector/search/cross-links all work, and that the viewport
// fix (Opus evaluation report §A2/§B1) actually eliminates the page-level
// scrollbars the prior implementation had.

test.describe('/map2 curated "essential concepts" explorer', () => {
  test('renders the curated subset, not the full ~130-node corpus', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2?.nodes().length)).toBeGreaterThan(15);
    const count = await page.evaluate(() => (window as any).__cyMap2.nodes().length);
    expect(count).toBeLessThan(40);
  });

  test('a layer-panel entity button selects the entity into the inspector without navigating', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    // The Layers panel starts collapsed to its rail on load (chrome diet) —
    // expand it first so its entity buttons are interactable.
    await page.locator('#map2-layers-toggle').click();
    const btn = page.locator('.map2-entity-btn[data-select-id="doi"]');
    await btn.scrollIntoViewIfNeeded();
    await btn.focus();
    await page.keyboard.press('Enter');
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#map2-inspector-content')).not.toBeEmpty();
    expect(page.url()).toContain('/es/map2/');
  });

  test('search is present (restored) and finds an entity by name', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    const input = page.locator('#map2-search-input');
    await expect(input).toBeVisible();
    await input.fill('DOI');
    const results = page.locator('#map2-search-results button');
    await expect(results.first()).toBeVisible();
    await results.first().click();
    await expect(page.locator('#map2-inspector-content')).not.toBeEmpty();
  });

  test('facet filters and focus/hop controls are not present in the simplified view (correctly still dropped)', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect(page.locator('.map-filters')).toHaveCount(0);
    await expect(page.locator('#map-focus-controls')).toHaveCount(0);
    await expect(page.locator('#map2-hops')).toHaveCount(0);
  });

  // /map and /map2 share one component (MapExplorerV2.astro, promoted
  // 2026-09-07) — the crosslink is always `.map2-crosslink` on both routes
  // now (the old `.map-lead a` wrapper belonged to the removed `MapExplorer.astro`).
  test('cross-links to and from the full map work', async ({ page }) => {
    await page.goto('/es/map/');
    await page.locator('.map2-crosslink[href="/es/map2/"]').click();
    await page.waitForURL(/\/es\/map2\/?$/);
    await page.locator('.map2-crosslink[href="/es/map/"]').click();
    await page.waitForURL(/\/es\/map\/?$/);
  });

  // Same `#map2-onboarding` id on both routes now (shared component), but a
  // route-aware `data-onboarding-key` (`mapOnboardingDismissed` vs.
  // `map2OnboardingDismissed`) keeps the two dismissals independent.
  test('onboarding dismissal on /map2 is independent of /map', async ({ page }) => {
    await page.goto('/es/map2/');
    await page.locator('#map2-onboarding-dismiss').click();
    await expect(page.locator('#map2-onboarding')).toBeHidden();
    await page.goto('/es/map/');
    await expect(page.locator('#map2-onboarding')).toBeVisible();
  });

  test('the page has no horizontal or vertical page-level scroll at a standard viewport (Stage 0 viewport fix)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
    expect(overflow.scrollHeight).toBeLessThanOrEqual(overflow.clientHeight);
  });

  test('the hierarchical layout places DataCite above DOI, and DOI shares its row with the rest of the identifier group (tier+depth ranking, unconditional same-type row cohesion)', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    const positions = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      const y = (id: string) => cy.$id(id).position('y');
      return { doi: y('doi'), datacite: y('datacite'), handle: y('handle-system'), orcid: y('orcid'), ror: y('ror') };
    });
    // Lower y = higher on screen (Cytoscape's rendered y grows downward; the
    // layout assigns y = -composite*spacing, so a smaller/more-negative y is
    // higher up — see MapExplorerV2's positionFor comment).
    expect(positions.datacite).toBeLessThan(positions.doi);
    // Same-type row cohesion (2026-09-07, unconditional per direct user
    // instruction — a real depends-on edge between DOI and Handle System no
    // longer splits them onto separate rows): every `identifier` in the
    // curated set shares one row with DOI.
    expect(positions.handle).toBe(positions.doi);
    expect(positions.orcid).toBe(positions.doi);
    expect(positions.ror).toBe(positions.doi);
  });

  test('FAIR and OAI-PMH land in different tiers/bands (4-tier follow-up: `type: standard` alone conflated principles with protocols)', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    const positions = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      const y = (id: string) => cy.$id(id).position('y');
      const parent = (id: string) => cy.$id(id).parent().id();
      return { fairY: y('fair'), oaiY: y('oai-pmh'), fairParent: parent('fair'), oaiParent: parent('oai-pmh') };
    });
    expect(positions.fairParent).not.toBe(positions.oaiParent);
    expect(positions.fairY).toBeLessThan(positions.oaiY); // FAIR (T4) higher up than OAI-PMH (T3)
  });

  test('the T4 principles tier has more than one real member (not a one-off around FAIR alone)', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    const t4Count = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      const fairParent = cy.$id('fair').parent().id();
      return cy.$id(fairParent).children().length;
    });
    expect(t4Count).toBeGreaterThanOrEqual(2); // fair, posi, trust-principles, unesco-recommendation-open-science
  });

  test("cytoscape's own width/height match the canvas container's real rendered size (regression: a real construction-time size race)", async ({
    page,
  }) => {
    // Root cause, traced (not guessed): at the exact moment `cytoscape({...})`
    // constructs, `cy.height()` read 574 — taller than the container's true,
    // settled height (424, confirmed identical immediately after and well
    // after load). The `layout: { fit: true }` option computed its zoom/pan
    // against that too-tall reading, so on this corpus's real density content
    // could render outside the container's ACTUAL bounds — nothing was
    // "there" for a click/drag to grab. Fixed by re-fitting from inside the
    // ResizeObserver's first (guaranteed, spec-mandated) callback, which
    // reliably reports the container's real size.
    //
    // This checks the actual root cause directly — `cy`'s own internal
    // width/height must match the container `<div>`'s real DOM rect — rather
    // than "every node is visible on load" (that property no longer holds by
    // DESIGN: `MIN_DEFAULT_ZOOM`, below, deliberately shows only part of a
    // dense layout by default and relies on panning for the rest, which is
    // unrelated to this bug and shouldn't be conflated with it).
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    const sizes = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      const rect = document.getElementById('map2-canvas')!.getBoundingClientRect();
      return { cyWidth: cy.width(), cyHeight: cy.height(), realWidth: rect.width, realHeight: rect.height };
    });
    expect(Math.abs(sizes.cyWidth - sizes.realWidth)).toBeLessThan(2);
    expect(Math.abs(sizes.cyHeight - sizes.realHeight)).toBeLessThan(2);
  });

  test('a node class-box stays correctly sized after a zoom-out/zoom-in interaction cycle (regression: text was illegible after any pan/zoom)', async ({ page }) => {
    // Root cause of the reported bug: applyLod()'s zoom-out branch inline-set
    // a node's width/height to the 14px "dot" size; the zoom-in branch only
    // re-set width/height the FIRST time a node's class-box was assigned
    // (guarded by a "already generated" cache meant for the expensive SVG
    // string, not for the width/height application). After the first
    // zoom-out/zoom-in cycle, width/height stayed stuck at 14px while the
    // 176px-wide class-box background image remained attached — squeezing
    // all its baked-in text down to sub-pixel illegibility. A static-load-only
    // test would not catch this; this test explicitly exercises the
    // interaction sequence the user described (load -> zoom out -> zoom in).
    //
    // This test explicitly zooms IN first (to a level distinct from
    // whatever the default view happens to be) to isolate the LOD
    // transition logic itself from the separate "what zoom does the page
    // open at" question (covered by its own test below).
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);

    // Block body (not an implicit-return expression): `.zoom(n)` returns the
    // whole Cytoscape core instance for chaining, and letting Playwright
    // serialize that huge, circular native object back over CDP is fragile
    // and was observed to hang the call outright under load — the test only
    // needs the side effect, so throw the return value away explicitly.
    await page.evaluate(() => {
      (window as any).__cyMap2.zoom(1); // above LOD_ZOOM_THRESHOLD -> class-box mode
    });
    await page.waitForTimeout(50);
    const before = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      const n = cy.$id('doi');
      return { width: n.numericStyle('width'), height: n.numericStyle('height'), hasClass: n.hasClass('classbox') };
    });
    expect(before.hasClass).toBe(true);
    expect(before.width).toBeGreaterThan(100); // full class-box width once zoomed above the LOD threshold

    await page.evaluate(() => {
      (window as any).__cyMap2.zoom(0.2); // below LOD_ZOOM_THRESHOLD -> dot mode
    });
    await page.waitForTimeout(50);
    const duringDot = await page.evaluate(() => {
      const n = (window as any).__cyMap2.$id('doi');
      return { width: n.numericStyle('width'), hasClass: n.hasClass('classbox') };
    });
    expect(duringDot.hasClass).toBe(false);
    expect(duringDot.width).toBe(14);

    await page.evaluate(() => {
      (window as any).__cyMap2.zoom(1); // back above threshold -> class-box mode again
    });
    await page.waitForTimeout(50);
    const after = await page.evaluate(() => {
      const n = (window as any).__cyMap2.$id('doi');
      return { width: n.numericStyle('width'), height: n.numericStyle('height'), hasClass: n.hasClass('classbox') };
    });
    expect(after.hasClass).toBe(true);
    expect(after.width).toBe(before.width); // must be restored to the full class-box size, not stuck at 14px
    expect(after.height).toBe(before.height);
  });

  test('a multi-selection highlights a shared neighbour across two repositories (oai-pmh via zenodo + dataverse)', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await page.locator('#map2-layers-toggle').click();
    await page.locator('.map2-layer[data-layer="institutional-system"] summary').click();
    await page.locator('.map2-entity-btn[data-select-id="zenodo"]').click();
    await page.locator('.map2-entity-btn[data-select-id="dataverse"]').click({ modifiers: ['Shift'] });
    const sharedClass = await page.evaluate(() => (window as any).__cyMap2.$id('oai-pmh').hasClass('state-shared'));
    expect(sharedClass).toBe(true);
  });

  // Follow-up bug report, after the layout-bloat and row-spacing fixes:
  // "still a little messy, some cards are on top of others and no clear
  // division between roles is present... a zone with the name, a big
  // rectangle, with the entities inside it" — restores the compound tier
  // bands `/map` already had (there grouped by `layer`; here by the new
  // `tier` concept), and fixes the row-spacing bug that caused the overlap
  // (see hierarchy.test.ts's "production spacing has zero node overlap" for
  // the underlying unit-level regression coverage).
  test('renders labelled tier bands that fully contain their member nodes', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    const result = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      const bands = cy.nodes('.tier-band');
      const doi = cy.$id('doi'); // T1
      const datacite = cy.$id('datacite'); // T2
      function containingBand(node: any): { label: string; contains: boolean } | null {
        const parent = node.parent();
        if (parent.empty()) return null;
        const bb = parent.boundingBox();
        const pos = node.position();
        const contains = pos.x >= bb.x1 && pos.x <= bb.x2 && pos.y >= bb.y1 && pos.y <= bb.y2;
        return { label: parent.data('label'), contains };
      }
      return {
        bandCount: bands.length,
        labels: bands.map((b: any) => b.data('label')),
        doiBand: containingBand(doi),
        dataciteBand: containingBand(datacite),
      };
    });
    // 4 tiers are present in the curated set (T1 instruments, T2 agencies/
    // orgs, T3 standards/specs, T4 principles/policies) per hierarchy.ts's
    // computeTier — split from 3 in the 2026-09-06 follow-up so `standard`
    // entities like FAIR (principles) and OAI-PMH (protocol) land in
    // different tiers/bands instead of one.
    expect(result.bandCount).toBe(4);
    // Locale-aware labels, not raw tier numbers or English leaking into es.
    expect(result.labels.some((l: string) => l.includes('Instrumentos'))).toBe(true);
    expect(result.labels.some((l: string) => l.includes('Instituciones'))).toBe(true);
    expect(result.labels.some((l: string) => l.includes('Estándares'))).toBe(true);
    expect(result.labels.some((l: string) => l.includes('Principios'))).toBe(true);
    // Each node sits inside its own band's bounding box (Cytoscape's compound
    // auto-sizing did its job) and DOI/DataCite land in DIFFERENT bands
    // (they're in different tiers), proving this isn't one accidental band
    // that happens to contain everything.
    expect(result.doiBand?.contains).toBe(true);
    expect(result.dataciteBand?.contains).toBe(true);
    expect(result.doiBand?.label).not.toBe(result.dataciteBand?.label);
  });

  test('tapping a tier band background does not select it as an entity (compound parents are not selectable)', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    const before = await page.evaluate(() => document.getElementById('map2-inspector-content')?.innerHTML ?? '');
    await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      const band = cy.nodes('.tier-band').first();
      cy.emit('tap', [{ target: band }]);
      band.emit('tap');
    });
    await page.waitForTimeout(50);
    const after = await page.evaluate(() => document.getElementById('map2-inspector-content')?.innerHTML ?? '');
    expect(after).toBe(before); // no bogus selection/inspector render for a band id
  });

  test('a node can still be dragged to a new position after the hierarchical layout runs (drag must stay enabled)', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    const canvasBox = await page.locator('#map2-canvas').boundingBox();
    if (!canvasBox) throw new Error('canvas not found');

    // Explicitly bring the target node into view first — the default view
    // deliberately shows only part of a dense layout (see
    // `MIN_DEFAULT_ZOOM`'s comment), so DOI isn't guaranteed to already be
    // on-screen; that's an intentional, unrelated design choice, not
    // something this drag-capability test should depend on.
    await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      cy.center(cy.$id('doi'));
    });

    const before = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      const n = cy.$id('doi');
      return { model: n.position(), rendered: n.renderedPosition() };
    });

    const startX = canvasBox.x + before.rendered.x;
    const startY = canvasBox.y + before.rendered.y;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 60, startY + 40, { steps: 5 });
    await page.mouse.up();

    const after = await page.evaluate(() => (window as any).__cyMap2.$id('doi').position());
    const moved = Math.abs(after.x - before.model.x) > 5 || Math.abs(after.y - before.model.y) > 5;
    expect(moved).toBe(true);
  });

  // Follow-up bug report round 2: "nodes should not touch between them; we
  // can have more space" — root cause was a real gap of ~5px/14px at
  // rowSpacing 85/colSpacing 190 (see hierarchy.test.ts's own minimum-gap
  // unit test for the layout-level assertion). This is the same property
  // checked against the ACTUAL rendered/screen-space bounding boxes on the
  // real page, at the real default zoom, rather than in the abstract.
  test('no two rendered node boxes are closer than a real, visible gap at the default view', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    const minGap = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      const nodes = cy.nodes(':childless').toArray();
      let min = Infinity;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i].renderedBoundingBox();
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j].renderedBoundingBox();
          const overlapX = a.x1 < b.x2 && b.x1 < a.x2;
          const overlapY = a.y1 < b.y2 && b.y1 < a.y2;
          if (overlapX && overlapY) {
            min = Math.min(min, -1);
            continue;
          }
          const dx = Math.max(a.x1 - b.x2, b.x1 - a.x2, 0);
          const dy = Math.max(a.y1 - b.y2, b.y1 - a.y2, 0);
          const gap = overlapX ? dy : overlapY ? dx : Math.min(dx, dy);
          min = Math.min(min, gap);
        }
      }
      return min;
    });
    expect(minGap).toBeGreaterThan(0); // never a true overlap
    expect(minGap).toBeGreaterThanOrEqual(8); // a real, visible gap on screen, not a hairline
  });

  // Follow-up bug report round 2: "when hovering over a card, is not
  // highlighted (everything is grayed, all cards, not only the one not
  // hovered or related)". The underlying `highlight()`/classification logic
  // was traced and found to be correct at every zoom level (reproduced
  // directly, off this suite, before touching any code) — the actual defect
  // was that the default view opened in dot mode (14x14 px), where opacity
  // 1 vs 0.12 renders ~4 real screen pixels apart and is imperceptible
  // regardless of correctness. Fixed via `MIN_DEFAULT_ZOOM` (see
  // `resetView`), which this test implicitly exercises by NOT zooming
  // in first — if the default-zoom fix regressed, this would go back to
  // testing dot mode instead of the real class-box appearance the user
  // actually reported the problem against.
  test('hovering a card highlights it and its real neighbours, and visibly dims everything else, at the default view', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    const hoverTarget = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      const n = cy.$id('clarivate'); // has a real neighbour (web-of-science) in the curated set
      // Bring it into view first — the default view deliberately shows only
      // part of the layout (see MIN_DEFAULT_ZOOM's comment), so this node
      // isn't guaranteed to already be on-screen; unrelated to what this
      // test is actually checking (hover highlighting).
      cy.center(n);
      const pos = n.renderedPosition();
      const rect = document.getElementById('map2-canvas')!.getBoundingClientRect();
      return { x: rect.left + pos.x, y: rect.top + pos.y };
    });
    await page.mouse.move(hoverTarget.x, hoverTarget.y);
    await page.waitForTimeout(300);
    const result = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      return {
        hoveredHighlighted: cy.$id('clarivate').hasClass('highlighted'),
        neighbourHighlighted: cy.$id('web-of-science').hasClass('highlighted'),
        hoveredOpacity: cy.$id('clarivate').numericStyle('opacity'),
        // A compound child's ACTUAL rendered opacity is its own opacity
        // times every ancestor's — `numericStyle('opacity')` above was
        // already 1 even during the real bug (every tier-band ancestor got
        // `.dimmed` on every hover, since `closedNeighborhood()` never
        // includes a node's own compound parent), so it never caught the
        // regression. `effectiveOpacity()` is the one check that does:
        // measured 0.12 on the hovered node itself before the fix.
        hoveredEffectiveOpacity: cy.$id('clarivate').effectiveOpacity(),
        neighbourEffectiveOpacity: cy.$id('web-of-science').effectiveOpacity(),
        tierBandDimmed: cy.nodes('.tier-band').filter('.dimmed').length,
        dimmedCount: cy.nodes(':childless').filter('.dimmed').length,
        totalCount: cy.nodes(':childless').length,
      };
    });
    expect(result.hoveredHighlighted).toBe(true);
    expect(result.neighbourHighlighted).toBe(true);
    expect(result.hoveredOpacity).toBe(1);
    expect(result.hoveredEffectiveOpacity).toBe(1);
    expect(result.neighbourEffectiveOpacity).toBe(1);
    // Tier-band compound parents must never be dimmed — doing so drags down
    // the EFFECTIVE opacity of every real node inside them, including
    // whichever band the hovered node itself lives in.
    expect(result.tierBandDimmed).toBe(0);
    // Everything except the hovered node + its real neighbour(s) should be
    // dimmed — not zero (that would mean hover did nothing) and not
    // matching the total (that would be the exact bug reported: everything,
    // including the hovered card, grayed out).
    expect(result.dimmedCount).toBeGreaterThan(0);
    expect(result.dimmedCount).toBeLessThan(result.totalCount);
  });

  // Follow-up bug report round 2: reconsidered whether the default view
  // should always shrink to fit the whole graph (see `resetView`'s own
  // comment for the reasoning) — asserts the floor is real on the actual
  // built page, not just in isolated logic.
  test('opens at a legible default zoom rather than shrinking to fit the whole graph', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    const zoom = await page.evaluate(() => (window as any).__cyMap2.zoom());
    expect(zoom).toBeGreaterThanOrEqual(0.45);
    const allBoxes = await page.evaluate(() => (window as any).__cyMap2.nodes(':childless').toArray().every((n: any) => n.hasClass('classbox')));
    expect(allBoxes).toBe(true);
  });

  // Follow-up round 4 (2026-09-07, user, increasingly explicit): a
  // hand-built compact summary, then a "Ver ficha completa" BUTTON that
  // fetched the real page into the pane on click, were both rejected in
  // turn — final ask: "is it needed to have a button? why is not displayed
  // directly?". Selecting a node now fetches and injects the real
  // standalone page's content immediately, no button, no new tab, no
  // intermediate compact-summary step.
  test('selecting a node loads the real full record directly into the pane, no button, no new tab', async ({ context, page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await page.locator('#map2-layers-toggle').click();
    // DataCite's layer group ("agency") isn't one of the two open-by-default
    // groups (identifier, cross-cutting) — expand it first.
    await page.locator('.map2-layer[data-layer="agency"] summary').click();

    const pagesBefore = context.pages().length;
    await page.locator('.map2-entity-btn[data-select-id="datacite"]').click();
    const inspector = page.locator('#map2-inspector-content');

    // The real full page's own content shows up with no further click — e.g.
    // its "Todas las relaciones" (RelationTable) heading, which only exists
    // on the full page, never in a hand-built summary.
    const fullPage = inspector.locator('.map2-inspector-fullpage');
    await expect(fullPage).toBeVisible();
    await expect(fullPage).toContainText('Todas las relaciones');
    await expect(fullPage).toContainText('DataCite');
    // No new tab/window was opened.
    expect(context.pages().length).toBe(pagesBefore);
  });

  // Follow-up bug report round 3: user compared the inspector against
  // `/es/entity/datacite-metadata-schema/` and found a hand-built summary
  // silently undercounted real relations (3 shown vs. the full page's real 5
  // incoming `implements` edges: dataverse, figshare, invenio-rdm, pangaea,
  // zenodo — confirmed in src/content/entities/*.md). Now that the pane
  // shows the real standalone page's own content directly, this class of bug
  // structurally can't recur — the full page's own RelationTable already
  // reflects the entity's true relations, curated-set or not.
  test('the injected full record shows the entity\'s TRUE full relation count, including relations outside the curated set', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await page.locator('#map2-layers-toggle').click();
    const btn = page.locator('.map2-entity-btn[data-select-id="datacite-metadata-schema"]');
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    const inspector = page.locator('#map2-inspector-content');
    const fullPage = inspector.locator('.map2-inspector-fullpage');
    await expect(fullPage).toBeVisible();
    await expect(fullPage).toContainText('5 entrantes');
    for (const name of ['Dataverse', 'Figshare', 'Zenodo', 'InvenioRDM', 'PANGAEA']) {
      await expect(fullPage).toContainText(name);
    }
  });

  // Follow-up bug report round 4: "we lose the buttons you implemented" — the
  // old hand-built relation pills called toggleSelection() on click; the real
  // injected page's relation links are plain <a href> anchors that would
  // otherwise navigate the whole browser away from /map2. Confirms clicking
  // one selects the target on the canvas in place instead.
  test('clicking a relation link inside the injected full record selects that entity without leaving /map2', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await page.locator('#map2-layers-toggle').click();
    const btn = page.locator('.map2-entity-btn[data-select-id="datacite-metadata-schema"]');
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    const inspector = page.locator('#map2-inspector-content');
    const fullPage = inspector.locator('.map2-inspector-fullpage');
    await expect(fullPage).toBeVisible();

    // The relation table lives inside the real page's collapsed "More
    // detail" <details> — expand it first, same as a real user would.
    await fullPage.locator('details.disclosure--standard > summary').click();
    const zenodoLink = fullPage.getByRole('link', { name: 'Zenodo', exact: true });
    await expect(zenodoLink).toBeVisible();
    await zenodoLink.click();

    // Still on /map2 — no real navigation happened.
    expect(new URL(page.url()).pathname).toBe('/es/map2/');
    // The pane now shows Zenodo's own full record.
    await expect(fullPage.locator('h2').first()).toHaveText('Zenodo');
    // The canvas selection itself moved to zenodo, not just the pane's text.
    const selectedId = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      const selectedNode = cy.nodes('.state-selected')[0];
      return selectedNode ? selectedNode.id() : null;
    });
    expect(selectedId).toBe('zenodo');
  });

  // A source citation or the raw-JSON export link is not a same-locale
  // `/entity/<id>/` link — the interceptor's regex must leave it alone so it
  // keeps its normal (real navigation / external) behaviour. Checked without
  // actually clicking through an external URL (flaky/network-dependent in
  // CI) — asserts directly against the hrefs the injected page's own source
  // list and raw-JSON export link render.
  test('non-entity links inside the injected full record are left as real links, not intercepted', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await page.locator('#map2-layers-toggle').click();
    const btn = page.locator('.map2-entity-btn[data-select-id="datacite-metadata-schema"]');
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    const inspector = page.locator('#map2-inspector-content');
    const fullPage = inspector.locator('.map2-inspector-fullpage');
    await expect(fullPage).toBeVisible();

    // The raw-JSON link lives inside the real page's nested "More
    // detail" > "Technical detail" <details> — expand both.
    await fullPage.locator('details.disclosure--standard > summary').click();
    await fullPage.locator('details.disclosure--technical > summary').click();
    const rawJsonLink = fullPage.getByRole('link', { name: /raw json|json sin procesar/i });
    await expect(rawJsonLink).toHaveAttribute('href', '/entity/datacite-metadata-schema.json');

    const sourceLinks = await fullPage.locator('a[href^="http"]').all();
    expect(sourceLinks.length).toBeGreaterThan(0);
    for (const link of sourceLinks) {
      const href = await link.getAttribute('href');
      expect(href).not.toMatch(/^\/es\/entity\//);
    }
  });

  // Reselecting a different node while the previous node's fetch is still in
  // flight must show the NEWER node's content, not a stale result clobbering
  // it once the slower first fetch resolves.
  test('rapidly reselecting a node shows the latest selection, not a stale fetch result', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await page.locator('#map2-layers-toggle').click();
    await page.locator('.map2-entity-btn[data-select-id="doi"]').click();
    await page.locator('.map2-entity-btn[data-select-id="ror"]').click();
    const inspector = page.locator('#map2-inspector-content');
    const fullPage = inspector.locator('.map2-inspector-fullpage');
    await expect(fullPage).toBeVisible();
    // The injected page's own (demoted) main heading names the LATEST
    // selection, ROR — not a stale DOI result landing after the fact.
    await expect(fullPage.locator('h2').first()).toHaveText('ROR');
  });

  // Follow-up bug report round 3: "that should allow the user for resizing".
  test('the inspector panel can be resized via its drag handle', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    const before = await page.locator('#map2-inspector').boundingBox();
    if (!before) throw new Error('inspector not found');
    const handle = page.locator('#map2-inspector-resize');
    const handleBox = await handle.boundingBox();
    if (!handleBox) throw new Error('resize handle not found');
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x - 100, handleBox.y + handleBox.height / 2, { steps: 5 }); // drag left -> widen
    await page.mouse.up();
    const after = await page.locator('#map2-inspector').boundingBox();
    if (!after) throw new Error('inspector not found after resize');
    expect(after.width).toBeGreaterThan(before.width + 50);
  });
});

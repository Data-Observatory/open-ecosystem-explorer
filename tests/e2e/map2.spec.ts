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
    // `:childless` — real entities only, excluding the compound tier-band
    // AND nested sub-band (2026-09-08) container nodes, which aren't part of
    // the curated entity count.
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2?.nodes(':childless').length)).toBeGreaterThan(15);
    const count = await page.evaluate(() => (window as any).__cyMap2.nodes(':childless').length);
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

  test('TRUST principles and OAI-PMH land in different tiers/bands (4-tier follow-up: `type: standard` alone conflated principles with protocols)', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    const positions = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      const y = (id: string) => cy.$id(id).position('y');
      const parent = (id: string) => cy.$id(id).parent().id();
      return { fairY: y('trust-principles'), oaiY: y('oai-pmh'), fairParent: parent('trust-principles'), oaiParent: parent('oai-pmh') };
    });
    expect(positions.fairParent).not.toBe(positions.oaiParent);
    expect(positions.fairY).toBeLessThan(positions.oaiY); // TRUST principles (T4) higher up than OAI-PMH (T3)
  });

  test('the T4 principles tier has more than one real member (not a one-off around FAIR alone)', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    const t4Count = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      const fairParent = cy.$id('trust-principles').parent().id();
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
      // LOD_ZOOM_THRESHOLD is 0.4 (the Card-size tripling that briefly
      // changed this was reverted the same day — see hierarchy.ts's
      // LABEL_CLEARANCE comment) — 0.1 stays comfortably below it.
      (window as any).__cyMap2.zoom(0.1); // below LOD_ZOOM_THRESHOLD -> dot mode
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
          // On ONE shared axis, the true separation is the plain gap on the
          // OTHER axis (dx or dy is exactly 0 there). When NEITHER axis
          // overlaps (a genuinely diagonal pair — e.g. two cards in
          // different Tiers/columns that happen to land at a similar
          // on-screen row height purely by coincidence, 2026-09-09 tight-
          // spacing retune surfaced this: such a pair can have a tiny `dy`
          // while sitting well over 1000px apart in `dx`), the real nearest-
          // corner distance is the Euclidean hypotenuse, NOT `min(dx, dy)` —
          // the previous `min(dx, dy)` badly underestimated separation for
          // any diagonal pair (reporting ~5px for two cards actually >1000px
          // apart), which is what "a real, visible gap" is actually meant to
          // rule out — two cards that read as touching/crowded on screen,
          // not two cards that are merely at a similar height while
          // nowhere near each other horizontally.
          const gap = overlapX ? dy : overlapY ? dx : Math.sqrt(dx * dx + dy * dy);
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
    // MIN_DEFAULT_ZOOM is 0.45 (the Card-size tripling that briefly changed
    // this was reverted the same day — see hierarchy.ts's LABEL_CLEARANCE
    // comment for what "triple it" actually meant).
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

  // ---- Tight, automatic Cluster/Tier spacing (2026-09-09 follow-up, user:
  // "the space between cluster and tiers is too high... can we achieve this
  // in an automatic way?"). `hierarchy.ts`'s `LABEL_CLEARANCE`/
  // `CLUSTER_LABEL_CLEARANCE` shrank from one flat, empirically-guessed
  // 260px to a formula derived from the real label font-size/border/padding
  // in this file's own Cytoscape stylesheet, plus the Cluster grid's cell
  // sizing switched from one uniform max-of-all-Clusters cell to per-row/
  // per-column sizing (see hierarchy.ts's `computeLayout` comment) — both
  // changes only ever REDUCE reserved space, so the one thing that can
  // regress is a real visual overlap between two Tier/Cluster compound
  // boxes. This is the actual bounding-box check (like the existing Card-
  // level "no two rendered node boxes are closer than a real, visible gap"
  // test above, but for the grey compound bands, and run against BOTH the
  // full `/map` corpus — the denser, more tier/cluster-populated case — and
  // the sparser curated `/map2` subset, since "works when we add/remove
  // cards" has to hold at both scales, not just one). ----
  async function bandOverlaps(page: import('@playwright/test').Page): Promise<string[]> {
    return page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      const bands = cy.nodes('.tier-band, .sub-band').toArray();
      function isAncestor(x: any, y: any): boolean {
        let p = y.parent();
        while (p.nonempty()) {
          if (p.id() === x.id()) return true;
          p = p.parent();
        }
        return false;
      }
      const found: string[] = [];
      for (let i = 0; i < bands.length; i++) {
        for (let j = i + 1; j < bands.length; j++) {
          const a = bands[i];
          const b = bands[j];
          // A Cluster (`.sub-band`) is expected to sit fully INSIDE its own
          // Tier's box — that's containment, not the sibling-overlap bug
          // this test is guarding against.
          if (isAncestor(a, b) || isAncestor(b, a)) continue;
          const ba = a.renderedBoundingBox();
          const bb = b.renderedBoundingBox();
          const overlapX = ba.x1 < bb.x2 && bb.x1 < ba.x2;
          const overlapY = ba.y1 < bb.y2 && bb.y1 < ba.y2;
          if (overlapX && overlapY) found.push(`${a.data('label')} <-> ${b.data('label')}`);
        }
      }
      return found;
    });
  }

  test('no two rendered Tier/Cluster boxes overlap on /map2 (curated subset)', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    // Wait for the initial ResizeObserver-driven fit/zoom-floor to actually
    // settle (see `resetView`'s own comment in MapExplorerV2.astro) before
    // measuring — `renderedBoundingBox()` is read mid-transition otherwise,
    // an unrelated timing race this test doesn't need to also chase.
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2.zoom())).toBeGreaterThanOrEqual(0.4);
    expect(await bandOverlaps(page)).toEqual([]);
  });

  test('no two rendered Tier/Cluster boxes overlap on /map (full corpus)', async ({ page }) => {
    await page.goto('/es/map/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2.zoom())).toBeGreaterThanOrEqual(0.4);
    expect(await bandOverlaps(page)).toEqual([]);
  });

  // Follow-up bug report (2026-09-09, round 3): "Tier text ... I want the
  // title to start on the beginning of the box (left side), not ending
  // there like is right now. And above the box" — a reversal of the
  // immediately-preceding round's "inside the border" fix, for Tier ONLY
  // (Cluster titles were separately confirmed correct and must stay
  // untouched). Verified via `renderedBoundingBox({includeLabels})`
  // before/after diffs — the same technique used to empirically discover
  // Cytoscape's real halign/valign anchor behaviour for this fix (a
  // standalone harness measurement, not guesswork): `includeLabels: false`
  // strips just the label's own contribution to a node's rendered box, so
  // comparing it against `includeLabels: true` isolates exactly how far (and
  // in which direction) the label extends beyond the node's own border.
  function measureLabelExtent(page: import('@playwright/test').Page, selector: string, labelSubstring: string) {
    return page.evaluate(
      ({ selector, labelSubstring }) => {
        const cy = (window as any).__cyMap2;
        const n = cy.nodes(selector).filter((el: any) => el.data('label').includes(labelSubstring)).first();
        const withLabel = n.renderedBoundingBox({ includeLabels: true });
        const withoutLabel = n.renderedBoundingBox({ includeLabels: false });
        return {
          label: n.data('label'),
          // > 0 means the label pokes up ABOVE the box's own top border.
          aboveExtension: withoutLabel.y1 - withLabel.y1,
          // > 0 means the label sticks out past the box's LEFT border.
          leftOvershoot: withoutLabel.x1 - withLabel.x1,
          // > 0 means the label sticks out past the box's RIGHT border.
          rightOvershoot: withLabel.x2 - withoutLabel.x2,
        };
      },
      { selector, labelSubstring },
    );
  }

  test('Tier titles float ABOVE their box (not inside), for both a short and a long label, on /map2', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2.zoom())).toBeGreaterThanOrEqual(0.4);
    for (const labelSubstring of ['Instrumentos y sistemas', 'Principios y políticas']) {
      const extent = await measureLabelExtent(page, '.tier-band', labelSubstring);
      // Floats above the border by a real, visible amount (not touching it,
      // not pulled inside — a value near/below 0 here would mean the old
      // "inside the border" behaviour regressed back).
      expect(extent.aboveExtension, `${extent.label} aboveExtension`).toBeGreaterThan(10);
      // Starts flush at (or just inside) the left border, growing RIGHT —
      // must never stick out past either the left or right edge, regardless
      // of the label's own length (this is exactly the bug being fixed: a
      // fixed `text-margin-x` couldn't satisfy this for every label length,
      // hence the dynamic per-label estimate in hierarchy.ts).
      expect(extent.leftOvershoot, `${extent.label} leftOvershoot`).toBeLessThanOrEqual(2);
      expect(extent.rightOvershoot, `${extent.label} rightOvershoot`).toBeLessThanOrEqual(2);
    }
  });

  test('Cluster titles remain unchanged: fully inside their box, no external extension on any side, on /map2', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2.zoom())).toBeGreaterThanOrEqual(0.4);
    const extent = await measureLabelExtent(page, '.sub-band', '');
    expect(extent.aboveExtension, `${extent.label} aboveExtension`).toBeLessThanOrEqual(1);
    expect(extent.leftOvershoot, `${extent.label} leftOvershoot`).toBeLessThanOrEqual(1);
    expect(extent.rightOvershoot, `${extent.label} rightOvershoot`).toBeLessThanOrEqual(1);
  });

  // Real Cytoscape-measured (canvas font metrics, not this suite's own
  // guess) glyph height AND declared font-size must be identical between a
  // Tier and a Cluster label — the user reported them reading as different
  // sizes despite both style rules referencing the exact same
  // `LABEL_FONT_SIZE` constant in source; this proves there is no residual
  // runtime discrepancy (the perceived mismatch traced to the position bug
  // fixed above — a label sitting outside the visible band read as
  // smaller/harder to read, not an actual font-size difference).
  test('Tier and Cluster labels render at the exact same font-size and glyph line-height', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    const metrics = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      function metricsOf(selector: string) {
        const n = cy.nodes(selector).first();
        const rs = n[0]._private.rscratch;
        return { labelHeight: rs.labelHeight, fontSize: n.pstyle('font-size').pfValue };
      }
      return { tier: metricsOf('.tier-band'), cluster: metricsOf('.sub-band') };
    });
    expect(metrics.tier.fontSize).toBe(metrics.cluster.fontSize);
    expect(metrics.tier.labelHeight).toBe(metrics.cluster.labelHeight);
  });

  // ---- Focus mode (user: "can we implement a focus, so once I select
  // something (one or more cards), I can only see those (for if the
  // distance is too high)"). A generic `#map2-focus-toggle`/
  // `#map2-focus-exit` pair, always present (unlike the advanced
  // `#map2-hops`/`#map2-focus-controls` UI, which stays `/map`-only — see
  // the "facet filters and focus/hop controls are not present" test above,
  // still correctly asserting `#map2-hops` is absent from `/map2`). ----
  test('selecting a card reveals a Focus button; clicking it isolates the view to the selection + its neighbours', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    const focusToggle = page.locator('#map2-focus-toggle');
    await expect(focusToggle).toBeHidden(); // nothing selected yet
    await page.evaluate(() => (window as any).__cyMap2.$id('doi').emit('tap'));
    await expect(focusToggle).toBeVisible();
    await focusToggle.click();
    const result = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      return {
        doiDimmed: cy.$id('doi').hasClass('focus-dimmed'),
        // 'handle-system' shares a real edge with 'doi' in the curated set
        // (DOI depends-on Handle System) — a direct neighbour, must stay
        // visible.
        neighbourDimmed: cy.$id('handle-system').hasClass('focus-dimmed'),
        // 'clarivate' has no relation to 'doi' at all — must be dimmed.
        unrelatedDimmed: cy.$id('clarivate').hasClass('focus-dimmed'),
      };
    });
    expect(result.doiDimmed).toBe(false);
    expect(result.neighbourDimmed).toBe(false);
    expect(result.unrelatedDimmed).toBe(true);
    await expect(page.locator('#map2-focus-exit')).toBeVisible();
    await expect(focusToggle).toBeHidden();
  });

  test('multi-selecting two cards and entering focus dims everything outside the union of their neighbourhoods', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    // Same layer-panel multi-select mechanism (shift-click) already proven
    // by the "a multi-selection highlights a shared neighbour" test above —
    // real Playwright modifier clicks, not a simulated Cytoscape event.
    await page.locator('#map2-layers-toggle').click();
    await page.locator('.map2-layer[data-layer="institutional-system"] summary').click();
    await page.locator('.map2-entity-btn[data-select-id="zenodo"]').click();
    await page.locator('.map2-entity-btn[data-select-id="dataverse"]').click({ modifiers: ['Shift'] });
    const selectedIds = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      return cy.nodes('.state-selected').map((n: any) => n.id());
    });
    expect(selectedIds.sort()).toEqual(['dataverse', 'zenodo']);
    await page.locator('#map2-focus-toggle').click();
    const result = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      return {
        zenodoDimmed: cy.$id('zenodo').hasClass('focus-dimmed'),
        dataverseDimmed: cy.$id('dataverse').hasClass('focus-dimmed'),
        // oai-pmh is a shared neighbour of both zenodo and dataverse.
        sharedNeighbourDimmed: cy.$id('oai-pmh').hasClass('focus-dimmed'),
        unrelatedDimmed: cy.$id('clarivate').hasClass('focus-dimmed'),
      };
    });
    expect(result.zenodoDimmed).toBe(false);
    expect(result.dataverseDimmed).toBe(false);
    expect(result.sharedNeighbourDimmed).toBe(false);
    expect(result.unrelatedDimmed).toBe(true);
  });

  test('the "Show all" button exits focus mode and restores every card', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await page.evaluate(() => (window as any).__cyMap2.$id('doi').emit('tap'));
    await page.locator('#map2-focus-toggle').click();
    // Cytoscape renders to a `<canvas>`, not per-node DOM elements — a
    // `.focus-dimmed` class lives in Cytoscape's own style-class system, not
    // as a real HTML `class` attribute a DOM locator could find. Assert via
    // Cytoscape's own API instead, same as this suite's other focus tests.
    const dimmedBeforeExit = await page.evaluate(() => (window as any).__cyMap2.elements('.focus-dimmed').length);
    expect(dimmedBeforeExit).toBeGreaterThan(0);
    await page.locator('#map2-focus-exit').click();
    const dimmedCount = await page.evaluate(() => (window as any).__cyMap2.elements('.focus-dimmed').length);
    expect(dimmedCount).toBe(0);
    await expect(page.locator('#map2-focus-exit')).toBeHidden();
  });

  test('pressing Escape exits an active focus session', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await page.evaluate(() => (window as any).__cyMap2.$id('doi').emit('tap'));
    await page.locator('#map2-focus-toggle').click();
    await expect(page.locator('#map2-focus-exit')).toBeVisible();
    await page.keyboard.press('Escape');
    const dimmedCount = await page.evaluate(() => (window as any).__cyMap2.elements('.focus-dimmed').length);
    expect(dimmedCount).toBe(0);
    await expect(page.locator('#map2-focus-exit')).toBeHidden();
  });

  test('clicking the empty canvas background while focused clears the selection and exits focus', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await page.evaluate(() => (window as any).__cyMap2.$id('doi').emit('tap'));
    await page.locator('#map2-focus-toggle').click();
    await expect(page.locator('#map2-focus-exit')).toBeVisible();
    // A tap emitted directly on the core (no target override) defaults to
    // `evt.target === cy` — the same "empty background" condition the
    // production click handler checks — matching how this suite's own
    // "tapping a tier band background" test above drives Cytoscape events
    // directly rather than simulating real mouse coordinates.
    await page.evaluate(() => (window as any).__cyMap2.emit('tap'));
    const state = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      return { dimmed: cy.elements('.focus-dimmed').length, selected: cy.nodes('.state-selected').length };
    });
    expect(state.dimmed).toBe(0);
    expect(state.selected).toBe(0);
    await expect(page.locator('#map2-focus-exit')).toBeHidden();
    await expect(page.locator('#map2-focus-toggle')).toBeHidden();
  });

  // ---- "Aislar" / Isolate mode (2026-09-09 follow-up: "is is possible to
  // make a new button called 'aislar', to hide all that is not being
  // selected and related with what is selected?? I [s]hould be able to
  // select multiple boxes and retain those and their relations"). A second,
  // independent mode alongside Focus above, sharing the exact same
  // selection/multi-select input and neighbourhood computation
  // (`selectionNeighborhood()`), but HARD-hiding (`display:none`, via
  // `.isolated-hidden`) everything outside that set instead of dimming it.
  // The two modes are mutually exclusive and share the same
  // `#map2-focus-exit` ("← Full map") exit button — see
  // `enterFocus`/`enterIsolate` in MapExplorerV2.astro for the full
  // rationale. ----
  test('selecting a card reveals an Aislar button; clicking it hard-hides everything outside the selection + its neighbours', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    const isolateToggle = page.locator('#map2-isolate-toggle');
    await expect(isolateToggle).toBeHidden(); // nothing selected yet
    await page.evaluate(() => (window as any).__cyMap2.$id('doi').emit('tap'));
    await expect(isolateToggle).toBeVisible();
    await isolateToggle.click();
    const result = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      return {
        doiHidden: cy.$id('doi').hasClass('isolated-hidden'),
        doiDisplay: cy.$id('doi').style('display'),
        // 'handle-system' shares a real edge with 'doi' (DOI depends-on
        // Handle System) — a direct neighbour, must stay visible.
        neighbourHidden: cy.$id('handle-system').hasClass('isolated-hidden'),
        // 'clarivate' has no relation to 'doi' at all — must be hard-hidden.
        unrelatedHidden: cy.$id('clarivate').hasClass('isolated-hidden'),
        unrelatedDisplay: cy.$id('clarivate').style('display'),
      };
    });
    expect(result.doiHidden).toBe(false);
    expect(result.doiDisplay).not.toBe('none');
    expect(result.neighbourHidden).toBe(false);
    expect(result.unrelatedHidden).toBe(true);
    expect(result.unrelatedDisplay).toBe('none');
    await expect(page.locator('#map2-focus-exit')).toBeVisible();
    await expect(isolateToggle).toBeHidden();
    // Focus's own toggle stays VISIBLE while Isolate is active — a direct
    // "switch to Focus instead" affordance rather than forcing exit-then-
    // re-enter (see the mutual-exclusion test below).
    await expect(page.locator('#map2-focus-toggle')).toBeVisible();
  });

  test('multi-selecting two non-adjacent cards and isolating keeps the union of their neighbourhoods, not just the first', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await page.locator('#map2-layers-toggle').click();
    await page.locator('.map2-layer[data-layer="institutional-system"] summary').click();
    await page.locator('.map2-entity-btn[data-select-id="zenodo"]').click();
    await page.locator('.map2-entity-btn[data-select-id="dataverse"]').click({ modifiers: ['Shift'] });
    const selectedIds = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      return cy.nodes('.state-selected').map((n: any) => n.id());
    });
    expect(selectedIds.sort()).toEqual(['dataverse', 'zenodo']);
    await page.locator('#map2-isolate-toggle').click();
    const result = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      return {
        zenodoHidden: cy.$id('zenodo').hasClass('isolated-hidden'),
        dataverseHidden: cy.$id('dataverse').hasClass('isolated-hidden'),
        // oai-pmh is a shared neighbour of both zenodo and dataverse — proves
        // the kept set is the UNION of both selections' neighbourhoods, not
        // just the first card selected.
        sharedNeighbourHidden: cy.$id('oai-pmh').hasClass('isolated-hidden'),
        unrelatedHidden: cy.$id('clarivate').hasClass('isolated-hidden'),
      };
    });
    expect(result.zenodoHidden).toBe(false);
    expect(result.dataverseHidden).toBe(false);
    expect(result.sharedNeighbourHidden).toBe(false);
    expect(result.unrelatedHidden).toBe(true);
  });

  test('isolating hides any Tier/Cluster band left with zero visible cards, and keeps every band that still has one', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await page.evaluate(() => (window as any).__cyMap2.$id('doi').emit('tap'));
    await page.locator('#map2-isolate-toggle').click();
    const bandState = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      const bands = cy.nodes('.tier-band, .sub-band').map((band: any) => {
        const anyVisibleChild = band.children().some((c: any) => !c.hasClass('isolated-hidden'));
        return { id: band.id(), hidden: band.hasClass('isolated-hidden'), anyVisibleChild };
      });
      return bands;
    });
    // Invariant that must hold for EVERY band regardless of curated-content
    // changes: a band is isolated-hidden if and only if none of its children
    // (Cards, or nested Cluster sub-bands) are currently visible.
    for (const band of bandState) {
      expect(band.hidden).toBe(!band.anyVisibleChild);
    }
    // Selecting a single, narrowly-connected card out of ~33 curated
    // entities must leave at least one band empty (its Cards are all
    // outside the 1-hop neighbourhood) — otherwise this test would trivially
    // pass without ever exercising the empty-band-hiding code path at all.
    expect(bandState.some((b: { hidden: boolean }) => b.hidden)).toBe(true);
    // ...and at least one band (the one containing 'doi' itself) must stay
    // visible.
    expect(bandState.some((b: { hidden: boolean }) => !b.hidden)).toBe(true);
  });

  test('the shared "Show all" exit button restores every card and band after isolating', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await page.evaluate(() => (window as any).__cyMap2.$id('doi').emit('tap'));
    await page.locator('#map2-isolate-toggle').click();
    const hiddenBeforeExit = await page.evaluate(() => (window as any).__cyMap2.elements('.isolated-hidden').length);
    expect(hiddenBeforeExit).toBeGreaterThan(0);
    await page.locator('#map2-focus-exit').click();
    const state = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      return {
        hiddenCount: cy.elements('.isolated-hidden').length,
        allDisplayed: cy.elements().every((e: any) => e.style('display') !== 'none'),
      };
    });
    expect(state.hiddenCount).toBe(0);
    expect(state.allDisplayed).toBe(true);
    await expect(page.locator('#map2-focus-exit')).toBeHidden();
  });

  test('pressing Escape exits an active isolate session', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await page.evaluate(() => (window as any).__cyMap2.$id('doi').emit('tap'));
    await page.locator('#map2-isolate-toggle').click();
    await expect(page.locator('#map2-focus-exit')).toBeVisible();
    await page.keyboard.press('Escape');
    const hiddenCount = await page.evaluate(() => (window as any).__cyMap2.elements('.isolated-hidden').length);
    expect(hiddenCount).toBe(0);
    await expect(page.locator('#map2-focus-exit')).toBeHidden();
  });

  test('clicking the empty canvas background while isolated clears the selection and exits isolate', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await page.evaluate(() => (window as any).__cyMap2.$id('doi').emit('tap'));
    await page.locator('#map2-isolate-toggle').click();
    await expect(page.locator('#map2-focus-exit')).toBeVisible();
    await page.evaluate(() => (window as any).__cyMap2.emit('tap'));
    const state = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      return { hidden: cy.elements('.isolated-hidden').length, selected: cy.nodes('.state-selected').length };
    });
    expect(state.hidden).toBe(0);
    expect(state.selected).toBe(0);
    await expect(page.locator('#map2-focus-exit')).toBeHidden();
    await expect(page.locator('#map2-isolate-toggle')).toBeHidden();
  });

  test('entering Focus while Isolate is active exits Isolate (mutually exclusive modes), and vice versa', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await page.evaluate(() => (window as any).__cyMap2.$id('doi').emit('tap'));
    // Enter Isolate first.
    await page.locator('#map2-isolate-toggle').click();
    let state = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      return { hidden: cy.elements('.isolated-hidden').length, dimmed: cy.elements('.focus-dimmed').length };
    });
    expect(state.hidden).toBeGreaterThan(0);
    expect(state.dimmed).toBe(0);
    // Focus's own toggle stays visible as a direct "switch instead"
    // affordance while Isolate is active (see the button-visibility test
    // above) — click it straight through, without exiting Isolate first.
    await page.locator('#map2-focus-toggle').click();
    state = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      return { hidden: cy.elements('.isolated-hidden').length, dimmed: cy.elements('.focus-dimmed').length };
    });
    // Switching to Focus must have cleared every stray `.isolated-hidden`
    // left over from Isolate — no element should ever carry both classes.
    expect(state.hidden).toBe(0);
    expect(state.dimmed).toBeGreaterThan(0);
    // And switching back to Isolate (Isolate's own toggle is symmetrically
    // visible again now that Focus, not Isolate, is the active mode) must
    // clear Focus's dimming in turn.
    await page.locator('#map2-isolate-toggle').click();
    state = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      return { hidden: cy.elements('.isolated-hidden').length, dimmed: cy.elements('.focus-dimmed').length };
    });
    expect(state.hidden).toBeGreaterThan(0);
    expect(state.dimmed).toBe(0);
  });

  // ---- Real-canvas multi-select (2026-09-09 follow-up bug report: user,
  // verbatim, "i cannot select more than 1 box"). EVERY multi-select test
  // above (e.g. "a multi-selection highlights a shared neighbour...",
  // "multi-selecting two cards and entering focus...") drives the Layers-
  // panel `<button class="map2-entity-btn">` list via `.click({modifiers})`
  // — real DOM buttons, not the actual rendered canvas Cards a user
  // visually clicks on. Root-caused directly from Cytoscape's own
  // interaction source (node_modules/cytoscape/dist/cytoscape.cjs.js), not
  // guessed, then reproduced live (RED, before the fix in
  // MapExplorerV2.astro's `cy = cytoscape({...})` constructor) with exactly
  // this test's own gesture: Cytoscape's default `boxSelectionEnabled: true`
  // + its default 4px `desktopTapThreshold` means a mousedown-on-a-node ->
  // (a few px of real mouse/trackpad jitter) -> mouseup gesture, WITH a
  // multi-select modifier held, gets reinterpreted mid-gesture as an
  // additive BOX-SELECTION drag instead of firing 'tap' on the node — so
  // this file's own `cy.on('tap', 'node', ...)` handler (which reads
  // `evt.originalEvent.shiftKey/metaKey/ctrlKey`) never runs at all. Worse:
  // the empty box-selection this opens typically ends over background,
  // which ALSO fires a plain 'tap' on the core (`evt.target === cy`) — this
  // file's own "click empty canvas to deselect" handler then wipes the
  // selection entirely, so the observed bug wasn't just "the 2nd card
  // doesn't get added", it was "the whole selection gets cleared". Fixed by
  // `boxSelectionEnabled: false` (this app's ENTIRE selection model is its
  // own `selected` Set driven by 'tap' events — Cytoscape's native
  // box-select/`.selected()` API is never used anywhere in this file) plus
  // raising `desktopTapThreshold` to 12 (absorbs realistic jitter without
  // weakening the existing "a node can still be dragged" regression test's
  // 60px+ deliberate drag).
  test('a real mouse shift-click (with a few px of jitter, not a modifier-free synthetic click) on two rendered CANVAS cards multi-selects both, without losing the first', async ({
    page,
  }) => {
    await page.goto('/es/map2/');
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    // Wait for the app's OWN one-time initial ResizeObserver-driven
    // fit/zoom-floor (`resetView`, guarded by `initialFitDone` — see
    // MapExplorerV2.astro) to actually settle before this test does its OWN
    // `cy.fit()` below — the same real race the "no two rendered Tier/
    // Cluster boxes overlap" test above already waits out. Without this,
    // the app's own async re-fit can land AFTER this test reads its click
    // coordinates but BEFORE it actually clicks, silently invalidating them
    // (reproduced: an intermittent flake where even the FIRST, no-modifier
    // click selected nothing at all — nothing to do with shift-click).
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2.zoom())).toBeGreaterThanOrEqual(0.4);

    const canvasBox = await page.locator('#map2-canvas').boundingBox();
    if (!canvasBox) throw new Error('canvas not found');

    // Bring both real, curated, connected nodes fully into view and read
    // their REAL rendered (screen) coordinates — this test drives the mouse
    // at real pixel positions on the `<canvas>`, not a DOM button or a
    // synthetic Cytoscape event.
    const coords = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      cy.fit(cy.nodes(':childless'), 60);
      return { a: cy.$id('zenodo').renderedPosition(), b: cy.$id('dataverse').renderedPosition() };
    });

    async function realCanvasClick(x: number, y: number, opts: { shift?: boolean; jitterPx?: number } = {}): Promise<void> {
      if (opts.shift) await page.keyboard.down('Shift');
      await page.mouse.move(x, y);
      await page.mouse.down();
      const j = opts.jitterPx ?? 0;
      if (j > 0) {
        // A few pixels of movement between mousedown and mouseup — the
        // jitter any real mouse/trackpad click has, and the exact gesture a
        // frictionless `page.mouse.click()` (0 movement) or `.click()`
        // locator helper (also 0 movement) never exercises, which is why
        // every earlier canvas-tap test here passed despite the real bug.
        await page.mouse.move(x + j, y + j, { steps: 3 });
      }
      await page.mouse.up();
      if (opts.shift) await page.keyboard.up('Shift');
    }

    await realCanvasClick(canvasBox.x + coords.a.x, canvasBox.y + coords.a.y, { jitterPx: 3 });
    const afterFirst = await page.evaluate(() => (window as any).__cyMap2.nodes('.state-selected').map((n: any) => n.id()));
    expect(afterFirst).toEqual(['zenodo']);

    await realCanvasClick(canvasBox.x + coords.b.x, canvasBox.y + coords.b.y, { shift: true, jitterPx: 6 });
    const afterSecond = await page.evaluate(() => (window as any).__cyMap2.nodes('.state-selected').map((n: any) => n.id()).sort());
    // Both cards selected — the first (zenodo) must NOT have been dropped by
    // the second click (the observed "wipes the whole selection" failure
    // mode), and the second (dataverse) must actually have been ADDED (the
    // literal "cannot select more than 1 box" failure mode).
    expect(afterSecond).toEqual(['dataverse', 'zenodo']);
  });

  // ---- Isolate re-layout (2026-09-09 follow-up: "'aislar' works
  // perfectly, but I would like to re-arrange also, so I can reduce long
  // distances"). `applyIsolate` used to hide out-of-scope elements but leave
  // the KEPT ones at their original hierarchy.ts-computed absolute
  // positions, so two kept Cards that started in different Tiers still read
  // as far apart on screen. `runIsolateLayout` (MapExplorerV2.astro) now
  // re-runs `fcose`, restricted to the currently-visible elements, on every
  // `applyIsolate` call. ----
  test('isolating pulls two kept-but-originally-far-apart cards (different Tiers) closer together', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);

    // DataCite (T2) and DOI (T1) are in different Tiers (see the "hierarchical
    // layout places DataCite above DOI" test above) — a real, direct edge
    // connects them, so selecting DOI's 1-hop neighbourhood keeps both.
    const before = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      const doi = cy.$id('doi').position();
      const datacite = cy.$id('datacite').position();
      return Math.hypot(doi.x - datacite.x, doi.y - datacite.y);
    });

    await page.evaluate(() => (window as any).__cyMap2.$id('doi').emit('tap'));
    await page.locator('#map2-isolate-toggle').click();
    // fcose's own `animationDuration: 300` — give it real time to settle
    // before measuring.
    await page.waitForTimeout(600);

    const after = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      const doi = cy.$id('doi').position();
      const datacite = cy.$id('datacite').position();
      return Math.hypot(doi.x - datacite.x, doi.y - datacite.y);
    });

    expect(after).toBeLessThan(before * 0.8); // a real, visible tightening, not a rounding-error difference
  });

  // Follow-up bug report (2026-09-09, same day): "'Aislar' should be more
  // agresive, compact more, less space between cards (half the space it
  // leaves now)" — the test above only checks a RELATIVE (model-space)
  // shrink, which stayed true even before this round's retune. This pins
  // the actual REAL, RENDERED (screen-pixel) distance between the same
  // DOI/DataCite pair post-relayout, so a future change that drifts back
  // toward the old, looser spacing gets caught even if it still happens to
  // pass the relative check above. Empirically measured via a standalone
  // Playwright harness driving this exact flow against a built preview
  // (not guessed): the shipped-before-this-round options (`nodeRepulsion:
  // 8000, idealEdgeLength: 120`) measured ~184px for this pair; a real
  // bisection sweep over `nodeRepulsion`/`idealEdgeLength` (see
  // `runIsolateLayout`'s own comment in MapExplorerV2.astro) found a stable
  // low-distance plateau at ~129-130px (zero Card/Card or Card/band overlap
  // anywhere in the swept range) — the tightest this specific cross-Tier
  // pair gets without overlapping, given their real classbox footprint. The
  // band below is centered on that measurement with real headroom for
  // fonts/rendering variance across machines/CI, while still catching a
  // reversion back toward the old ~184px spacing.
  test('isolating renders the DOI/DataCite pair at a real, tightened on-screen pixel distance, with zero overlaps', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2.zoom())).toBeGreaterThanOrEqual(0.4);

    await page.evaluate(() => (window as any).__cyMap2.$id('doi').emit('tap'));
    await page.locator('#map2-isolate-toggle').click();
    await page.waitForTimeout(600);

    const result = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      const a = cy.$id('doi').renderedPosition();
      const b = cy.$id('datacite').renderedPosition();
      const pixelDistance = Math.hypot(a.x - b.x, a.y - b.y);

      const visible = cy.elements().not('.isolated-hidden');
      const nodes = visible.nodes(':childless').toArray();
      const cardOverlaps: string[] = [];
      for (let i = 0; i < nodes.length; i++) {
        const na = nodes[i].renderedBoundingBox();
        for (let j = i + 1; j < nodes.length; j++) {
          const nb = nodes[j].renderedBoundingBox();
          if (na.x1 < nb.x2 && nb.x1 < na.x2 && na.y1 < nb.y2 && nb.y1 < na.y2) {
            cardOverlaps.push(`${nodes[i].id()} <-> ${nodes[j].id()}`);
          }
        }
      }
      const spills: string[] = [];
      for (const n of nodes) {
        const parent = n.parent();
        if (parent.empty() || parent.hasClass('isolated-hidden')) continue;
        const bb = parent.renderedBoundingBox();
        const nb = n.renderedBoundingBox();
        if (nb.x1 < bb.x1 - 1 || nb.x2 > bb.x2 + 1 || nb.y1 < bb.y1 - 1 || nb.y2 > bb.y2 + 1) {
          spills.push(`${n.id()} outside ${parent.data('label')}`);
        }
      }
      return { pixelDistance, cardOverlaps, spills };
    });

    // Real, tightened spacing — well below the old ~184px baseline, with
    // generous headroom either side of the ~130px measured plateau for
    // cross-machine font/rendering variance.
    expect(result.pixelDistance).toBeGreaterThan(50);
    expect(result.pixelDistance).toBeLessThan(170);
    expect(result.cardOverlaps).toEqual([]);
    expect(result.spills).toEqual([]);
  });

  test('exiting isolate restores the exact original pre-isolate positions (not wherever fcose left them)', async ({ page }) => {
    await page.goto('/es/map2/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);

    const before = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      return { doi: cy.$id('doi').position(), datacite: cy.$id('datacite').position(), zenodo: cy.$id('zenodo').position() };
    });

    await page.evaluate(() => (window as any).__cyMap2.$id('doi').emit('tap'));
    await page.locator('#map2-isolate-toggle').click();
    await page.waitForTimeout(600);
    // Confirm the relayout actually moved something before exiting — a
    // no-op relayout would make this test pass trivially.
    const midway = await page.evaluate(() => (window as any).__cyMap2.$id('doi').position());
    expect(midway).not.toEqual(before.doi);

    await page.locator('#map2-focus-exit').click();
    const after = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      return { doi: cy.$id('doi').position(), datacite: cy.$id('datacite').position(), zenodo: cy.$id('zenodo').position() };
    });
    expect(after.doi).toEqual(before.doi);
    expect(after.datacite).toEqual(before.datacite);
    // `zenodo` was never part of DOI's isolated neighbourhood (hard-hidden,
    // untouched by the fcose run entirely) — must also read back exactly the
    // same, proving the restore isn't just accidentally right for the two
    // nodes fcose actually moved.
    expect(after.zenodo).toEqual(before.zenodo);
  });

  test('isolating a single card with zero curated relations does not hang or error (fcose on a near-trivial graph)', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    // `coalition-s` has zero recorded relations anywhere in the corpus (the
    // `noRelationsBadge` case) — only present on the full `/map` corpus, not
    // curated `/map2` (every /map2 entity has >=1 curated relation).
    await page.goto('/es/map/');
    await expect.poll(async () => page.evaluate(() => (window as any).__cyMap2 != null)).toBe(true);
    await page.evaluate(() => (window as any).__cyMap2.$id('coalition-s').emit('tap'));
    await page.locator('#map2-isolate-toggle').click();
    await page.waitForTimeout(600);

    const state = await page.evaluate(() => {
      const cy = (window as any).__cyMap2;
      return {
        zoom: cy.zoom(),
        coalitionHidden: cy.$id('coalition-s').hasClass('isolated-hidden'),
      };
    });
    expect(state.coalitionHidden).toBe(false); // the selected card itself always stays visible
    expect(Number.isFinite(state.zoom)).toBe(true); // fcose/fit didn't leave the camera in a broken state
    expect(pageErrors).toEqual([]);

    // Exiting must still work cleanly (position restore on a 1-node isolate
    // session, not just the multi-node case above).
    await page.locator('#map2-focus-exit').click();
    expect(pageErrors).toEqual([]);
  });
});

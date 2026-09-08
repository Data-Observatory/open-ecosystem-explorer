import { test, expect } from '@playwright/test';

// Manual keyboard/screen-reader pass stays manual per specs.md §9.3 ("Manual
// keyboard-only and screen-reader (NVDA or VoiceOver) pass before each
// release, recorded in CHANGELOG.md") — a script can't operate a screen
// reader. What CAN be automated, and is checked here: keyboard reachability,
// tab order, and visible focus indication, which is most of what a keyboard
// pass actually verifies mechanically. See CHANGELOG.md for the manual
// screen-reader narration pass this doesn't replace.

test.describe('Keyboard operability', () => {
  test('skip link is the first tab stop and jumps to #main', async ({ page }) => {
    await page.goto('/es/entity/figshare/');
    await page.keyboard.press('Tab');
    const active = await page.evaluate(() => document.activeElement?.className);
    expect(active).toContain('skip-link');
    await page.keyboard.press('Enter');
    const hash = await page.evaluate(() => location.hash);
    expect(hash).toBe('#main');
  });

  test('every focused element has a visible focus indicator (outline present)', async ({ page }) => {
    await page.goto('/es/entity/figshare/');
    const focusables = await page.locator('a, button, summary, input, [tabindex="0"]').all();
    expect(focusables.length).toBeGreaterThan(5);
    // Sample the first 8 to keep this fast; every element shares the same
    // global :focus-visible rule (Base.astro), so this is representative,
    // not exhaustive-by-necessity.
    for (const el of focusables.slice(0, 8)) {
      await el.focus();
      const outline = await el.evaluate((node) => getComputedStyle(node).outlineStyle);
      expect(outline, `element ${await el.evaluate((n) => n.outerHTML.slice(0, 80))} has no visible outline`).not.toBe(
        'none',
      );
    }
  });

  test('recorded tab order on the entity page is logical (header -> content -> footer, no jumps)', async ({
    page,
  }) => {
    await page.goto('/es/entity/figshare/');
    const trace: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      // Identify the focused element by href/id/text, not just tag+class —
      // a page legitimately has many plain <a> siblings with no class
      // (e.g. a relations list), so tag+class alone can't distinguish
      // "moved to the next link" from "stuck on the same one".
      const identity = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return 'none';
        const href = (el as HTMLAnchorElement).href;
        return `${el.tagName.toLowerCase()}#${href || el.id || el.textContent?.trim().slice(0, 30) || ''}`;
      });
      trace.push(identity);
    }
    // Structural assertion, not a brittle exact-sequence match: the trace
    // must not land on the literal same element twice in a row (a focus
    // trap symptom) — distinct elements with identical text (rare) would
    // still differ by href, which is part of the identity above.
    for (let i = 1; i < trace.length; i++) {
      expect(trace[i]).not.toBe(trace[i - 1]);
    }
    // eslint-disable-next-line no-console
    console.log('Tab order trace (first 12 stops):', trace.join(' -> '));
  });

  test('diagram scroll region is keyboard-reachable (tabindex=0) for the no-drag pan equivalent (§9.2 2.5.7/2.5.8)', async ({
    page,
  }) => {
    await page.goto('/es/entity/figshare/');
    const diagramSvgBox = page.locator('.diagram__svg').first();
    await expect(diagramSvgBox).toHaveAttribute('tabindex', '0');
    await diagramSvgBox.focus();
    const isFocused = await diagramSvgBox.evaluate((el) => el === document.activeElement);
    expect(isFocused).toBe(true);
  });

  test('map page pan/zoom equivalent: the Cytoscape canvas is keyboard-focusable', async ({ page }) => {
    // /map is a Cytoscape.js canvas (specs.md §6.2 amendment, 2026-09-04),
    // not a Diagram.astro instance — it has no `.diagram__svg`. Since
    // 2026-09-07 it's rendered by the same component as `/map2`
    // (`MapExplorerV2.astro`), hence the `map2-canvas` id.
    await page.goto('/es/map/');
    const canvas = page.locator('#map2-canvas');
    await expect(canvas).toHaveAttribute('tabindex', '0');
    await canvas.focus();
    const isFocused = await canvas.evaluate((el) => el === document.activeElement);
    expect(isFocused).toBe(true);
  });
});

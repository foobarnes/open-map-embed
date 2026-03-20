import { test, expect } from '@playwright/test';

/**
 * Performance regression tests.
 *
 * Runs against the Vite dev server with the full widget initialization.
 * Thresholds are generous — the goal is catching regressions, not enforcing
 * aspirational targets. Tighten as you improve.
 */

const LCP_BUDGET_MS = 5_000;
const TILES_VISIBLE_BUDGET_MS = 4_000;

test.describe('Performance', () => {
  test('LCP is under budget', async ({ page }) => {
    await page.goto('/');

    // Use buffered: true to pick up LCP entries that already fired
    const lcp = await page.evaluate(() =>
      new Promise<number>((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            observer.disconnect();
            resolve(entries[entries.length - 1].startTime);
          }
        });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });

        // Fallback if LCP never fires
        setTimeout(() => {
          observer.disconnect();
          resolve(-1);
        }, 15_000);
      })
    );

    console.log(`  LCP: ${Math.round(lcp)}ms (budget: ${LCP_BUDGET_MS}ms)`);
    expect(lcp).toBeGreaterThan(0);
    expect(lcp, `LCP ${Math.round(lcp)}ms exceeds budget`).toBeLessThan(LCP_BUDGET_MS);
  });

  test('map tiles visible quickly', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');

    // Wait for at least one tile image to be loaded and visible
    await page.waitForSelector('img.leaflet-tile', { state: 'visible', timeout: TILES_VISIBLE_BUDGET_MS });
    const elapsed = Date.now() - start;

    console.log(`  Tiles visible: ${elapsed}ms (budget: ${TILES_VISIBLE_BUDGET_MS}ms)`);
    expect(elapsed, `Tiles took ${elapsed}ms, budget is ${TILES_VISIBLE_BUDGET_MS}ms`).toBeLessThan(TILES_VISIBLE_BUDGET_MS);
  });

  test('markers render after data loads', async ({ page }) => {
    await page.goto('/');

    // Markers should appear within a reasonable window (data fetch + render)
    // Using a generous 15s since this depends on external Google Sheets fetch
    const marker = page.locator('.leaflet-marker-icon, .custom-cluster-icon').first();
    await expect(marker).toBeVisible({ timeout: 15_000 });
  });

  test('no layout shift from loading to loaded state', async ({ page }) => {
    await page.goto('/');

    const cls = await page.evaluate(() =>
      new Promise<number>((resolve) => {
        let cls = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              cls += (entry as any).value;
            }
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });

        // Settle after 10s
        setTimeout(() => {
          observer.disconnect();
          resolve(cls);
        }, 10_000);
      })
    );

    console.log(`  CLS: ${cls.toFixed(4)} (budget: 0.25)`);
    expect(cls, `CLS ${cls.toFixed(4)} exceeds 0.25`).toBeLessThan(0.25);
  });
});

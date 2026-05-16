import { expect, test } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 },
];

test.describe("responsive layout", () => {
  for (const viewport of viewports) {
    test(`core dashboard zones stay visible at ${viewport.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/?target=mock", { waitUntil: "networkidle" });

      await expect(page.getByTestId("dashboard-root")).toBeVisible();
      await expect(page.getByTestId("metrics-header")).toBeVisible();
      await expect(page.getByTestId("city-panel")).toBeVisible();
      await expect(page.getByTestId("city-scene")).toBeVisible();
      await expect(page.getByTestId("timeline-panel")).toBeVisible();

      if (viewport.name !== "mobile") {
        await expect(page.getByTestId("ribbon-tab-analysis")).toBeVisible();
        await page.getByTestId("ribbon-tab-analysis").click();
        await expect(page.getByTestId("filter-panel")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByTestId("detail-drawer")).toBeVisible();
      }

      const horizontalOverflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth - root.clientWidth;
      });

      // Allow tiny sub-pixel rounding differences.
      expect(horizontalOverflow).toBeLessThanOrEqual(2);

      await page.screenshot({
        path: testInfo.outputPath(`responsive-${viewport.name}.png`),
        fullPage: true,
      });
    });
  }
});

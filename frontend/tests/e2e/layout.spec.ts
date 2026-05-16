import { expect, Locator, test } from "@playwright/test";

const ignoredConsolePatterns = [
  /favicon\.ico/i,
  /Download the React DevTools/i,
  /WebGL/i,
];

function isIgnoredConsoleMessage(message: string): boolean {
  return ignoredConsolePatterns.some((pattern) => pattern.test(message));
}

async function safeClick(locator: Locator) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await locator.click({ timeout: 10_000 });
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await locator.waitFor({ state: "visible", timeout: 10_000 });
    }
  }
}

test("dashboard renders core zones and replay route is reachable", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (!isIgnoredConsoleMessage(text)) {
      consoleErrors.push(text);
    }
  });

  page.on("pageerror", (err) => {
    const text = err.message;
    if (!isIgnoredConsoleMessage(text)) {
      pageErrors.push(text);
    }
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?target=mock", { waitUntil: "networkidle" });

  await expect(page.getByTestId("dashboard-root")).toBeVisible();
  await expect(page.getByTestId("metrics-header")).toBeVisible();
  await expect(page.getByTestId("city-scene")).toBeVisible();
  await expect(page.getByTestId("detail-drawer")).toBeVisible();
  await expect(page.getByTestId("timeline-panel")).toBeVisible();

  await page.getByTestId("ribbon-tab-analysis").click();
  await expect(page.getByTestId("filter-panel")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByTestId("command-palette-toggle").click();
  await expect(page.getByTestId("command-palette-input")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByTestId("timeline-panel").getByRole("button", { name: /open|打开/i }).click();
  await page.getByTestId("timeline-group-trace").click();
  await expect(page.getByTestId("timeline-trace-groups")).toBeVisible();
  await page.getByTestId("timeline-group-time").click();
  await expect(page.getByTestId("timeline-time-groups")).toBeVisible();

  await page.getByTestId("header-add-repository").click();
  await expect(page.getByTestId("import-wizard")).toBeVisible();
  await page.getByTestId("import-wizard-close").click();

  await page.getByTestId("view-menu-toggle").click();
  await safeClick(page.getByTestId("view-mode-diagnostics"));
  await expect(page.getByTestId("diagnostics-center")).toBeVisible();

  await page.getByTestId("view-menu-toggle").click();
  await safeClick(page.getByTestId("view-mode-parser_analysis"));
  await expect(page.getByTestId("parser-analysis-center")).toBeVisible();

  await page.getByTestId("view-menu-toggle").click();
  await safeClick(page.getByTestId("view-mode-reports"));
  await expect(page.getByTestId("reports-center")).toBeVisible();

  await page.getByTestId("view-menu-toggle").click();
  await safeClick(page.getByTestId("view-mode-overview"));
  await expect(page.getByTestId("city-scene")).toBeVisible();

  const replayLink = page.getByTestId("open-replay-link");
  await expect(replayLink).toBeVisible();
  await replayLink.click();

  await expect(page.getByTestId("replay-root")).toBeVisible();
  await expect(page.getByTestId("replay-controller")).toBeVisible();
  await expect(page.getByTestId("replay-city-panel")).toBeVisible();
  await expect(page.getByTestId("replay-span-list")).toBeVisible();

  expect.soft(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  expect.soft(pageErrors, pageErrors.join("\n")).toEqual([]);
});

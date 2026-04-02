import { expect, test } from "@playwright/test";

const ignoredConsolePatterns = [
  /favicon\.ico/i,
  /Download the React DevTools/i,
  /WebGL/i,
];

function isIgnoredConsoleMessage(message: string): boolean {
  return ignoredConsolePatterns.some((pattern) => pattern.test(message));
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
  await expect(page.getByTestId("parse-progress-banner")).toBeVisible();
  await expect(page.getByTestId("filter-panel")).toBeVisible();
  await expect(page.getByTestId("city-scene")).toBeVisible();
  await expect(page.getByTestId("detail-drawer")).toBeVisible();
  await expect(page.getByTestId("timeline-panel")).toBeVisible();

  await page.getByRole("button", { name: /command palette/i }).click();
  await expect(page.getByPlaceholder(/type a command or shortcut/i)).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /^trace$/i }).click();
  await expect(page.getByText(/spans/i).first()).toBeVisible();
  await page.getByRole("button", { name: /^time$/i }).click();

  await page.getByRole("button", { name: /add local repository/i }).click();
  await expect(page.getByText(/Import Local Agent Repository/i)).toBeVisible();
  await page.getByRole("button", { name: /^close$/i }).click();

  await page.getByTestId("filter-panel").getByRole("button", { name: /^diagnostics$/i }).click();
  await expect(page.getByTestId("diagnostics-center")).toBeVisible();

  await page.getByTestId("filter-panel").getByRole("button", { name: /^parser analysis$/i }).click();
  await expect(page.getByTestId("parser-analysis-center")).toBeVisible();

  await page.getByTestId("filter-panel").getByRole("button", { name: /^reports$/i }).click();
  await expect(page.getByTestId("reports-center")).toBeVisible();

  await page.getByTestId("filter-panel").getByRole("button", { name: /^overview$/i }).click();
  await expect(page.getByTestId("city-scene")).toBeVisible();

  const replayLink = page.getByRole("link", { name: /open replay/i });
  await expect(replayLink).toBeVisible();
  await replayLink.click();

  await expect(page.getByTestId("replay-root")).toBeVisible();
  await expect(page.getByTestId("replay-controller")).toBeVisible();
  await expect(page.getByTestId("replay-city-panel")).toBeVisible();
  await expect(page.getByTestId("replay-span-list")).toBeVisible();

  expect.soft(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  expect.soft(pageErrors, pageErrors.join("\n")).toEqual([]);
});

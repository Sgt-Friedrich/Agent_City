import { expect, test } from "@playwright/test";

const ignoredConsolePatterns = [/favicon\.ico/i, /WebGL/i];

function isIgnoredConsoleMessage(message: string): boolean {
  return ignoredConsolePatterns.some((pattern) => pattern.test(message));
}

test("language switching to Chinese does not crash and persists in-session", async ({ page }) => {
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

  await page.goto("/?target=mock", { waitUntil: "networkidle" });

  await page.getByTestId("header-open-settings").click();
  await expect(page.getByTestId("settings-center")).toBeVisible();

  await page.getByTestId("settings-center").getByRole("button", { name: /中文/i }).click();
  await expect(page.getByText(/Agent_City 桌面工作台/i)).toBeVisible();

  await page.getByRole("button", { name: /保存设置|save settings/i }).click();
  await expect(page.getByText(/设置已保存|Settings saved/i)).toBeVisible();

  await page.getByTestId("header-open-settings").click();
  await expect(page.getByTestId("city-scene")).toBeVisible();

  expect.soft(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  expect.soft(pageErrors, pageErrors.join("\n")).toEqual([]);
});

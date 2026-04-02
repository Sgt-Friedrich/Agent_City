/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
const { chromium } = require("playwright");

const ROOT_DIR = path.resolve(__dirname, "../..");
const BACKEND_DIR = path.resolve(__dirname, "../../backend");
const STATIC_DIR = path.resolve(__dirname, "../out");
const SCREENSHOT_DIR = path.resolve(__dirname, "../../docs/screenshots");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitFor(url, timeoutMs = 120000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const loop = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          res.resume();
          resolve();
          return;
        }
        res.resume();
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`timeout waiting for ${url}`));
          return;
        }
        setTimeout(loop, 600);
      });
      req.on("error", () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`timeout waiting for ${url}`));
          return;
        }
        setTimeout(loop, 600);
      });
    };
    loop();
  });
}

async function isHealthy(url) {
  try {
    const response = await fetch(url);
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

function spawnServer(command, args, cwd, name) {
  const child = spawn(command, args, {
    cwd,
    stdio: "pipe",
    shell: false,
    env: process.env,
  });
  child.stdout.on("data", (buf) => process.stdout.write(`[${name}] ${buf}`));
  child.stderr.on("data", (buf) => process.stderr.write(`[${name}] ${buf}`));
  return child;
}

async function setBackendLanguageToEn() {
  try {
    await fetch("http://127.0.0.1:8000/api/control/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "en" }),
    });
  } catch (error) {
    console.warn(`[screenshots] set language warning: ${String(error)}`);
  }
}

async function capture() {
  if (!fs.existsSync(STATIC_DIR)) {
    throw new Error(`Missing static bundle: ${STATIC_DIR}. Run npm run frontend:build first.`);
  }
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const backendManaged = !(await isHealthy("http://127.0.0.1:8000/healthz"));
  const webManaged = !(await isHealthy("http://127.0.0.1:3000"));

  const backend = backendManaged
    ? spawnServer(
        "python",
        ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
        BACKEND_DIR,
        "backend",
      )
    : null;
  const web = webManaged ? spawnServer("python", ["-m", "http.server", "3000"], STATIC_DIR, "web") : null;

  let browser;
  try {
    await waitFor("http://127.0.0.1:8000/healthz");
    await waitFor("http://127.0.0.1:3000");
    await setBackendLanguageToEn();

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1600, height: 920 },
    });
    await context.addInitScript(() => {
      try {
        localStorage.setItem("agent_city_locale", JSON.stringify({ state: { locale: "en" }, version: 0 }));
      } catch {
        // ignore storage failures in screenshot mode
      }
    });
    const page = await context.newPage();

    await page.goto("http://127.0.0.1:3000/?target=mock", { waitUntil: "networkidle" });
    await page.getByTestId("dashboard-root").waitFor();
    await sleep(1000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "dashboard-overview-desktop.png") });

    const filterPanel = page.getByTestId("filter-panel");
    await filterPanel.getByRole("button", { name: /^diagnostics$/i }).click();
    await page.getByTestId("diagnostics-center").waitFor();
    await sleep(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "dashboard-diagnostics-desktop.png") });

    await filterPanel.getByRole("button", { name: /^parser analysis$/i }).click();
    await page.getByTestId("parser-analysis-center").waitFor();
    await sleep(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "dashboard-parser-analysis-desktop.png") });

    await filterPanel.getByRole("button", { name: /^repositories$/i }).click();
    await page.getByTestId("repositories-center").waitFor();
    await sleep(400);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "dashboard-repositories-desktop.png") });

    await filterPanel.getByRole("button", { name: /^jobs$/i }).click();
    await page.getByTestId("jobs-center").waitFor();
    await sleep(400);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "dashboard-jobs-desktop.png") });

    await filterPanel.getByRole("button", { name: /^settings$/i }).click();
    await page.getByTestId("settings-center").waitFor();
    await sleep(400);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "dashboard-settings-desktop.png") });

    await page.getByRole("button", { name: /command palette/i }).click();
    await page.getByPlaceholder(/type a command or shortcut/i).waitFor();
    await sleep(300);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "dashboard-command-palette-desktop.png") });
    await page.keyboard.press("Escape");

    await page.goto("http://127.0.0.1:3000/?target=mock", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: /open replay/i }).click();
    await page.getByTestId("replay-root").waitFor();
    await sleep(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "dashboard-replay-desktop.png") });

    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await mobileContext.addInitScript(() => {
      try {
        localStorage.setItem("agent_city_locale", JSON.stringify({ state: { locale: "en" }, version: 0 }));
      } catch {
        // ignore
      }
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto("http://127.0.0.1:3000/?target=mock", { waitUntil: "networkidle" });
    await mobilePage.getByTestId("dashboard-root").waitFor();
    await sleep(700);
    await mobilePage.screenshot({ path: path.join(SCREENSHOT_DIR, "dashboard-overview-mobile.png") });
    await mobileContext.close();

    console.log(`[screenshots] updated in ${SCREENSHOT_DIR}`);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (backendManaged && backend) backend.kill("SIGTERM");
    if (webManaged && web) web.kill("SIGTERM");
    await sleep(400);
    if (backendManaged && backend) backend.kill("SIGKILL");
    if (webManaged && web) web.kill("SIGKILL");
  }
}

capture().catch((error) => {
  console.error(`[screenshots] failed: ${error.message}`);
  process.exitCode = 1;
});

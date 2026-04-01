"use strict";

const fs = require("fs/promises");
const path = require("path");

const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");

const { FRONTEND_URL, DOCS_DIR } = require("./src/config");
const { ensureServices, stopServices, getServiceState } = require("./src/serviceManager");

const isDevelopment = process.env.NODE_ENV !== "production";
const smokeMode = process.env.AGENT_CITY_DESKTOP_SMOKE === "1";

let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1760,
    height: 1024,
    minWidth: 1320,
    minHeight: 820,
    show: false,
    title: "Agent_City Workbench",
    backgroundColor: "#070f1a",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  const entryUrl = `${FRONTEND_URL}/?target=mock&desktop=1`;
  mainWindow.loadURL(entryUrl).catch((error) => {
    const payload = encodeURIComponent(`<h2>Agent_City startup failed</h2><pre>${String(error)}</pre>`);
    mainWindow?.loadURL(`data:text/html,${payload}`);
  });

  if (isDevelopment) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

function registerIpc() {
  ipcMain.handle("agentCity:getAppStatus", async () => getServiceState());

  ipcMain.handle("agentCity:openPath", async (_event, targetPath) => {
    if (!targetPath || typeof targetPath !== "string") {
      return { ok: false, message: "invalid target path" };
    }
    const result = await shell.openPath(targetPath);
    return { ok: result.length === 0, message: result || "opened" };
  });

  ipcMain.handle("agentCity:openReportsDirectory", async () => {
    const result = await shell.openPath(DOCS_DIR);
    return { ok: result.length === 0, path: DOCS_DIR, message: result || "opened" };
  });

  ipcMain.handle("agentCity:saveTextReport", async (_event, payload) => {
    const defaultFileName = payload?.defaultFileName || "agent_city_report.md";
    const content = payload?.content || "";

    const save = await dialog.showSaveDialog({
      title: "Export Agent_City Report",
      defaultPath: path.join(DOCS_DIR, defaultFileName),
      filters: [
        { name: "Markdown", extensions: ["md"] },
        { name: "Text", extensions: ["txt"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (save.canceled || !save.filePath) {
      return { ok: false, canceled: true };
    }

    await fs.writeFile(save.filePath, content, "utf-8");
    return { ok: true, canceled: false, path: save.filePath };
  });
}

async function bootstrap() {
  registerIpc();

  try {
    await ensureServices({ devMode: isDevelopment });
  } catch (error) {
    console.error("[desktop] failed to ensure local services", error);
  }

  if (smokeMode) {
    const status = getServiceState();
    const healthy = Boolean(status.backend.ready) && Boolean(status.frontend.ready);
    console.log("[desktop-smoke]", JSON.stringify(status));
    setTimeout(() => {
      app.exit(healthy ? 0 : 1);
    }, 120);
    return;
  }

  createMainWindow();
}

app.on("ready", bootstrap);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (!mainWindow) {
    createMainWindow();
  }
});

app.on("before-quit", () => {
  stopServices();
});

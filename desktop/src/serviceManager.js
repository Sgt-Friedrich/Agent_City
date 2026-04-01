"use strict";

const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const {
  ROOT_DIR,
  FRONTEND_DIR,
  BACKEND_DIR,
  FRONTEND_URL,
  BACKEND_URL,
  FRONTEND_PORT,
  BACKEND_PORT,
} = require("./config");

const NPM_CMD = process.platform === "win32" ? "npm.cmd" : "npm";

const serviceState = {
  shellMode: "desktop",
  backend: {
    url: BACKEND_URL,
    ready: false,
    managed: false,
    pid: null,
    message: "not_checked",
  },
  frontend: {
    url: FRONTEND_URL,
    ready: false,
    managed: false,
    pid: null,
    message: "not_checked",
  },
  lastError: null,
  updatedAt: new Date().toISOString(),
};

const managedProcesses = {
  backend: null,
  frontend: null,
};

function updateState(patch) {
  Object.assign(serviceState, patch);
  serviceState.updatedAt = new Date().toISOString();
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function healthCheck(url, timeoutMs = 1200) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function waitForHealthy(url, timeoutMs, label) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await healthCheck(url)) {
      return true;
    }
    await sleep(650);
  }
  throw new Error(`${label} did not become healthy within ${timeoutMs}ms (${url})`);
}

function resolvePythonLauncher() {
  const envPython = process.env.AGENT_CITY_PYTHON;
  const candidates = [];

  if (envPython) {
    candidates.push({ command: envPython, prefixArgs: [] });
  }

  if (process.platform === "win32") {
    candidates.push({ command: "py", prefixArgs: ["-3"] });
    candidates.push({ command: "python", prefixArgs: [] });
  } else {
    candidates.push({ command: "python3", prefixArgs: [] });
    candidates.push({ command: "python", prefixArgs: [] });
  }

  for (const candidate of candidates) {
    const probe = spawnSync(candidate.command, [...candidate.prefixArgs, "--version"], {
      encoding: "utf-8",
      windowsHide: true,
    });
    if (probe.status === 0) {
      return candidate;
    }
  }

  return null;
}

function attachLogging(child, label) {
  if (!child) return;
  child.stdout?.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (text) {
      process.stdout.write(`[${label}] ${text}\n`);
    }
  });
  child.stderr?.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (text) {
      process.stderr.write(`[${label}] ${text}\n`);
    }
  });
}

function spawnBackendProcess() {
  const launcher = resolvePythonLauncher();
  if (!launcher) {
    throw new Error("Python launcher not found. Set AGENT_CITY_PYTHON to a valid executable.");
  }

  const args = [
    ...launcher.prefixArgs,
    "-m",
    "uvicorn",
    "app.main:app",
    "--host",
    "127.0.0.1",
    "--port",
    String(BACKEND_PORT),
  ];

  const env = {
    ...process.env,
    PYTHONPATH: [BACKEND_DIR, process.env.PYTHONPATH || ""].filter(Boolean).join(path.delimiter),
  };

  const child = spawn(launcher.command, args, {
    cwd: BACKEND_DIR,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  attachLogging(child, "backend");
  return child;
}

function spawnFrontendProcess(devMode) {
  const script = devMode ? "dev" : "start";

  if (!devMode) {
    const buildManifest = path.join(FRONTEND_DIR, ".next", "BUILD_ID");
    if (!fs.existsSync(buildManifest)) {
      throw new Error("Frontend production build missing. Run `npm --prefix frontend run build` first.");
    }
  }

  const child = spawn(
    NPM_CMD,
    ["--prefix", FRONTEND_DIR, "run", script],
    {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_BASE_URL: BACKEND_URL,
        NEXT_PUBLIC_WS_LIVE_URL: `${BACKEND_URL.replace("http", "ws")}/ws/live`,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );

  attachLogging(child, "frontend");
  return child;
}

function terminateManagedProcess(label) {
  const child = managedProcesses[label];
  if (!child || child.killed) {
    return;
  }

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/f", "/t"], {
      windowsHide: true,
      stdio: "ignore",
    });
  } else {
    child.kill("SIGTERM");
  }

  managedProcesses[label] = null;
}

async function ensureServices({ devMode }) {
  const noSpawn = process.env.AGENT_CITY_DESKTOP_NO_SPAWN === "1";

  const backendHealthUrl = `${BACKEND_URL}/healthz`;
  const frontendHealthUrl = `${FRONTEND_URL}`;

  const backendExternalReady = await healthCheck(backendHealthUrl);
  if (backendExternalReady) {
    serviceState.backend = {
      ...serviceState.backend,
      ready: true,
      managed: false,
      pid: null,
      message: "external_service_detected",
    };
  } else if (!noSpawn) {
    const backendChild = spawnBackendProcess();
    managedProcesses.backend = backendChild;
    serviceState.backend = {
      ...serviceState.backend,
      managed: true,
      pid: backendChild.pid,
      message: "starting",
    };

    await waitForHealthy(backendHealthUrl, 28000, "backend service");
    serviceState.backend = {
      ...serviceState.backend,
      ready: true,
      message: "ready",
    };
  } else {
    serviceState.backend = {
      ...serviceState.backend,
      ready: false,
      managed: false,
      pid: null,
      message: "not_available_and_spawn_disabled",
    };
  }

  const frontendExternalReady = await healthCheck(frontendHealthUrl);
  if (frontendExternalReady) {
    serviceState.frontend = {
      ...serviceState.frontend,
      ready: true,
      managed: false,
      pid: null,
      message: "external_service_detected",
    };
  } else if (!noSpawn) {
    const frontendChild = spawnFrontendProcess(devMode);
    managedProcesses.frontend = frontendChild;
    serviceState.frontend = {
      ...serviceState.frontend,
      managed: true,
      pid: frontendChild.pid,
      message: "starting",
    };

    await waitForHealthy(frontendHealthUrl, 42000, "frontend service");
    serviceState.frontend = {
      ...serviceState.frontend,
      ready: true,
      message: "ready",
    };
  } else {
    serviceState.frontend = {
      ...serviceState.frontend,
      ready: false,
      managed: false,
      pid: null,
      message: "not_available_and_spawn_disabled",
    };
  }

  updateState({ lastError: null });
  return getServiceState();
}

function getServiceState() {
  return {
    ...serviceState,
    backend: { ...serviceState.backend },
    frontend: { ...serviceState.frontend },
  };
}

function stopServices() {
  terminateManagedProcess("frontend");
  terminateManagedProcess("backend");
}

module.exports = {
  ensureServices,
  stopServices,
  getServiceState,
  FRONTEND_URL,
  DOCS_ROOT: path.join(ROOT_DIR, "docs"),
};

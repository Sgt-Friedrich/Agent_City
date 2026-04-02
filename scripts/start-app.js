#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const { spawn, spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const backendDir = path.join(rootDir, "backend");
const frontendDir = path.join(rootDir, "frontend");
const desktopDir = path.join(rootDir, "desktop");

const isWin = process.platform === "win32";
const npmCmd = isWin ? "npm.cmd" : "npm";

const mode = process.argv[2] || "dev";
const desktopMode = mode === "smoke" ? "smoke" : mode === "build" ? "build" : "dev";

function log(message) {
  process.stdout.write(`[Agent_City bootstrap] ${message}\n`);
}

function sanitizeEnv(inputEnv) {
  const env = {};
  for (const [key, value] of Object.entries(inputEnv || {})) {
    if (!key || key.includes("=") || key.includes("\0") || key.startsWith("=")) {
      continue;
    }
    env[key] = value;
  }
  return env;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || rootDir,
      env: sanitizeEnv(options.env || process.env),
      stdio: options.stdio || "inherit",
      shell: Boolean(options.shell),
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
      }
    });
  });
}

function isUrlHealthy(url, timeoutMs = 1200) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const client = parsed.protocol === "https:" ? https : http;
      const request = client.request(
        {
          method: "GET",
          hostname: parsed.hostname,
          port: parsed.port,
          path: parsed.pathname + parsed.search,
          timeout: timeoutMs,
        },
        (response) => {
          response.resume();
          resolve(response.statusCode >= 200 && response.statusCode < 500);
        },
      );

      request.on("timeout", () => {
        request.destroy();
        resolve(false);
      });
      request.on("error", () => resolve(false));
      request.end();
    } catch {
      resolve(false);
    }
  });
}

async function waitForHealthy(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    if (await isUrlHealthy(url, 1200)) {
      return true;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function canRun(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    env: sanitizeEnv(process.env),
    stdio: "ignore",
    shell: false,
  });
  return result.status === 0;
}

function hasNodeModules(projectDir) {
  return fs.existsSync(path.join(projectDir, "node_modules"));
}

async function ensureNodeDependencies(projectName, projectDir) {
  const needsInstall = !hasNodeModules(projectDir);
  if (!needsInstall) {
    log(`${projectName} dependencies already present.`);
    return;
  }

  log(`installing ${projectName} dependencies...`);
  await run(npmCmd, ["--prefix", projectDir, "install", "--no-fund"], {
    cwd: rootDir,
  });
}

function frontendBundleEntry() {
  return path.join(frontendDir, "out", "index.html");
}

function latestSourceMtimeMs(directory, ignored = new Set()) {
  if (!fs.existsSync(directory)) {
    return 0;
  }

  let latest = 0;
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (ignored.has(entry.name)) {
      continue;
    }
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      latest = Math.max(latest, latestSourceMtimeMs(absolute, ignored));
    } else if (entry.isFile()) {
      const stat = fs.statSync(absolute);
      latest = Math.max(latest, stat.mtimeMs);
    }
  }

  return latest;
}

function shouldRebuildFrontendBundle() {
  const bundleEntry = frontendBundleEntry();
  if (!fs.existsSync(bundleEntry)) {
    return true;
  }

  const bundleMtime = fs.statSync(bundleEntry).mtimeMs;
  const ignored = new Set([
    ".next",
    "node_modules",
    "out",
    "playwright-report",
    "test-results",
  ]);
  const sourceMtime = latestSourceMtimeMs(frontendDir, ignored);
  return sourceMtime > bundleMtime;
}

async function ensureFrontendBundle() {
  if (!shouldRebuildFrontendBundle()) {
    log("frontend static bundle already present.");
    return;
  }

  log("building frontend static bundle...");
  const backendUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.AGENT_CITY_BACKEND_URL ||
    "http://127.0.0.1:8000";
  const wsUrl =
    process.env.NEXT_PUBLIC_WS_LIVE_URL ||
    backendUrl.replace("http://", "ws://").replace("https://", "wss://") + "/ws/live";

  await run(npmCmd, ["--prefix", frontendDir, "run", "build"], {
    cwd: rootDir,
    env: {
      ...sanitizeEnv(process.env),
      NEXT_PUBLIC_API_BASE_URL: backendUrl,
      NEXT_PUBLIC_WS_LIVE_URL: wsUrl,
    },
  });
}

function resolveBasePythonLauncher() {
  const envPython = process.env.AGENT_CITY_PYTHON;
  const candidates = [];

  if (envPython) {
    candidates.push({ command: envPython, prefixArgs: [] });
  }

  if (isWin) {
    candidates.push({ command: "py", prefixArgs: ["-3"] });
    candidates.push({ command: "python", prefixArgs: [] });
  } else {
    candidates.push({ command: "python3", prefixArgs: [] });
    candidates.push({ command: "python", prefixArgs: [] });
  }

  for (const candidate of candidates) {
    if (canRun(candidate.command, [...candidate.prefixArgs, "--version"])) {
      return candidate;
    }
  }

  return null;
}

function getVenvPythonPath() {
  if (isWin) {
    return path.join(backendDir, ".venv", "Scripts", "python.exe");
  }
  return path.join(backendDir, ".venv", "bin", "python");
}

async function ensurePythonEnvironment() {
  const baseLauncher = resolveBasePythonLauncher();
  if (!baseLauncher) {
    throw new Error(
      "Python is required but not found. Install Python 3 or set AGENT_CITY_PYTHON.",
    );
  }

  const venvPython = getVenvPythonPath();
  if (!fs.existsSync(venvPython)) {
    log("creating backend virtual environment (.venv)...");
    await run(baseLauncher.command, [...baseLauncher.prefixArgs, "-m", "venv", path.join(backendDir, ".venv")], {
      cwd: rootDir,
    });
  } else {
    log("backend virtual environment already present.");
  }

  const hasBackendDeps = canRun(venvPython, ["-c", "import fastapi,uvicorn,pydantic"]);
  if (!hasBackendDeps) {
    log("installing backend Python dependencies...");
    await run(venvPython, ["-m", "pip", "install", "--disable-pip-version-check", "-r", path.join(backendDir, "requirements.txt")], {
      cwd: rootDir,
    });
  } else {
    log("backend Python dependencies already present.");
  }

  return venvPython;
}

async function ensureBackendService(venvPythonPath) {
  const backendUrl = process.env.AGENT_CITY_BACKEND_URL || "http://127.0.0.1:8000";
  const healthUrl = `${backendUrl.replace(/\/+$/, "")}/healthz`;

  if (await isUrlHealthy(healthUrl)) {
    log("backend service already healthy.");
    return;
  }

  log("starting local backend service...");
  const childEnv = {
    ...sanitizeEnv(process.env),
    PYTHONPATH: [backendDir, process.env.PYTHONPATH || ""].filter(Boolean).join(path.delimiter),
  };

  const child = spawn(
    venvPythonPath,
    [
      "-m",
      "uvicorn",
      "app.main:app",
      "--host",
      "127.0.0.1",
      "--port",
      process.env.AGENT_CITY_BACKEND_PORT || "8000",
    ],
    {
      cwd: backendDir,
      env: childEnv,
      stdio: "ignore",
      detached: true,
      shell: false,
    },
  );

  child.unref();
  const healthy = await waitForHealthy(healthUrl, 32000);
  if (!healthy) {
    throw new Error(`backend service did not become healthy at ${healthUrl}`);
  }
}

function hasCargoToolchain() {
  const cargoExeName = isWin ? "cargo.exe" : "cargo";
  const cargoInHome = process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, ".cargo", "bin", cargoExeName)
    : "";

  return canRun("cargo", ["--version"]) || (cargoInHome && fs.existsSync(cargoInHome));
}

function getRustHostTriple() {
  const result = spawnSync("rustc", ["-vV"], {
    cwd: rootDir,
    env: sanitizeEnv(process.env),
    stdio: ["ignore", "pipe", "ignore"],
    encoding: "utf8",
    shell: false,
  });

  if (result.status !== 0 || !result.stdout) {
    return null;
  }

  const match = result.stdout.match(/^host:\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function getRustSysroot() {
  const result = spawnSync("rustc", ["--print", "sysroot"], {
    cwd: rootDir,
    env: sanitizeEnv(process.env),
    stdio: ["ignore", "pipe", "ignore"],
    encoding: "utf8",
    shell: false,
  });

  if (result.status !== 0 || !result.stdout) {
    return null;
  }

  return result.stdout.trim();
}

function findRustLldPath() {
  const rustLldName = isWin ? "rust-lld.exe" : "rust-lld";
  const sysroot = getRustSysroot();
  const host = getRustHostTriple();

  if (sysroot && host) {
    const candidate = path.join(sysroot, "lib", "rustlib", host, "bin", rustLldName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const cargoBin = process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, ".cargo", "bin", rustLldName)
    : "";
  if (cargoBin && fs.existsSync(cargoBin)) {
    return cargoBin;
  }

  return null;
}

function hasMsvcLinkerInPath() {
  if (!isWin) {
    return true;
  }
  return canRun("cmd.exe", ["/d", "/s", "/c", "where link.exe"]);
}

function hasMsvcLinkerOnDisk() {
  if (!isWin) {
    return true;
  }

  const base = "C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Tools\\MSVC";
  if (!fs.existsSync(base)) {
    return false;
  }

  const versions = fs
    .readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();

  return versions.some((version) => {
    const linkPath = path.join(base, version, "bin", "Hostx64", "x64", "link.exe");
    return fs.existsSync(linkPath);
  });
}

function findMsvcLinkerBinDir() {
  if (!isWin) {
    return null;
  }

  const base = "C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Tools\\MSVC";
  if (!fs.existsSync(base)) {
    return null;
  }

  const versions = fs
    .readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();

  for (const version of versions) {
    const candidate = path.join(base, version, "bin", "Hostx64", "x64");
    const linkPath = path.join(candidate, "link.exe");
    if (fs.existsSync(linkPath)) {
      return candidate;
    }
  }

  return null;
}

function prependPath(env, directory) {
  const key = Object.keys(env).find((name) => name.toLowerCase() === "path") || "PATH";
  const currentValue = env[key] || "";
  const segments = currentValue.split(path.delimiter).filter(Boolean);
  if (!segments.includes(directory)) {
    env[key] = [directory, ...segments].join(path.delimiter);
  }

  for (const name of Object.keys(env)) {
    if (name.toLowerCase() === "path" && name !== key) {
      delete env[name];
    }
  }
}

function appendRustLinkerFlag(current) {
  const linkerFlag = "-C linker=rust-lld";
  if (!current || !current.trim()) {
    return linkerFlag;
  }
  if (current.includes("linker=rust-lld")) {
    return current;
  }
  return `${current} ${linkerFlag}`.trim();
}

function ensureDesktopPrerequisites() {
  if (!hasCargoToolchain()) {
    throw new Error(
      "Rust toolchain not detected. Install rustup first: https://rustup.rs/",
    );
  }

  if (!isWin) {
    return { type: "default" };
  }

  if (hasMsvcLinkerInPath() || hasMsvcLinkerOnDisk()) {
    return { type: "msvc" };
  }

  const rustLldPath = findRustLldPath();
  if (rustLldPath) {
    log("MSVC linker not found, using rust-lld fallback for one-click startup.");
    return { type: "rust-lld", rustLldPath };
  }

  throw new Error(
    "Neither MSVC link.exe nor rust-lld is available. Install Visual Studio Build Tools (Desktop development with C++) or repair Rust toolchain.",
  );
}

async function startDesktop(venvPythonPath, linkerStrategy) {
  const env = {
    ...sanitizeEnv(process.env),
    AGENT_CITY_PYTHON: venvPythonPath,
    AGENT_CITY_DESKTOP_NO_SPAWN: "1",
  };

  if (isWin && linkerStrategy?.type === "rust-lld") {
    env.RUSTFLAGS = appendRustLinkerFlag(env.RUSTFLAGS || "");
    env.CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER = "rust-lld";
    env.AGENT_CITY_LINKER_MODE = "rust-lld";
  }

  const tauriRunner = path.join(desktopDir, "scripts", "run-tauri.js");
  log(`starting desktop shell (mode=${desktopMode})...`);

  if (isWin && linkerStrategy?.type === "msvc" && !hasMsvcLinkerInPath()) {
    const linkerBinDir = findMsvcLinkerBinDir();
    if (linkerBinDir) {
      prependPath(env, linkerBinDir);
      log(`link.exe detected on disk; injected linker directory into PATH: ${linkerBinDir}`);
    }
  }

  await run(process.execPath, [tauriRunner, desktopMode], {
    cwd: rootDir,
    env,
  });
}

async function main() {
  log("bootstrapping one-click startup...");
  await ensureNodeDependencies("frontend", frontendDir);
  await ensureNodeDependencies("desktop", desktopDir);
  await ensureFrontendBundle();
  const venvPythonPath = await ensurePythonEnvironment();
  await ensureBackendService(venvPythonPath);
  const linkerStrategy = ensureDesktopPrerequisites();
  await startDesktop(venvPythonPath, linkerStrategy);
}

main().catch((error) => {
  process.stderr.write(`\n[Agent_City bootstrap] failed: ${error.message}\n`);
  process.stderr.write("[Agent_City bootstrap] hint: run npm --prefix desktop run dev after installing missing toolchain.\n");
  process.exit(1);
});

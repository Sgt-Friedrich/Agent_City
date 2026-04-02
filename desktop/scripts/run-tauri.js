#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const mode = process.argv[2] || "dev";
const desktopDir = path.resolve(__dirname, "..");

const env = {};
for (const [key, value] of Object.entries(process.env)) {
  if (!key || key.includes("=") || key.includes("\0") || key.startsWith("=")) {
    continue;
  }
  env[key] = value;
}

const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") || "PATH";
const cargoBin = process.env.USERPROFILE
  ? path.join(process.env.USERPROFILE, ".cargo", "bin")
  : "";

if (cargoBin && fs.existsSync(cargoBin)) {
  const currentPath = env[pathKey] || "";
  const segments = currentPath.split(path.delimiter).filter(Boolean);
  if (!segments.includes(cargoBin)) {
    env[pathKey] = [cargoBin, ...segments].join(path.delimiter);
  }
}

for (const key of Object.keys(env)) {
  if (key.toLowerCase() === "path" && key !== pathKey) {
    delete env[key];
  }
}

function canRun(command, args) {
  const result = spawnSync(command, args, {
    cwd: desktopDir,
    env,
    stdio: "ignore",
    shell: false,
  });
  return result.status === 0;
}

function hasMsvcLinkerInPath() {
  if (process.platform !== "win32") {
    return true;
  }
  return canRun("cmd.exe", ["/d", "/s", "/c", "where link.exe"]);
}

function findMsvcLinkerBinDir() {
  if (process.platform !== "win32") {
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
    const binDir = path.join(base, version, "bin", "Hostx64", "x64");
    if (fs.existsSync(path.join(binDir, "link.exe"))) {
      return binDir;
    }
  }

  return null;
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

function prependPath(directory) {
  const key = Object.keys(env).find((name) => name.toLowerCase() === "path") || "PATH";
  const current = env[key] || "";
  const segments = current.split(path.delimiter).filter(Boolean);
  if (!segments.includes(directory)) {
    env[key] = [directory, ...segments].join(path.delimiter);
  }

  for (const name of Object.keys(env)) {
    if (name.toLowerCase() === "path" && name !== key) {
      delete env[name];
    }
  }
}

if (process.platform === "win32" && !hasMsvcLinkerInPath()) {
  const linkerBinDir = findMsvcLinkerBinDir();
  if (linkerBinDir) {
    prependPath(linkerBinDir);
    process.stdout.write(
      `[Agent_City desktop] link.exe detected on disk; injected PATH: ${linkerBinDir}\n`,
    );
  } else {
    // Fallback for machines without BuildTools linker; keeps Tauri startup one-click.
    env.RUSTFLAGS = appendRustLinkerFlag(env.RUSTFLAGS || "");
    env.CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER = "rust-lld";
    env.AGENT_CITY_LINKER_MODE = env.AGENT_CITY_LINKER_MODE || "rust-lld";
    process.stdout.write("[Agent_City desktop] link.exe not found, using rust-lld fallback.\n");
  }
}

const commandByMode = {
  dev: ["dev", "--no-dev-server"],
  build: ["build"],
  smoke: ["dev", "--no-watch", "--no-dev-server"],
};

const tauriArgs = commandByMode[mode] || process.argv.slice(2);
if (mode === "smoke") {
  env.AGENT_CITY_DESKTOP_SMOKE = "1";
}

let child;
if (process.platform === "win32") {
  const command = `npm exec tauri -- ${tauriArgs.join(" ")}`;
  child = spawn("cmd.exe", ["/d", "/s", "/c", command], {
    cwd: desktopDir,
    env,
    stdio: "inherit",
  });
} else {
  child = spawn("npm", ["exec", "tauri", "--", ...tauriArgs], {
    cwd: desktopDir,
    env,
    stdio: "inherit",
  });
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

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

const commandByMode = {
  dev: ["dev"],
  build: ["build"],
  smoke: ["dev", "--no-watch"],
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

"use strict";

const fs = require("fs");
const path = require("path");

function assertFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }
}

const root = path.resolve(__dirname, "..", "..");
const required = [
  path.join(root, "desktop", "scripts", "run-tauri.js"),
  path.join(root, "desktop", "src-tauri", "Cargo.toml"),
  path.join(root, "desktop", "src-tauri", "src", "main.rs"),
  path.join(root, "desktop", "src-tauri", "tauri.conf.json"),
  path.join(root, "backend", "app", "main.py"),
  path.join(root, "frontend", "components", "DashboardApp.tsx"),
  path.join(root, "frontend", "lib", "desktopBridge.ts"),
];

for (const filePath of required) {
  assertFile(filePath);
}

console.log("[desktop-smoke] tauri shell files are present");

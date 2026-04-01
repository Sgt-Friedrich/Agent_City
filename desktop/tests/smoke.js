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
  path.join(root, "desktop", "main.js"),
  path.join(root, "desktop", "preload.js"),
  path.join(root, "desktop", "src", "serviceManager.js"),
  path.join(root, "backend", "app", "main.py"),
  path.join(root, "frontend", "components", "DashboardApp.tsx"),
];

for (const filePath of required) {
  assertFile(filePath);
}

console.log("[desktop-smoke] desktop shell files are present");

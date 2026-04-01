"use strict";

const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");
const BACKEND_DIR = path.join(ROOT_DIR, "backend");
const DOCS_DIR = path.join(ROOT_DIR, "docs");

const FRONTEND_PORT = Number(process.env.AGENT_CITY_FRONTEND_PORT || 3000);
const BACKEND_PORT = Number(process.env.AGENT_CITY_BACKEND_PORT || 8000);
const FRONTEND_URL = process.env.AGENT_CITY_FRONTEND_URL || `http://127.0.0.1:${FRONTEND_PORT}`;
const BACKEND_URL = process.env.AGENT_CITY_BACKEND_URL || `http://127.0.0.1:${BACKEND_PORT}`;

module.exports = {
  ROOT_DIR,
  FRONTEND_DIR,
  BACKEND_DIR,
  DOCS_DIR,
  FRONTEND_PORT,
  BACKEND_PORT,
  FRONTEND_URL,
  BACKEND_URL,
};

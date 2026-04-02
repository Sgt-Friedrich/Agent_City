# Agent_City Desktop Shell (Tauri)

This folder contains the Tauri shell for the Agent_City desktop workbench.

## Commands

```bash
npm --prefix desktop install
npm --prefix desktop run dev
```

The shell starts local services when needed:
- backend: FastAPI at `http://127.0.0.1:8000`
- frontend: Next.js workbench UI at `http://127.0.0.1:3000`

If services are already running, the shell reuses them.

## Prerequisites

- Rust toolchain (`cargo`, `rustc`) available in PATH.
- On Windows, if PATH is not refreshed yet after Rust install, `desktop/scripts/run-tauri.js` prepends `%USERPROFILE%\\.cargo\\bin` automatically.

## Environment Variables

- `AGENT_CITY_PYTHON`: explicit Python executable path.
- `AGENT_CITY_DESKTOP_NO_SPAWN=1`: disable service auto-start.
- `AGENT_CITY_FRONTEND_URL`, `AGENT_CITY_BACKEND_URL`: override local service endpoints.
- `AGENT_CITY_DESKTOP_SMOKE=1`: start in smoke mode and exit with status.

## Smoke Check

```bash
npm --prefix desktop run test:smoke
npm --prefix desktop run smoke
```

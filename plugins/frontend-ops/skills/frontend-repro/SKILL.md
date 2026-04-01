---
name: frontend-repro
description: Reproduce frontend rendering or layout issues, capture screenshots, and collect console/runtime evidence before code changes.
---

Use this skill when tasks involve layout bugs, responsive issues, overflow/clipping/overlap, canvas sizing, visual regressions, hydration breakage, or modal/drawer/tooltip display defects.

Workflow:
1. Read `AGENTS.md` and follow project commands.
2. Start backend and frontend if needed.
3. Reproduce on desktop/tablet/mobile viewports.
4. Capture screenshots, console errors, and short repro steps.
5. Summarize evidence before patching code.

Validation viewports:
- 1440x900
- 1024x768
- 390x844

Rules:
- Do not patch before reproducing.
- Prefer existing routes and scripts.
- If route is unclear, inspect router structure first.

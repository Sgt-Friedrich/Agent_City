---
name: frontend-repro
description: Reproduce an Agent_City desktop app UI issue in the main workbench window, capture evidence, and prepare deterministic debug context.
---

Use this skill when tasks mention:
- layout mismatch
- panel overlap
- replay display bug
- diagnostics visual issue
- reports view rendering issue
- 3D city sizing/interaction issue

Workflow:
1. Read `AGENTS.md` for app commands.
2. Start desktop app (`npm --prefix desktop run dev`) or browser preview fallback.
3. Reproduce in at least three window states:
   - 1440x900
   - 1024x768
   - 390x844
4. Capture:
   - screenshots
   - console/page errors
   - reproduction notes
5. Do not patch before reproduction evidence is collected.

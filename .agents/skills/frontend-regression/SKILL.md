---
name: frontend-regression
description: Run regression checks for Agent_City desktop workbench UI after fixes, covering window states and key workbench interactions.
---

Validation checklist:
1. Re-open affected workbench mode(s).
2. Verify at 1440x900 / 1024x768 / 390x844.
3. Run app UI automation tests.
4. Add or update minimal regression test when needed.
5. Summarize:
   - before vs after
   - pass/fail status
   - residual risk

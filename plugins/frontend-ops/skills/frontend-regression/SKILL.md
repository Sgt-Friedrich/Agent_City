---
name: frontend-regression
description: Re-validate frontend fixes with responsive checks and Playwright regression runs.
---

After a fix:
1. Re-open affected page.
2. Re-check desktop/tablet/mobile.
3. Run Playwright tests for affected flows.
4. Add minimal regression test when coverage is missing.
5. Verify adjacent UI has no obvious regression.
6. Summarize before/after and residual risks.

Use project script:
- `npm --prefix frontend run e2e`

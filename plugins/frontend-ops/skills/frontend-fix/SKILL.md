---
name: frontend-fix
description: Apply minimal high-confidence frontend fixes aligned with existing design system and architecture.
---

Fix rules:
- Reuse existing tokens, components, and layout primitives.
- Keep patch scope minimal and directly tied to root cause.
- Do not create parallel style systems.
- Avoid broad refactors unless required for correctness.
- Keep accessibility and responsive behavior intact.

Before coding:
- State root cause in 1-3 sentences.
- State exact files to change.

After coding:
- Re-run validation and summarize impacts.

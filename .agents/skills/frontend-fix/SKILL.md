---
name: frontend-fix
description: Apply minimal, high-confidence fixes to Agent_City desktop workbench UI issues while preserving architecture and visual semantics.
---

Rules:
- Reuse current tokens/components/layout primitives.
- Keep patch scope minimal and well-justified.
- Do not introduce parallel styling systems.
- Preserve mode-switch consistency across overview/live/diagnostics/parser/reports/replay.

Before patching:
1. State root cause in 1-3 sentences.
2. List files to change.

After patching:
1. Re-run validation flow.
2. Document behavior before/after.

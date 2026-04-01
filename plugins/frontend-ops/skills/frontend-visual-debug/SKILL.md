---
name: frontend-visual-debug
description: Diagnose frontend display defects from browser evidence and map to concrete root causes with confidence.
---

Use after reproduction evidence is available.

Check:
- CSS layout: flex/grid sizing, overflow, min-width/min-height.
- Responsive: breakpoint behavior and panel wrapping.
- z-index/portal/stacking context.
- Hydration/runtime exceptions.
- Data-loading states causing partial render.
- 3D scene: canvas sizing, camera framing, pointer interception.
- Replay/timeline synchronization.

Output:
1. Root-cause hypothesis.
2. Confidence level.
3. Exact file/component suspects.
4. Minimal patch plan.
5. Regression risks.

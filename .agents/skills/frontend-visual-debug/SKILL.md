---
name: frontend-visual-debug
description: Diagnose root causes of Agent_City desktop app UI issues using workbench layout heuristics and runtime evidence.
---

Use after reproduction evidence exists.

Root cause classes:
- layout sizing (grid/flex/min-height/overflow)
- mode-switch state desync
- overlay/z-index/pointer blocking
- 3D scene/camera/canvas sizing
- replay timeline synchronization
- runtime exceptions

Output:
1. Root cause hypothesis
2. Confidence level
3. Affected files/components
4. Minimal fix strategy
5. Regression risks

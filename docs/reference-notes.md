# Reference Notes And Cleanup Log

Date: 2026-04-02  
Scope: Agent City Visual Observability MVP

## 1) Reference Approach

This project uses references at the **interaction and architecture pattern** level only.
No third-party repository source code is copied into this project.

Main inspirations:

- CodeCharta / CodeCity style "software city" semantics
- Jaeger style trace timeline + span drill-down
- Langfuse / Phoenix style LLM trace detail and cost-centric observability views
- MCP Inspector style tool/MCP runtime debugging mental model

## 2) Practical Borrowed Ideas

- Spatial mapping: domain district -> module node -> dependency road
- Runtime overlay: trace/span/event as directional animated flow
- Replay UX: play/pause/speed + current-step subtitle + span list
- Diagnostics UX: error/retry/fallback visual differentiation + mode toggles

## 3) Repository Cleanup Policy

Policy used during development:

1. If any temporary reference repositories are created under `refs/`, `tmp/`, or `external_examples/`, scan them.
2. Any single reference directory over **200MB** is removed.
3. Before final delivery, run cleanup check and confirm no oversized reference folders remain.

Cleanup utility:

- `scripts/cleanup_refs.py`

## 4) Cleanup Execution Result

Executed on: 2026-04-02

- Command:
  - `python scripts/cleanup_refs.py --root . --dry-run`
- Result:
  - No reference directories found under `refs/`, `tmp/`, `external_examples`.
  - No oversized (>200MB) reference directories remained in deliverable structure.

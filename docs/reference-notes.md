# Reference Notes And Cleanup Log

Date: 2026-04-02
Scope: Agent_City full product baseline

## 1) Reference Approach

This project uses references at the **architecture and interaction pattern** level only.
No third-party source files are copied into this repository.

Reference inspirations:

- CodeCharta / CodeCity style software-city semantics
- Jaeger style trace timeline and span drill-down
- Langfuse / Phoenix style LLM observability and cost-centric views
- MCP Inspector style tool/MCP runtime debugging model

## 2) Borrowed Product Ideas

- Semantic city mapping: district -> node -> edge
- Runtime flow overlays with direction and status semantics
- Replay flow: play/pause/speed + timeline-linked span details
- Diagnostics mode: explicit error/retry/fallback and congestion signals
- Parser analysis mode: confidence/coverage/issues as first-class UX

## 3) Cleanup Policy

During development, external repositories are placed under `refs/`.

Rules:

1. Any single reference directory > 200MB must be removed.
2. Unlisted reference directories can be removed via keep-list mode.
3. Final deliverable keeps only required reference samples and reports.

Cleanup utility:

- `scripts/cleanup_refs.py`

## 4) Cleanup Execution (Actual Run)

Executed on: 2026-04-02

Command:

```bash
python scripts/cleanup_refs.py --root . --targets refs --threshold-mb 200 --keep-list-file docs/parser-tested-keep.txt --delete-unlisted
```

Result:

- Removed oversized refs (>200MB): 0
- Removed unlisted refs: 0
- Kept refs: 13 directories (including `refs/agent_drop` for auto-ingest)
- Largest kept ref: `refs/mastra-ai__mastra` at 172.49MB (below threshold)

## 5) Keep-list Notes

`docs/parser-tested-keep.txt` includes:

- 12 parser-tested repositories
- `agent_drop` (runtime auto-parse drop-in folder)

This prevents accidental deletion of the runtime ingest path while still enforcing cleanup constraints.

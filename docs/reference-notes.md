# Reference Notes And Cleanup Log

Date: 2026-04-02
Scope: Agent_City desktop workbench

## 1) External Reference Priority

This repository follows a strict reference order:

1. Official documentation
2. Official screenshots / official demo pages
3. Source repository (only if necessary)
4. Community/blog/forum content (non-official supplemental)
5. Unattributed screenshots (lowest priority)

We do not mass-clone repositories before documentation review.

## 2) Mandatory Pre-Clone Output (Per Target)

Before cloning source code, provide:

1. Top 3-5 borrowable ideas
2. What fits Agent_City
3. What should not be copied directly
4. Whether cloning is actually required
5. If cloning is required, exact directories/files to inspect

Template file:
- `docs/reference-evaluation-template.md`

## 3) Source Clone Rules

If cloning is required:

- Clone to `refs/` or `tmp_refs/` only
- Prefer `git clone --depth=1`
- Add `--filter=blob:none` when possible
- Avoid submodules and heavy artifacts
- Inspect only required directories/files

## 4) Cleanup Policy

Rules:

1. Any single reference directory > 200MB must be removed.
2. Unlisted reference directories are removable via keep-list mode.
3. Final workspace keeps only required reference samples and reports.

Cleanup utility:

- `scripts/cleanup_refs.py`

## 5) Cleanup Execution (Latest)

Executed on: 2026-04-02

Command (execute):

```bash
python scripts/cleanup_refs.py --root . --targets refs --threshold-mb 200 --keep-list-file docs/parser-tested-keep.txt --delete-unlisted
```

Validation command (dry-run):

```bash
python scripts/cleanup_refs.py --root . --targets refs --threshold-mb 200 --keep-list-file docs/parser-tested-keep.txt --delete-unlisted --dry-run
```

Latest result summary:

- Removed oversized refs (>200MB): 1
  - `refs/crewAIInc__crewAI` (~331MB)
- Removed unlisted refs: 3
  - `refs/pydantic__pydantic-ai`
  - `refs/swe-agent__swe-agent`
  - `refs/agent_drop`
- Remaining refs: 12
- Largest remaining ref: `refs/mastra-ai__mastra` (~172.49MB)

## 6) Borrowed Product Ideas (High Level)

- City metaphor hierarchy (district -> node -> edge)
- Trace + replay + timeline drill-down interaction
- Diagnostics emphasis on error/retry/fallback visibility
- Parser-analysis-first UX (confidence/unresolved/inferred surfaced directly)

No third-party source files are copied into this repository.

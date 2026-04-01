# Parser Fix Report

## Scope

This round targets parser quality issues in the existing platform stack:

- Static discovery (`topology_discovery`, `intelligent_topology_source`)
- Normalization (`topology_normalizer`)
- Runtime binding (`topology_binding`)
- Confidence/explainability (`confidence_scoring`)
- Regression harness stability (`run_parser_regression` clone behavior)

## 1) Problem Summary (Step 1)

Observed from existing artifacts (`docs/parser-test-results.md`, `tests/fixtures/parsed_samples/*.json`):

- Role inflation: many unrelated projects converged to nearly the same role set (typically 13-14 roles).
- Confidence inflation: scores clustered at high values and grades were almost all `A`.
- Weak graceful degradation: unresolved relation endpoints were not materialized as explicit provisional nodes.
- Binding detail loss: inferred edge de-dup used `(from,to)` keys and could collapse retry/fallback variants.
- Regression clone fragility: interrupted clone directories could cause skip/fail noise.

## 2) Classification And Root Causes (Step 2 + Step 3)

### A. Node Over-detection

- Symptom: excessive roles inferred from weak hints.
- Root cause:
  - docs/config hints weighted too strongly relative to code evidence.
  - optional coverage roles were force-added by `_ensure_role_coverage`.
- Fix strategy:
  - introduce language-specific parsers with weighted signals.
  - reduce docs influence.
  - keep only `runtime_node` hard-required; optional roles require score thresholds.

### B. Edge Semantics Loss In Binding

- Symptom: retry/fallback edges could be overwritten when same `(from,to)` appears.
- Root cause:
  - inferred-edge dedup key too coarse.
  - declared edge lookup ignored edge kind when multiple kinds exist.
- Fix strategy:
  - bind with `(from,to,kind)` first, fallback to pair.
  - dedup inferred edges by `(from,to,kind,protocol)`.
  - include span-kind/protocol aware edge-kind mapping.

### C. Incomplete Degradation For Missing Endpoints

- Symptom: relations may point to missing nodes without explicit placeholder nodes.
- Root cause:
  - normalizer assumed relation endpoints always exist in components.
- Fix strategy:
  - synthesize provisional runtime nodes for unresolved endpoints.
  - mark as `provisional/unresolved` with reason metadata.

### D. Confidence Explainability Gaps

- Symptom: parser confidence reasons not transparent in discovery output.
- Root cause:
  - no dedicated scoring service.
- Fix strategy:
  - add `ConfidenceScoringService`.
  - attach `parser_confidence`, `parser_grade`, `unresolved_symbols`, `source_coverage` to discovery output.
  - propagate to topology metadata.

### E. Regression Harness Clone Failure

- Symptom: stale non-empty clone dirs produced false skip/failure.
- Root cause:
  - clone logic treated any non-empty destination as usable.
- Fix strategy:
  - if destination exists but lacks `.git`, remove and re-clone.

## 3) Implemented Fixes (Step 4)

### New modules

- `backend/app/parsers/base.py`
- `backend/app/parsers/python_parser.py`
- `backend/app/parsers/typescript_parser.py`
- `backend/app/parsers/go_parser.py`
- `backend/app/parsers/rust_parser.py`
- `backend/app/parsers/java_parser.py`
- `backend/app/parsers/csharp_parser.py`
- `backend/app/parsers/config_parser.py`
- `backend/app/parsers/parser_registry.py`
- `backend/app/parsers/__init__.py`
- `backend/app/services/confidence_scoring.py`
- `scripts/run_parser_retest.py`

### Updated modules

- `backend/app/sources/intelligent_topology_source.py`
  - integrated parser registry
  - docs/config weighting control
  - optional role thresholding
  - unresolved hint collection
  - safer import-target cluster matching
- `backend/app/services/topology_discovery.py`
  - integrated confidence scoring
  - source unresolved hint ingestion
- `backend/app/services/topology_normalizer.py`
  - provisional node synthesis for unresolved relation endpoints
  - topology metadata includes parser diagnostics
- `backend/app/services/topology_binding.py`
  - alias-aware node binding
  - retry/fallback/inferred edge-kind aware matching
  - inferred edge dedup key upgraded
- `backend/app/models/schemas.py`
  - `TopologyGraph.metadata`
  - discovery diagnostics fields
- `scripts/run_parser_regression.py`
  - clone robustness for stale directories

## 4) Added/Updated Tests (Step 5)

Added unit-level regression tests:

- `tests/parser/test_intelligent_topology_source.py`
  - reproduces docs-noise over-detection risk and verifies reduced false positives.
- `tests/parser/test_language_parsers.py`
  - validates TS/Go/Java lightweight parser rules.
- `tests/parser/test_topology_binding.py`
  - verifies alias binding and retry/fallback inferred edge separation.
- `tests/parser/test_topology_normalizer.py`
  - verifies provisional node creation for unresolved relation endpoints.
- `tests/parser/test_confidence_scoring.py`
  - verifies low-confidence degradation and higher-confidence healthy case.
- `tests/parser/test_topology_discovery.py`
  - verifies discovery output now contains confidence and unresolved reasons.

## 5) Validation And Before/After Comparison (Step 6)

### A. Unit tests

Executed:

- `python -m unittest discover -s tests/parser -p "test_*.py" -v`

Result:

- 10/10 passed.

### B. Representative retest

Executed:

- `python scripts/run_parser_retest.py`

Output artifact:

- `docs/parser-regression-summary.md`

Representative comparison against prior fixture baselines:

- Role count is no longer fixed around 13-14 for every target.
- Confidence now has realistic spread (`min 0.655`, `max 0.936`, `avg 0.811`) instead of near-uniform high values.
- Grades now differentiate (`A/B/C`) rather than almost-all `A`.

## 6) Remaining Issues (Not Fully Solved)

- Dynamic runtime registration/reflection still needs runtime telemetry correlation for full edge recovery.
- Import-based static edge inference in very large monorepos can still include noisy links.
- Framework-specific DSL parsing is still heuristic; AST-grade extractors remain future work.

## 7) Next Recommendations

1. Add framework-aware adapters (LangGraph/AutoGen/Semantic Kernel/MCP-specific signatures) on top of current parser registry.
2. Add AST-assisted edge extraction for Python/TypeScript/Go in a bounded scope.
3. Add confidence provenance buckets per edge (`path_hint`, `config_hint`, `registry_hint`, `runtime_observed`).
4. Add end-to-end replay assertions that validate retry/fallback visual states against binding output.

## 8) Reference Re-test Cleanup Status

- This round reused existing `refs/` projects and did not clone new repositories.
- Cleanup check executed with dry-run:
  - `python scripts/cleanup_refs.py --root . --targets refs --threshold-mb 200 --keep-list-file docs/parser-tested-keep.txt --delete-unlisted --dry-run`
- Result:
  - no reference directory exceeds `200MB`.
  - no new unlisted reference directory introduced by this fix round.

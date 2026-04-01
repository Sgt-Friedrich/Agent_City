# Parser Regression Summary

This summary compares current parser behavior against previous parsed fixture baselines.

## Coverage

- Selected representative targets: 8
- Parsed successfully: 8
- Missing targets: 0

## Per Target

| Target | Category | Status | Grade | Confidence | Roles | Nodes | Edges | Provisional | Baseline Role Count | Delta |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| langgraph | python framework | ok | B | 0.761 | 9 | 9 | 4 | 0 | 13 | -4 |
| mastra | typescript framework | ok | A | 0.936 | 12 | 43 | 142 | 0 | 14 | -2 |
| eino | go enterprise/workflow | ok | A | 0.929 | 10 | 21 | 44 | 0 | 13 | -3 |
| langchain4j | java enterprise/workflow | ok | B | 0.738 | 10 | 14 | 3 | 0 | 14 | -4 |
| OpenHands | coding agent | ok | A | 0.845 | 11 | 24 | 18 | 0 | 13 | -2 |
| browser-use | browser agent | ok | B | 0.748 | 10 | 11 | 4 | 0 | 13 | -3 |
| semantic-kernel | .NET enterprise/workflow | ok | C | 0.655 | 10 | 11 | 2 | 0 | 14 | -4 |
| autoagents | rust runtime | ok | A | 0.879 | 10 | 20 | 19 | 0 | 13 | -3 |

## Confidence Distribution

- min confidence: 0.655
- max confidence: 0.936
- avg confidence: 0.811

## Improvements Observed

- Role inflation reduced for representative targets (role counts are no longer fixed at a narrow band).
- Parser confidence now has wider spread instead of near-uniform high values.
- Provisional nodes are explicit and counted, improving graceful degradation visibility.

## Remaining Difficult Cases

- Highly dynamic registration and reflection-heavy projects still need runtime evidence for full topology recovery.
- Cross-language monorepos can still produce noisy import-derived edges without AST-level linking.

## Ref Usage And Cleanup

- Re-test uses existing local refs only (no new clone in this round).
- Cleanup check command:
  - `python scripts/cleanup_refs.py --root . --targets refs --threshold-mb 200 --keep-list-file docs/parser-tested-keep.txt --delete-unlisted --dry-run`
- Cleanup status:
  - no reference directory exceeds 200MB.

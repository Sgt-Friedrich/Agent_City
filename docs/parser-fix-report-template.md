# Parser Fix Report Template

## 1. Summary
- Date:
- Owner:
- Branch/Commit:
- Scope:

## 2. Problem Statement
- Affected parser layer(s): discovery / normalizer / binding / confidence / language parser
- Symptom category:
  - [ ] node miss
  - [ ] edge miss
  - [ ] type misclassification
  - [ ] district misclassification
  - [ ] retry/fallback/loop miss
  - [ ] unresolved/confidence issue
  - [ ] other
- User-visible impact:

## 3. Root Cause Analysis
- Trigger fixture/project:
- Root cause details:
- Why previous logic failed:

## 4. Fix Strategy
- Patch principles (minimal/incremental):
- Modules changed:
- Risk assessment:

## 5. Code Changes
- File list:
- Key diffs summary:
- Added/updated comments:

## 6. Regression Tests
- Unit tests added/updated:
- Fixtures added/updated:
- Real-project recheck set:

## 7. Before vs After
| Metric | Before | After |
|---|---:|---:|
| parser confidence |  |  |
| unresolved symbols |  |  |
| inferred runtime edges correctness |  |  |
| topology completeness |  |  |

## 8. Remaining Gaps
- Known unresolved patterns:
- Deferred improvements:

## 9. Next Actions
1. 
2. 
3. 

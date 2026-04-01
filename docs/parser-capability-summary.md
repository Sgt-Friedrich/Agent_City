# Parser Capability Summary

## Coverage Stats

- Successful tested projects: **13**
- Grade distribution: {'A': 13}
- Language coverage: {'.NET/mixed': 1, 'Go': 1, 'Java/JVM': 1, 'Python': 6, 'Rust': 1, 'TypeScript': 3}
- Domain coverage: {'agent framework': 1, 'agent runtime': 1, 'browser automation': 1, 'coding agent platform': 1, 'enterprise mixed platform': 1, 'enterprise workflow framework': 1, 'enterprise/workflow': 1, 'general agent framework': 1, 'graph/workflow framework': 1, 'multi-agent orchestration': 2, 'plugin-heavy agent': 1, 'tool-heavy framework': 1}

## Easiest Patterns

- clear graph/workflow directories and explicit planner/tool modules
- explicit registry/factory APIs and stable naming
- config manifests (pyproject/package/cargo/go.mod/pom)

## Hardest Patterns

- dynamic runtime registration/reflection
- cross-language mixed plugin surfaces
- monorepo fragmentation and indirect wiring

## Current Parser Gaps

- precise AST-level call graph edges
- framework-specific DSL parsing
- runtime-generated relation reconstruction

## Next Parser Upgrades

1. Add per-language AST extractors for call edges.
2. Add schema-aware config adapters (YAML/JSON/TOML).
3. Add framework signatures (LangGraph/AutoGen/CrewAI/Semantic Kernel/MCP).
4. Attach confidence provenance buckets to each edge.
## Cleanup Status

- Removed refs `>200MB`: `crewAIInc__crewAI`.
- Removed refs not in tested keep-list: `pydantic__pydantic-ai`, `swe-agent__swe-agent`.
- Post-cleanup remaining refs: 12 directories, total 528.14MB.
- Max remaining single ref directory: 172.49MB (`mastra-ai__mastra`).
- No remaining reference project directory exceeds 200MB.

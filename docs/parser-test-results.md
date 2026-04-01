# Parser Regression Test Results

Successful parses: **13**
Skipped/failed clones: **2**

## langchain-ai/langgraph

- Language (declared/detected): Python / Python
- Domain: multi-agent orchestration
- Parse success: yes
- Parser confidence: 0.87
- Grade: **A**
- Topology: 7 districts, 13 nodes, 12 declared edges
- Runtime edges: observed=15, inferred=3, fallback=1, retry=1
- Source coverage: config=True, registry=True, code=True
- Roles found: agent, embedding, evaluator, guardrail, llm, mcp, memory, planner, prompt, retriever, runtime_node, sub_agent, tool
- Difficulties: dynamic registration/reflection likely hides static relations
- Notes: AGENTS.md -> ['agent', 'memory', 'planner', 'runtime_node', 'tool']; CLAUDE.md -> ['agent', 'memory', 'planner', 'runtime_node', 'tool']; docs\generate_redirects.py -> ['llm', 'planner', 'prompt', 'retriever', 'runtime_node']

## microsoft/autogen

- Language (declared/detected): Python / Python, .NET/mixed, TypeScript
- Domain: multi-agent orchestration
- Parse success: yes
- Parser confidence: 0.9
- Grade: **A**
- Topology: 7 districts, 14 nodes, 14 declared edges
- Runtime edges: observed=16, inferred=3, fallback=1, retry=1
- Source coverage: config=True, registry=True, code=True
- Roles found: agent, embedding, evaluator, guardrail, llm, mcp, memory, planner, prompt, reranker, retriever, runtime_node, sub_agent, tool
- Difficulties: dynamic registration/reflection likely hides static relations
- Notes: codecov.yml -> ['retriever']; CONTRIBUTING.md -> ['agent', 'memory', 'planner', 'retriever', 'tool']; docs\design\01 - Programming Model.md -> ['agent', 'llm', 'memory', 'planner', 'prompt', 'retriever', 'runtime_node', 'tool']

## crewAIInc/crewAI

- Language (declared/detected): Python / Python
- Domain: tool-heavy framework
- Parse success: yes
- Parser confidence: 0.9
- Grade: **A**
- Topology: 7 districts, 14 nodes, 14 declared edges
- Runtime edges: observed=16, inferred=3, fallback=1, retry=1
- Source coverage: config=True, registry=True, code=True
- Roles found: agent, embedding, evaluator, guardrail, llm, mcp, memory, planner, prompt, reranker, retriever, runtime_node, sub_agent, tool
- Difficulties: dynamic registration/reflection likely hides static relations
- Notes: .pre-commit-config.yaml -> ['prompt', 'runtime_node', 'tool']; conftest.py -> ['agent', 'guardrail', 'llm', 'memory', 'retriever', 'runtime_node', 'tool']; docs\docs.json -> ['agent', 'embedding', 'llm', 'mcp', 'memory', 'planner', 'prompt', 'retriever', 'runtime_node', 'tool']

## openai/openai-agents-python

- Language (declared/detected): Python / Python
- Domain: general agent framework
- Parse success: yes
- Parser confidence: 0.9
- Grade: **A**
- Topology: 7 districts, 14 nodes, 14 declared edges
- Runtime edges: observed=16, inferred=3, fallback=1, retry=1
- Source coverage: config=True, registry=True, code=True
- Roles found: agent, embedding, evaluator, guardrail, llm, mcp, memory, planner, prompt, reranker, retriever, runtime_node, sub_agent, tool
- Difficulties: dynamic registration/reflection likely hides static relations
- Notes: AGENTS.md -> ['agent', 'evaluator', 'guardrail', 'llm', 'mcp', 'memory', 'planner', 'prompt', 'retriever', 'runtime_node', 'tool']; CLAUDE.md -> ['agent']; docs\agents.md -> ['agent', 'guardrail', 'llm', 'mcp', 'memory', 'planner', 'prompt', 'retriever', 'runtime_node', 'sub_agent', 'tool']

## browser-use/browser-use

- Language (declared/detected): Python / Python
- Domain: browser automation
- Parse success: yes
- Parser confidence: 0.87
- Grade: **A**
- Topology: 7 districts, 13 nodes, 12 declared edges
- Runtime edges: observed=15, inferred=3, fallback=1, retry=1
- Source coverage: config=True, registry=True, code=True
- Roles found: agent, embedding, evaluator, guardrail, llm, mcp, memory, planner, prompt, retriever, runtime_node, sub_agent, tool
- Difficulties: dynamic registration/reflection likely hides static relations
- Notes: .pre-commit-config.yaml -> ['memory']; AGENTS.md -> ['agent', 'llm', 'memory', 'prompt', 'retriever', 'runtime_node', 'tool']; browser_use\__init__.py -> ['agent', 'llm', 'mcp', 'memory', 'prompt', 'runtime_node', 'tool']

## OpenHands/OpenHands

- Language (declared/detected): Python / TypeScript, Python
- Domain: coding agent platform
- Parse success: yes
- Parser confidence: 0.87
- Grade: **A**
- Topology: 7 districts, 13 nodes, 12 declared edges
- Runtime edges: observed=15, inferred=3, fallback=1, retry=1
- Source coverage: config=True, registry=True, code=True
- Roles found: agent, embedding, evaluator, guardrail, llm, mcp, memory, planner, prompt, retriever, runtime_node, sub_agent, tool
- Difficulties: dynamic registration/reflection likely hides static relations
- Notes: AGENTS.md -> ['agent', 'llm', 'memory', 'planner', 'retriever', 'runtime_node', 'tool']; CODE_OF_CONDUCT.md -> ['guardrail', 'llm', 'prompt', 'retriever', 'runtime_node', 'tool']; COMMUNITY.md -> ['memory', 'retriever', 'runtime_node']

## mastra-ai/mastra

- Language (declared/detected): TypeScript / TypeScript
- Domain: agent framework
- Parse success: yes
- Parser confidence: 0.9
- Grade: **A**
- Topology: 7 districts, 14 nodes, 14 declared edges
- Runtime edges: observed=16, inferred=3, fallback=1, retry=1
- Source coverage: config=True, registry=True, code=True
- Roles found: agent, embedding, evaluator, guardrail, llm, mcp, memory, planner, prompt, reranker, retriever, runtime_node, sub_agent, tool
- Difficulties: dynamic registration/reflection likely hides static relations
- Notes: .coderabbit.yaml -> ['mcp', 'memory', 'planner', 'retriever', 'runtime_node', 'tool']; .stylelintrc.json -> ['tool']; __recordings__\core-src-voice-aisdk-__tests__-aisdk-voice.e2e.json -> ['llm', 'memory', 'planner', 'runtime_node']

## elizaOS/eliza

- Language (declared/detected): TypeScript / TypeScript, Rust, Python
- Domain: plugin-heavy agent
- Parse success: yes
- Parser confidence: 0.87
- Grade: **A**
- Topology: 7 districts, 13 nodes, 12 declared edges
- Runtime edges: observed=15, inferred=3, fallback=1, retry=1
- Source coverage: config=True, registry=True, code=True
- Roles found: agent, embedding, evaluator, guardrail, llm, mcp, memory, planner, prompt, retriever, runtime_node, sub_agent, tool
- Difficulties: dynamic registration/reflection likely hides static relations
- Notes: biome.json -> ['llm', 'runtime_node', 'tool']; bunfig.toml -> ['memory', 'retriever', 'runtime_node', 'tool']; docs\API_REFERENCE.md -> ['agent', 'embedding', 'evaluator', 'llm', 'memory', 'runtime_node', 'tool']

## langchain-ai/langgraphjs

- Language (declared/detected): TypeScript / TypeScript
- Domain: graph/workflow framework
- Parse success: yes
- Parser confidence: 0.87
- Grade: **A**
- Topology: 7 districts, 13 nodes, 12 declared edges
- Runtime edges: observed=15, inferred=3, fallback=1, retry=1
- Source coverage: config=True, registry=True, code=True
- Roles found: agent, embedding, evaluator, guardrail, llm, mcp, memory, planner, prompt, retriever, runtime_node, sub_agent, tool
- Difficulties: dynamic registration/reflection likely hides static relations
- Notes: CLAUDE.md -> ['memory', 'planner', 'tool']; CONTRIBUTING.md -> ['memory', 'planner', 'prompt', 'retriever', 'runtime_node', 'tool']; deno.json -> ['planner']

## cloudwego/eino

- Language (declared/detected): Go / Go
- Domain: enterprise workflow framework
- Parse success: yes
- Parser confidence: 0.89
- Grade: **A**
- Topology: 7 districts, 13 nodes, 11 declared edges
- Runtime edges: observed=13, inferred=3, fallback=1, retry=1
- Source coverage: config=True, registry=True, code=True
- Roles found: agent, embedding, evaluator, guardrail, llm, memory, planner, prompt, reranker, retriever, runtime_node, sub_agent, tool
- Difficulties: dynamic registration/reflection likely hides static relations
- Notes: .golangci.yaml -> ['agent', 'evaluator', 'llm', 'memory', 'planner', 'retriever', 'runtime_node', 'tool']; .licenserc.yaml -> ['prompt']; adk\agent_tool.go -> ['agent', 'memory', 'runtime_node', 'tool']

## liquidos-ai/autoagents

- Language (declared/detected): Rust / Rust
- Domain: agent runtime
- Parse success: yes
- Parser confidence: 0.87
- Grade: **A**
- Topology: 7 districts, 13 nodes, 12 declared edges
- Runtime edges: observed=15, inferred=3, fallback=1, retry=1
- Source coverage: config=True, registry=True, code=True
- Roles found: agent, embedding, evaluator, guardrail, llm, mcp, memory, planner, prompt, retriever, runtime_node, sub_agent, tool
- Difficulties: dynamic registration/reflection likely hides static relations
- Notes: AGENTS.md -> ['agent', 'guardrail', 'llm', 'mcp', 'memory', 'retriever', 'runtime_node', 'tool']; bindings\python\autoagents\autoagents_py\__init__.py -> ['agent', 'llm', 'memory', 'retriever', 'runtime_node', 'tool']; bindings\python\autoagents\autoagents_py\_core.py -> ['agent', 'llm', 'memory', 'retriever', 'runtime_node', 'tool']

## langchain4j/langchain4j

- Language (declared/detected): Java/JVM / Java/JVM
- Domain: enterprise/workflow
- Parse success: yes
- Parser confidence: 0.9
- Grade: **A**
- Topology: 7 districts, 14 nodes, 13 declared edges
- Runtime edges: observed=15, inferred=3, fallback=0, retry=1
- Source coverage: config=True, registry=True, code=True
- Roles found: agent, embedding, evaluator, guardrail, llm, mcp, memory, planner, prompt, reranker, retriever, runtime_node, sub_agent, tool
- Difficulties: dynamic registration/reflection likely hides static relations
- Notes: code-execution-engines\langchain4j-code-execution-engine-azure-acads\pom.xml -> ['llm', 'runtime_node']; code-execution-engines\langchain4j-code-execution-engine-azure-acads\src\main\java\dev\langchain4j\code\azure\acads\SessionsREPLTool.java -> ['agent', 'embedding', 'retriever', 'runtime_node', 'tool']; code-execution-engines\langchain4j-code-execution-engine-azure-acads\src\test\java\dev\langchain4j\code\azure\acads\SessionsREPLToolTest.java -> ['runtime_node', 'tool']

## microsoft/semantic-kernel

- Language (declared/detected): .NET/mixed / .NET/mixed
- Domain: enterprise mixed platform
- Parse success: yes
- Parser confidence: 0.9
- Grade: **A**
- Topology: 7 districts, 14 nodes, 14 declared edges
- Runtime edges: observed=16, inferred=3, fallback=1, retry=1
- Source coverage: config=True, registry=True, code=True
- Roles found: agent, embedding, evaluator, guardrail, llm, mcp, memory, planner, prompt, reranker, retriever, runtime_node, sub_agent, tool
- Difficulties: dynamic registration/reflection likely hides static relations
- Notes: COMMUNITY.md -> ['runtime_node']; CONTRIBUTING.md -> ['memory', 'planner', 'retriever', 'runtime_node', 'tool']; docs\COSINE_SIMILARITY.md -> ['embedding', 'planner', 'retriever', 'runtime_node', 'tool']

## Skipped / Failed

- `pydantic/pydantic-ai`: clone failed: fatal: destination path 'D:\others\OD\OneDrive - University of Glasgow\妗岄潰\claude code\agent-city-mvp\refs\pydantic__pydantic-ai' already exists and is not an empty directory.
- `swe-agent/swe-agent`: clone failed: fatal: destination path 'D:\others\OD\OneDrive - University of Glasgow\妗岄潰\claude code\agent-city-mvp\refs\swe-agent__swe-agent' already exists and is not an empty directory.
## Cleanup Execution

- Cleanup command (dry-run):
  - `python scripts/cleanup_refs.py --root . --targets refs --threshold-mb 200 --keep-list-file docs/parser-tested-keep.txt --delete-unlisted --dry-run`
- Cleanup command (execute):
  - `python scripts/cleanup_refs.py --root . --targets refs --threshold-mb 200 --keep-list-file docs/parser-tested-keep.txt --delete-unlisted`
- Deleted because `>200MB`:
  - `refs/crewAIInc__crewAI` (331.20MB)
- Deleted because unlisted/failed:
  - `refs/pydantic__pydantic-ai` (91.32MB)
  - `refs/swe-agent__swe-agent` (29.59MB)
- Remaining refs count: 12
- Remaining refs total size: 528.14MB
- Largest remaining single ref dir: `refs/mastra-ai__mastra` (172.49MB)

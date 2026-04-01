# Parser Regression Test Plan

## Selected Projects

| Repo | Language | Domain |
|---|---|---|
| `langchain-ai/langgraph` | Python | multi-agent orchestration |
| `microsoft/autogen` | Python | multi-agent orchestration |
| `crewAIInc/crewAI` | Python | tool-heavy framework |
| `openai/openai-agents-python` | Python | general agent framework |
| `pydantic/pydantic-ai` | Python | typed agent framework |
| `swe-agent/swe-agent` | Python | coding agent |
| `browser-use/browser-use` | Python | browser automation |
| `OpenHands/OpenHands` | Python | coding agent platform |
| `mastra-ai/mastra` | TypeScript | agent framework |
| `elizaOS/eliza` | TypeScript | plugin-heavy agent |
| `langchain-ai/langgraphjs` | TypeScript | graph/workflow framework |
| `cloudwego/eino` | Go | enterprise workflow framework |
| `liquidos-ai/autoagents` | Rust | agent runtime |
| `langchain4j/langchain4j` | Java/JVM | enterprise/workflow |
| `microsoft/semantic-kernel` | .NET/mixed | enterprise mixed platform |

## Expected Coverage

- Languages: Python, TypeScript, Go, Rust, Java/JVM, .NET/mixed
- Sources: config-driven / registry-driven / code-driven
## Selection Rationale

- `langchain-ai/langgraph`, `microsoft/autogen`: multi-agent orchestration baseline and handoff patterns.
- `openai/openai-agents-python`, `crewAIInc/crewAI`: framework + registry-driven agent/tool definitions.
- `browser-use/browser-use`, `OpenHands/OpenHands`, `swe-agent/swe-agent`: browser/coding-agent behavior diversity.
- `mastra-ai/mastra`, `elizaOS/eliza`, `langgraphjs`: TypeScript framework and plugin-heavy ecosystem coverage.
- `cloudwego/eino`: Go enterprise workflow/agent framework.
- `liquidos-ai/autoagents`: Rust agent runtime coverage.
- `langchain4j/langchain4j`, `microsoft/semantic-kernel`: JVM + .NET/mixed enterprise ecosystems.

## Language And Domain Coverage Target

- Language target: Python / TypeScript / Go / Rust / Java-JVM / .NET-mixed
- Domain target: general framework, coding agent, browser automation, enterprise/workflow, tool-heavy integration, multi-agent orchestration

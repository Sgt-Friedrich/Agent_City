# Agent_City

Agent_City 是一个面向 Agent 系统的“城市化可视化 + 运行时监控”项目。  
Agent_City is a city-style visualization and runtime observability platform for agent systems.

---

## 1) 项目简介 | Overview

**中文**
- 目标：把 Agent 系统的静态架构和运行时链路统一展示在一个 3D 城市视图中。
- 城市隐喻：街区=模块域，建筑=组件节点，道路=依赖关系，流动=trace/span/event。
- 核心价值：不仅看“结构”，还能看“行为”和“诊断”。

**English**
- Goal: unify static architecture and runtime traces in one 3D city view.
- City metaphor: district = domain, building = component node, road = dependency edge, flow = trace/span/event.
- Value: show structure, behavior, and diagnostics together.

---

## 1.1) 为什么不是普通拓扑图 | Why It Is Not Just a Topology Viewer

**中文**
- 不是静态图：支持 live trace + replay + diagnostics。
- 不是一次性 demo：包含 parser 回归、前端自调试技能链、清理脚本与报告模板。
- 不是单点功能：从“解析 -> 展示 -> 诊断 -> 修复 -> 回归”形成闭环。

**English**
- Not static-only: includes live trace, replay, and diagnostics views.
- Not a one-off demo: includes parser regression, frontend self-debug skills, cleanup tooling, and report templates.
- Not a point solution: closes the loop from parsing to visualization, diagnosis, fixes, and regression.

---

## 2) 核心能力 | Core Capabilities

**中文**
1. 静态解析：Topology Discovery + Normalizer（支持未知仓库智能解析）。
2. 运行时解析：Trace Resolver（含 retry/fallback/mcp/tool/retrieval 路径模拟与映射）。
3. 图绑定：Topology + Trace Binding（declared/observed/inferred/fallback/retry）。
4. 前端可视化：3D 城市 + 实时流动 + replay 回放 + 诊断模式。
5. 回归体系：多语言解析回归 + 前端 Playwright 响应式回归。

**English**
1. Static parsing: Topology Discovery + Normalizer (including intelligent parsing for unseen repos).
2. Runtime parsing: Trace Resolver (retry/fallback/mcp/tool/retrieval path modeling and mapping).
3. Graph binding: Topology + Trace Binding (declared/observed/inferred/fallback/retry).
4. Frontend visualization: 3D city + live flows + replay mode + diagnostics mode.
5. Regression: multi-language parser regression + responsive frontend regression with Playwright.

---

## 3) 展示截图 | Screenshots

### Dashboard (Desktop)
![Agent_City Dashboard Desktop](docs/screenshots/dashboard-desktop.png)

### Dashboard (Mobile)
![Agent_City Dashboard Mobile](docs/screenshots/dashboard-mobile.png)

### Replay (Desktop)
![Agent_City Replay Desktop](docs/screenshots/replay-desktop.png)

---

## 4) 架构分层 | Architecture Layers

### 静态解析层 | Static Parsing Layer
- `backend/app/services/topology_discovery.py`
- `backend/app/services/topology_normalizer.py`
- `backend/app/sources/repo_topology_source.py`
- `backend/app/sources/intelligent_topology_source.py`
- `backend/app/parsers/*` (Python/TS/Go/Rust/Java/C# + config/docs parser)

### 运行时解析层 | Runtime Parsing Layer
- `backend/app/services/runtime_trace_resolver.py`
- `backend/app/services/topology_binding.py`
- `backend/app/generators/live_event_generator.py`

### 可视化表达层 | Visualization Layer
- `frontend/components/city/*`
- `frontend/components/panels/*`
- `frontend/components/replay/*`
- `frontend/store/useDashboardStore.ts`

---

## 5) 目录结构 | Project Structure

```text
Agent_City/
  backend/
  frontend/
  docs/
  tests/
  scripts/
  .agents/
  plugins/frontend-ops/
  AGENTS.md
```

---

## 6) 快速启动 | Quick Start

### Backend
```bash
cd backend
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### 打开页面 | Open URLs
- Dashboard: `http://127.0.0.1:3000`
- Replay: `http://127.0.0.1:3000/replay/<trace_id>?target=mock`

### 自动解析工作流 | Auto Parse Workflow
**中文**
1. 启动后端和前端后，把任意 Agent 源码目录复制到：`refs/agent_drop/`
2. 页面顶部会出现解析进度条（queued -> discovery -> normalization -> runtime -> completed）
3. 解析完成后会自动切换到新 target，并刷新城市视图

**English**
1. After backend/frontend start, copy any agent source directory into `refs/agent_drop/`
2. The dashboard top bar shows parsing progress (queued -> discovery -> normalization -> runtime -> completed)
3. When parsing finishes, the UI auto-switches to the new target and expands the city view

---

## 7) API 与实时流 | API and Live Stream

### REST
- `GET /api/targets`
- `POST /api/targets/register`
- `GET /api/topology?target=...`
- `GET /api/traces?target=...`
- `GET /api/traces/{trace_id}?target=...`
- `GET /api/nodes/{node_id}?target=...`
- `GET /api/metrics/summary?target=...`
- `GET /api/parse-jobs`
- `POST /api/parse-jobs/scan`

### WebSocket
- `GET /ws/live?target=...`

---

## 8) 测试与回归 | Testing and Regression

### 解析器测试 | Parser Tests
```bash
python -m unittest discover -s tests/parser -p "test_*.py" -v
python scripts/run_parser_retest.py
```

### 前端 E2E | Frontend E2E
```bash
npm --prefix frontend run e2e:install
npm --prefix frontend run e2e
npm --prefix frontend run build
```

当前回归报告 | Current reports:
- `docs/parser-fix-report.md`
- `docs/parser-regression-summary.md`
- `docs/frontend-e2e-test-report.md`

---

## 8.1) 文档入口 | Documentation Index

- `docs/architecture.md`
- `docs/product-ux.md`
- `docs/parser-test-plan.md`
- `docs/parser-test-results.md`
- `docs/parser-capability-summary.md`
- `docs/parser-fix-report-template.md`
- `docs/parser-fix-report.md`
- `docs/frontend-debug-playbook.md`
- `docs/frontend-fix-report.md`
- `docs/frontend-fix-report-template.md`
- `docs/reference-notes.md`

---

## 9) 前端排障工具链 | Frontend Debug Toolchain

本仓库内置可复用技能链：  
This repo includes a reusable skills chain:

- `frontend-repro`
- `frontend-visual-debug`
- `frontend-fix`
- `frontend-regression`
- `frontend-report`

相关文件 | Related files:
- `AGENTS.md`
- `.agents/skills/frontend-*`
- `.agents/plugins/marketplace.json`
- `plugins/frontend-ops/.codex-plugin/plugin.json`
- `plugins/frontend-ops/skills/frontend-*`

---

## 10) 参考仓清理规则 | Reference Repository Cleanup

```bash
python scripts/cleanup_refs.py --root . --targets refs --threshold-mb 200 --keep-list-file docs/parser-tested-keep.txt --delete-unlisted --dry-run
```

规则：任何单个参考目录 > 200MB 必须清理。  
Rule: any single reference repo directory > 200MB must be removed.

说明：`refs/agent_drop/` 已加入保留清单，用于运行时自动解析投递目录。  
Note: `refs/agent_drop/` is now included in keep-list as the runtime drop-in ingest folder.

---

## 11) 后续扩展 | Future Extensions

**中文**
- 可接入 OpenTelemetry / OpenInference / Jaeger / Langfuse / Phoenix。
- 可替换 mock trace source 为真实 telemetry adapter。

**English**
- Can be extended to OpenTelemetry / OpenInference / Jaeger / Langfuse / Phoenix.
- Mock runtime sources can be replaced by real telemetry adapters.

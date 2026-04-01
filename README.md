# Agent_City Desktop App

Agent_City 是一个本地桌面应用工作台，用于 Agent 系统的**架构解析、运行时追踪、城市化可视表达、诊断、回放与报告闭环**。  
Agent_City is a local desktop workbench for **architecture parsing, runtime tracing, city-style observability, diagnostics, replay, and reporting closure**.

---

## 1) 这不是普通网页 | Why This Is Not a Typical Web Dashboard

**中文**
- 这是桌面 App 工作台，主窗口内集成了本地服务编排状态、报告导出和长期分析路径。
- 不只是静态拓扑图，支持 live/replay/diagnostics/parser analysis/reports 全链路视图。
- 支持从“解析 -> 追踪 -> 可视诊断 -> 修复回归 -> 报告沉淀”的闭环。

**English**
- This is a desktop app workbench with local service orchestration awareness and local report export.
- It is not a static topology graph; it provides live/replay/diagnostics/parser-analysis/reports views.
- It closes the loop from parse -> trace -> diagnose -> fix -> regression -> report.

---

## 2) 核心能力 | Core Capabilities

1. **静态架构解析 | Static Architecture Parsing**
- Topology Discovery + Normalizer
- Multi-language parsing (Python / TypeScript / Go / Rust / Java / C# / config)
- Provenance + confidence + graceful degradation

2. **运行时追踪 | Runtime Tracing**
- TraceEnvelope / SpanEvent / FlowEvent
- retry / fallback / error / rejection handling
- topology binding with declared/observed/inferred edges

3. **城市化表达 | City-style Visualization**
- district = module domain
- building = component
- road = dependency/runtime path
- flow = runtime data movement

4. **诊断与回放 | Diagnostics and Replay**
- slow/error/congested nodes
- unstable edges
- trace replay with timeline

5. **解析能力分析 | Parser Analysis**
- parser confidence, coverage, unresolved symbols, low-confidence edges

6. **报告中心 | Reports Center**
- parser/app/system report catalog
- document preview + export
- desktop file save/open actions

---

## 3) 应用形态 | App Form

- Desktop shell: **Electron** (shell boundary is isolated for future Tauri migration)
- Workbench UI: Next.js + React + TypeScript + Tailwind + React Three Fiber + Zustand
- Local service: FastAPI + WebSocket

---

## 4) 展示截图 | Screenshots

### Main Workbench (Desktop)
![Agent_City Dashboard Desktop](docs/screenshots/dashboard-desktop.png)

### Main Workbench (Mobile Preview)
![Agent_City Dashboard Mobile](docs/screenshots/dashboard-mobile.png)

### Replay View
![Agent_City Replay Desktop](docs/screenshots/replay-desktop.png)

---

## 5) 应用结构 | Application Structure

```text
Agent_City/
  desktop/                     # desktop shell
    main.js
    preload.js
    src/serviceManager.js
  frontend/                    # workbench UI
  backend/                     # local FastAPI service
  docs/                        # architecture/ux/reports
  tests/                       # parser regression tests
  scripts/                     # automation, cleanup, full-system tests
  .agents/                     # Codex self-debug workflow
```

---

## 6) 工作台视图 | Workbench Views

- `Overview`
- `Live`
- `Replay`
- `Diagnostics`
- `Parser Analysis`
- `Reports`

窗口信息架构：
- 顶部：KPI + 模式状态 + 本地服务状态
- 左侧：导航 + 过滤
- 中部：城市/分析工作区
- 右侧：检查器
- 底部：时间线

---

## 7) 启动方式 | How To Run

### 7.1 安装依赖 | Install

```bash
npm --prefix frontend install
npm --prefix desktop install
python -m pip install -r backend/requirements.txt
```

### 7.2 启动桌面应用 | Start Desktop App

```bash
npm --prefix desktop run dev
```

桌面壳会尝试：
1. 复用已在本机运行的 frontend/backend 服务；
2. 若不存在则自动拉起本地服务（backend + frontend）。

### 7.3 可选：独立启动本地服务 | Optional standalone local services

```bash
# backend
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# frontend
npm --prefix frontend run dev
```

---

## 8) 自动解析投递目录 | Drop-in Parse Workflow

1. 启动应用后，将待解析 agent 目录复制到：`refs/agent_drop/`
2. 主窗口顶部显示解析进度条
3. 解析完成后自动切换 target 并展开城市工作区

---

## 9) 后端接口 | Local Service APIs

### Topology & Runtime
- `GET /api/targets`
- `POST /api/targets/register`
- `GET /api/topology?target=...`
- `GET /api/traces?target=...`
- `GET /api/traces/{trace_id}?target=...`
- `GET /api/nodes/{node_id}?target=...`
- `GET /api/metrics/summary?target=...`
- `GET /ws/live?target=...`

### Parsing Jobs
- `GET /api/parse-jobs`
- `POST /api/parse-jobs/scan`

### Analysis
- `GET /api/analysis/diagnostics?target=...`
- `GET /api/analysis/parser?target=...`
- `GET /api/analysis/report?target=...&fmt=markdown|json`

### Reports Catalog
- `GET /api/reports`
- `GET /api/reports/{report_id}`

---

## 10) 解析器结构 | Parser Architecture

核心模块：
- `backend/app/services/topology_discovery.py`
- `backend/app/services/topology_normalizer.py`
- `backend/app/services/runtime_trace_resolver.py`
- `backend/app/services/topology_binding.py`
- `backend/app/parsers/*.py`
- `backend/app/services/confidence_scoring.py`

语义支持：
- declared / observed / inferred edges
- fallback / retry loop
- unresolved symbols + confidence

---

## 11) 自调试工具链 | Self-Debug Toolchain

仓库内置调试流程（面向 App 界面问题）：
- `AGENTS.md`
- `.agents/skills/frontend-repro`
- `.agents/skills/frontend-visual-debug`
- `.agents/skills/frontend-fix`
- `.agents/skills/frontend-regression`
- `.agents/skills/frontend-report`

目标：
1. 复现问题
2. 采集证据（截图/控制台/日志）
3. 根因分类
4. 最小修复
5. 回归验证
6. 输出修复报告

---

## 12) 测试与闭环验证 | Testing and Closure

### Parser regression
```bash
python -m unittest discover -s tests/parser -p "test_*.py" -v
python scripts/run_parser_retest.py
```

### App UI automation
```bash
npm --prefix frontend run e2e
npm --prefix frontend run build:clean
```

### Desktop shell smoke
```bash
npm --prefix desktop run test:smoke
```

### Full system closure test
```bash
python scripts/run_full_system_tests.py
```

输出：`docs/full-system-test-report.md`

---

## 13) 文档入口 | Docs Index

- `docs/architecture.md`
- `docs/product-ux.md`
- `docs/app-workbench-design.md`
- `docs/parser-test-plan.md`
- `docs/parser-test-results.md`
- `docs/parser-capability-summary.md`
- `docs/parser-fix-report-template.md`
- `docs/frontend-debug-playbook.md`
- `docs/frontend-fix-report-template.md`
- `docs/full-system-test-report.md`
- `docs/reference-notes.md`

---

## 14) 清理机制 | Cleanup Mechanism

```bash
python scripts/cleanup_refs.py --root . --targets refs --threshold-mb 200 --keep-list-file docs/parser-tested-keep.txt --delete-unlisted --dry-run
```

规则：
- 任意单个参考目录 > 200MB 必须删除
- 未列入保留清单且无测试价值目录可删除
- `refs/agent_drop` 作为运行时投递目录保留

---

## 15) 已知边界 | Known Boundaries

1. 当前桌面壳采用 Electron（为了与 Next.js + FastAPI 集成效率）。
2. 解析器是实用主义多策略方案，不是全语言 AST 完整编译器。
3. 极大规模拓扑尚未做聚类/分层折叠优化。

---

## 16) 后续扩展 | Future Extensions

- Tauri shell migration (reuse existing shell-service boundary)
- OTel / Jaeger / Phoenix / Langfuse adapters
- richer desktop shortcuts/menu integration
- CI pipeline for full-system closure tests

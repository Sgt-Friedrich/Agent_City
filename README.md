# Agent_City Desktop App

Agent_City ��һ����������Ӧ�ù���̨������ Agent ϵͳ��**�ܹ�����������ʱ׷�١����л����ӱ����ϡ��ط��뱨��ջ�**��  
Agent_City is a local desktop workbench for **architecture parsing, runtime tracing, city-style observability, diagnostics, replay, and reporting closure**.

---

## 1) �ⲻ����ͨ��ҳ | Why This Is Not a Typical Web Dashboard

**����**
- �������� App ����̨���������ڼ����˱��ط������״̬�����浼���ͳ��ڷ���·����
- ��ֻ�Ǿ�̬����ͼ��֧�� live/replay/diagnostics/parser analysis/reports ȫ��·��ͼ��
- ֧�ִӡ����� -> ׷�� -> ������� -> �޸��ع� -> ����������ıջ���

**English**
- This is a desktop app workbench with local service orchestration awareness and local report export.
- It is not a static topology graph; it provides live/replay/diagnostics/parser-analysis/reports views.
- It closes the loop from parse -> trace -> diagnose -> fix -> regression -> report.

---

## 2) �������� | Core Capabilities

1. **��̬�ܹ����� | Static Architecture Parsing**
- Topology Discovery + Normalizer
- Multi-language parsing (Python / TypeScript / Go / Rust / Java / C# / config)
- Provenance + confidence + graceful degradation

2. **����ʱ׷�� | Runtime Tracing**
- TraceEnvelope / SpanEvent / FlowEvent
- retry / fallback / error / rejection handling
- topology binding with declared/observed/inferred edges

3. **���л����� | City-style Visualization**
- district = module domain
- building = component
- road = dependency/runtime path
- flow = runtime data movement

4. **�����ط� | Diagnostics and Replay**
- slow/error/congested nodes
- unstable edges
- trace replay with timeline

5. **������������ | Parser Analysis**
- parser confidence, coverage, unresolved symbols, low-confidence edges

6. **�������� | Reports Center**
- parser/app/system report catalog
- document preview + export
- desktop file save/open actions

---

## 3) Ӧ����̬ | App Form

- Desktop shell: **Tauri**
- Workbench UI: Next.js + React + TypeScript + Tailwind + React Three Fiber + Zustand
- Local service: FastAPI + WebSocket

---

## 4) չʾ��ͼ | Screenshots

### Main Workbench (Desktop)
![Agent_City Dashboard Desktop](docs/screenshots/dashboard-desktop.png)

### Main Workbench (Mobile Preview)
![Agent_City Dashboard Mobile](docs/screenshots/dashboard-mobile.png)

### Replay View
![Agent_City Replay Desktop](docs/screenshots/replay-desktop.png)

---

## 5) Ӧ�ýṹ | Application Structure

```text
Agent_City/
  desktop/                     # Tauri desktop shell
    src-tauri/src/main.rs
    src-tauri/tauri.conf.json
    scripts/run-tauri.js
  frontend/                    # workbench UI
  backend/                     # local FastAPI service
  docs/                        # architecture/ux/reports
  tests/                       # parser regression tests
  scripts/                     # automation, cleanup, full-system tests
  .agents/                     # Codex self-debug workflow
```

---

## 6) ����̨��ͼ | Workbench Views

- `Overview`
- `Live`
- `Replay`
- `Diagnostics`
- `Parser Analysis`
- `Reports`

������Ϣ�ܹ���
- ������KPI + ģʽ״̬ + ���ط���״̬
- ��ࣺ���� + ����
- �в�������/����������
- �Ҳࣺ�����
- �ײ���ʱ����

---

## 7) ������ʽ | How To Run

### 7.1 ��װ���� | Install

```bash
npm --prefix frontend install
npm --prefix desktop install
python -m pip install -r backend/requirements.txt
```

### 7.2 ��������Ӧ�� | Start Desktop App

```bash
npm --prefix desktop run dev
```

����ǻ᳢�ԣ�
1. �������ڱ������е� frontend/backend ����
2. �����������Զ����𱾵ط���backend + frontend����

### 7.3 ��ѡ�������������ط��� | Optional standalone local services

```bash
# backend
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# frontend
npm --prefix frontend run dev
```

---

## 8) �Զ�����Ͷ��Ŀ¼ | Drop-in Parse Workflow

1. ����Ӧ�ú󣬽������� agent Ŀ¼���Ƶ���`refs/agent_drop/`
2. �����ڶ�����ʾ����������
3. ������ɺ��Զ��л� target ��չ�����й�����

---

## 9) ��˽ӿ� | Local Service APIs

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

## 10) �������ṹ | Parser Architecture

����ģ�飺
- `backend/app/services/topology_discovery.py`
- `backend/app/services/topology_normalizer.py`
- `backend/app/services/runtime_trace_resolver.py`
- `backend/app/services/topology_binding.py`
- `backend/app/parsers/*.py`
- `backend/app/services/confidence_scoring.py`

����֧�֣�
- declared / observed / inferred edges
- fallback / retry loop
- unresolved symbols + confidence

---

## 11) �Ե��Թ����� | Self-Debug Toolchain

�ֿ����õ������̣����� App �������⣩��
- `AGENTS.md`
- `.agents/skills/frontend-repro`
- `.agents/skills/frontend-visual-debug`
- `.agents/skills/frontend-fix`
- `.agents/skills/frontend-regression`
- `.agents/skills/frontend-report`

Ŀ�꣺
1. ��������
2. �ɼ�֤�ݣ���ͼ/����̨/��־��
3. �������
4. ��С�޸�
5. �ع���֤
6. ����޸�����

---

## 12) ������ջ���֤ | Testing and Closure

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

�����`docs/full-system-test-report.md`

---

## 13) �ĵ���� | Docs Index

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

## 14) �������� | Cleanup Mechanism

```bash
python scripts/cleanup_refs.py --root . --targets refs --threshold-mb 200 --keep-list-file docs/parser-tested-keep.txt --delete-unlisted --dry-run
```

����
- ���ⵥ���ο�Ŀ¼ > 200MB ����ɾ��
- δ���뱣���嵥���޲��Լ�ֵĿ¼��ɾ��
- `refs/agent_drop` ��Ϊ����ʱͶ��Ŀ¼����

---

## 15) ��֪�߽� | Known Boundaries

1. ��ǰ����ǲ��� Tauri��
2. ��������ʵ���������Է���������ȫ���� AST ������������
3. �����ģ������δ������/�ֲ��۵��Ż���

---

## 16) ������չ | Future Extensions

- OTel / Jaeger / Phoenix / Langfuse adapters
- richer desktop shortcuts/menu integration
- CI pipeline for full-system closure tests


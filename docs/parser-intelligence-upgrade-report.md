# Parser + Product 一次性改造报告

## 目标
将“先做 P0”改为一次性闭环交付：
- 解析器：配置识别、动态注册、unresolved 净化、可晋升 inferred、可解释置信度
- 产品层：Parser Analysis Fix Queue、Repositories 健康卡、Reports 可执行深链
- 桌面链路：修复 `app:smoke` 的 Tauri rename panic

## 本轮完成

### 1) 解析器能力增强（Backend）
- `backend/app/parsers/config_parser.py`
  - 增强 yaml/toml/json/.env 语义识别
  - 增加 config 角色提示和 unresolved config hint
- `backend/app/parsers/python_parser.py`
  - 增加 decorator / register / factory / plugin loader / mcp mount / toolset attach 模式
  - 增强动态导入识别（`importlib`, `__import__`, `entry_points`）
- `backend/app/services/topology_discovery.py`
  - unresolved 噪声过滤
  - reason 分级：`dynamic_runtime / missing_config / parser_rule_missing / ambiguous_symbol`
- `backend/app/services/confidence_scoring.py`
  - 输出可解释分项：`code / config / registry / runtime_consistency`
- `backend/app/services/topology_binding.py`
  - inferred edge 元数据增强：observation/error/retry/fallback/promotable
- `backend/app/services/platform_service.py`
  - Parser Analysis 增加：`confidence_breakdown`, `unresolved_details`, `promotable_edges`, `fix_queue`, `explainability_coverage`
  - 报告导出增加 Parser Fix Queue
- `backend/app/sources/intelligent_topology_source.py`
  - config evidence 注入组件与关系，提升 config coverage
- `backend/app/sources/repo_topology_source.py`
  - 非 Claude/Codex 的 generic 仓库改为委托 IntelligentTopologySource（不再退化为 3 节点模板）
  - 增加 generic 源的 `unresolved_hints` 透传

### 2) 产品层落地（Frontend）
- `frontend/components/analysis/ParserAnalysisCenter.tsx`
  - 增加 Confidence Breakdown / Fix Queue / Promotable Inferred Edges / Unresolved Details
- `frontend/components/analysis/RepositoriesCenter.tsx`
  - 新增“解析健康卡”：覆盖率、可晋升边、修复队列、直达动作
- `frontend/components/analysis/ReportsCenter.tsx`
  - parser 类报告新增“可执行修复队列”深链动作
- `frontend/components/city/BuildingNode.tsx`
- `frontend/components/city/CityScene.tsx`
- `frontend/components/panels/DetailDrawer.tsx`
  - 增加 explainability 展示（职责/输入/输出/协议）
- `frontend/types/schema.ts`
  - 同步新模型：`NodeExplainabilityProfile`, `UnresolvedSymbolDetail`, `ParserFixAction` 等
- `frontend/i18n/messages.ts`
  - 新增 zh/en 文案键（健康卡、修复队列、可执行动作）

### 3) 桌面启动稳定性修复
- `desktop/scripts/run-tauri.js`
  - `dev/smoke` 改为 `cargo run --manifest-path src-tauri/Cargo.toml`
  - 规避 Tauri CLI 在 Windows 下 rename `agent_city_desktop.exe -> Agent_City.exe` 的占用 panic

## 回归验证
- `npm run parser:test`：22/22 通过
- `npm run frontend:build`：通过
- `npm run app:smoke`：通过（无 rename panic）
- Hermes 回归（`refs/NousResearch__hermes-agent`）：
  - `source_coverage`: `{'config': True, 'registry': True, 'code': True}`
  - `parser_confidence`: `0.96 (A)`
  - `fix_queue`: 1 条（可执行）

## 额外新增测试
- `tests/parser/test_analysis_api.py`
  - 校验 parser analysis explainability 字段
  - 校验 analysis markdown 包含 Parser Fix Queue
- `tests/parser/test_topology_discovery.py`
  - 校验 unresolved 噪声过滤与 reason 分类
- `tests/parser/test_confidence_scoring.py`
  - 校验 confidence breakdown 与 source coverage 子项

## 剩余建议（非阻塞）
- 为 Repositories API 增加 per-target `health_snapshot`，减少前端推断逻辑
- 为 Reports artifact 增加结构化 `recommended_actions` 字段，减少正文正则抽取
- 将 Fix Queue 执行结果反馈写回 Job phase log，用于闭环追踪

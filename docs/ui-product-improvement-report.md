# UI Product Improvement Report

## 2026-05-17 Defect Fix Addendum

### 修复目标

本轮集中修复用户在桌面 App 真实使用中暴露的问题：自动模拟流误导、设置入口不统一、弹窗遮挡、中文切换回退、城市节点语义不可读、密集节点重叠、边线在缩放时丢失、搜索/过滤浮层过重。

### 关键修复

- 实时流默认改为 `codex_real_only`，只有 Codex 目标且检测到真实 Codex 活动时才推送流；非 Codex 目标不再误发模拟流。
- 顶部增加 flow/source 状态提示，明确当前是 `codex_real_only`、等待真实活动、手动暂停还是模拟模式。
- Settings 统一为顶端入口打开的玻璃浮层，不再同时存在主页面 settings 与浮窗 settings。
- 修复 Settings 浮层 z-index 与 pointer 关系，顶部按钮可关闭，浮层内容可点击，底层图层不会盖过菜单。
- Settings 保存增加本地路径与数值校验，避免旧配置/乱码路径导致保存失败后 UI 秒回退。
- 城市节点从 `RT/TL/MC` 缩写改为“语义角色 + 小徽标”的表达；hover 中保留技术名，避免丢失细节。
- dense district 支持自适应聚合/平衡/细节模式，缩放时自动切换；聚合节点显示模块数量。
- 信息传输线在缩小时不隐藏，只降低权重；静态边增加 lane offset/折线路径，减少重叠和毛线团。
- Search/Filter 浮层改为更短的两列密度，减少遮挡主画布。

### 验证结果

- `npm --prefix frontend run e2e:app -- --reporter=line frontend/tests/e2e/layout.spec.ts frontend/tests/e2e/locale.spec.ts`：PASS（2 passed）
- `npm --prefix frontend run e2e:app -- --reporter=line frontend/tests/e2e/responsive.spec.ts`：PASS（3 passed）
- `npm run app:smoke`：PASS（一键启动链路与 Tauri shell smoke 通过）
- `npm run parser:test`：PASS（22 tests）

### 剩余建议

- 继续把超大 Runtime / Tools district 做成“cluster drill-down”二级视图，而不是只在主城市内展开。
- 给每类 node 增加“职责摘要/可调用模块/证据来源”的 hover mini-inspector，进一步解决非开发者看不懂模块职责的问题。
- 把 App 主菜单升级为更完整的专业软件菜单栏：文件、视图、解析、诊断、报告、设置。

---
## 1) 本轮优化目标

基于产品/UX/视觉评审结论，执行一轮集中改善，目标是把 Agent_City 从“功能完整工作台”进一步推进到“可交付桌面产品”形态，重点覆盖：

- 产品闭环增强（导入 -> 解析 -> 诊断/回放 -> 报告）
- 导航与信息架构显性化
- 城市主画布可读性与噪音控制
- Repositories / Jobs / Reports / Settings 的动作闭环
- 文案与 i18n 一致性提升

## 2) 本轮问题摘要（按类别）

### A. 产品闭环问题
- 首次进入后“下一步”不够强流程。
- Repositories / Jobs / Reports 的动作链有能力但入口分散。

### B. 信息架构与导航问题
- 模式目标提示不够显式，用户切换模式后需要二次理解。
- 左侧过滤信息密度高，默认认知负担偏重。

### C. 交互与效率问题
- Inspector 在部分场景偏信息展示，不够“动作中枢”。
- 报告中心可读但“读完即行动”链路不够直接。

### D. 视觉与美术问题
- 城市图在复杂拓扑时仍可能噪音偏高。
- 面板风格总体统一，但状态呈现与信息主次还可更稳。

### E. 文案与国际化问题
- 少量术语与辅助文案风格不一致。
- 跨模块状态文字一致性仍有提升空间。

## 3) 改动清单（按 improvement 类型）

### A. Product Flow Improvements

1. 控制中心新增 Workflow Rail（任务轨道）
- 文件：`frontend/components/analysis/ControlCenterBar.tsx`
- 内容：
  - 新增 6 步闭环轨道（import / parse / topology / diagnostics / parser / report）
  - 显示流程进度百分比
  - 高亮下一步动作并支持一键跳转

2. 工作台模式显性化横幅
- 文件：`frontend/components/analysis/WorkspaceModeBanner.tsx`（新增）
- 文件：`frontend/components/DashboardApp.tsx`
- 内容：
  - 每种模式提供“目标说明 + 主动作”
  - 强化 Overview/Live/Replay/Diagnostics/Parser/Control 模式语义差异

3. 控制检查器补充下一步动作
- 文件：`frontend/components/analysis/ControlInspector.tsx`
- 内容：
  - 根据当前状态推荐下一步（导入/任务/诊断）

### B. Navigation & IA Improvements

1. 过滤面板分层
- 文件：`frontend/components/panels/FilterPanel.tsx`
- 内容：
  - 增加 Advanced Filters 折叠层
  - 默认保留任务导向与快速入口，降低首屏复杂度

2. Jobs 中心支持状态筛选
- 文件：`frontend/components/analysis/JobsCenter.tsx`
- 内容：
  - 增加 all/queued/running/failed/success/cancelled 筛选芯片
  - 增加失败数统计、快速跳转 reports/diagnostics

3. Reports 中心支持检索
- 文件：`frontend/components/analysis/ReportsCenter.tsx`
- 内容：
  - 增加报告检索输入（标题/分类/文件名）
  - 维持深链跳转并新增“打开报告生成任务”入口

### C. City Scene Improvements

1. 边密度控制（主画布降噪）
- 文件：`frontend/components/city/CityScene.tsx`
- 内容：
  - 新增 edge density 三档：focus / balanced / full
  - focus 档隐藏 suppressed 边，复杂图下优先可读性
  - overlay 显示边数量并支持切换密度

2. 模式驱动默认密度
- 文件：`frontend/components/city/CityScene.tsx`
- 内容：
  - overview 默认 focus
  - live/diagnostics/replay 默认 balanced

### D. Control Plane Module Improvements

1. Repositories 中心产品化增强
- 文件：`frontend/components/analysis/RepositoriesCenter.tsx`
- 内容：
  - 顶部新增统计（低置信度、就绪数、解析中）
  - 新增 quick actions（jobs/parser/diagnostics/reports）
  - 增加仓库路径复制动作

2. Settings 护栏体验增强
- 文件：`frontend/components/analysis/SettingsCenter.tsx`
- 内容：
  - 增加“恢复已保存值”动作
  - 表单校验失败时保留清晰反馈

3. Inspector 节点动作增强
- 文件：`frontend/components/panels/DetailDrawer.tsx`
- 内容：
  - 节点卡增加“诊断该节点 / 查看解析质量”动作
  - 缩短 node -> diagnostics / parser 路径

### E. Visual System & i18n Improvements

1. 视觉系统基础类补充
- 文件：`frontend/app/globals.css`
- 内容：
  - 新增 `workspace-card` 与 `status-pill` 基础风格类（后续可继续收敛）

2. 语言资源补齐
- 文件：`frontend/i18n/messages.ts`
- 内容：
  - 补充 workflow、mode banner、advanced filter、jobs/report/repositories 新增文案
  - 中英双语覆盖新增交互点

## 4) 修复前 / 修复后差异

### 修复前
- 模式差异依赖用户经验，不够显式。
- 过滤器默认信息密度高。
- 主画布复杂时边噪音偏高。
- Reports / Jobs / Repositories 间操作存在额外跳转成本。

### 修复后
- 模式目标 + 主动作可见化，切换后更易判断“该做什么”。
- 过滤器分层后，默认负担降低，进阶能力仍保留。
- 城市视图可按边密度控制可读性。
- 控制平面模块间动作链更短，闭环更清楚。

## 5) 验证结果

执行验证：

1. 前端构建
- `npm --prefix frontend run build`
- 结果：PASS

2. App UI 自动化
- `npm --prefix frontend run e2e:app`
- 结果：PASS（5 passed）

3. 解析回归单测
- `backend\\.venv\\Scripts\\python -m pytest tests/parser -q`
- 结果：PASS（16 passed）

4. 一键启动 smoke
- `npm run app:smoke`
- 结果：PASS（desktop shell + local service ready）

## 6) 仍未完全解决的问题

1. 大规模拓扑下仍缺聚类/抽样策略（当前通过边密度控制缓解）。
2. Parser Analysis 的非开发者解释层仍可进一步增强（业务影响与修复收益量化）。
3. 视觉系统 token 化尚未完全收敛到统一组件层（本轮属于增量收口）。

## 7) 下一轮建议

1. 引入“关键子图”与聚类视图，进一步解决复杂图可读性。
2. 将 mode banner 与 inspector actions 统一为“任务模板”。
3. 把 `workspace-card/status-pill` 扩展为完整视觉 token 体系并替换散落样式。
4. 增加报告到任务的半自动化动作（例如一键创建回归任务）。
5. 补充更细粒度的 i18n 质量检查（缺失 key、术语一致性、语气规范）。


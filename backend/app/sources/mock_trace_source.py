from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TraceScenario:
    scenario_id: str
    name: str
    user_input: str
    final_output: str


class MockTraceSource:
    def list_scenarios(self) -> list[TraceScenario]:
        return [
            TraceScenario(
                scenario_id="scenario_1",
                name="retrieval_chain",
                user_input="总结 Codex 与 Claude Code 在工具系统上的差异",
                final_output="已基于检索上下文给出差异总结，并附带关键模块映射。",
            ),
            TraceScenario(
                scenario_id="scenario_2",
                name="tool_chain",
                user_input="帮我执行命令并整理输出",
                final_output="命令执行完成，输出已结构化并写入响应。",
            ),
            TraceScenario(
                scenario_id="scenario_3",
                name="memory_guardrail_chain",
                user_input="回忆上一次会话并继续编辑方案",
                final_output="已合并会话记忆并通过安全检查后返回结果。",
            ),
            TraceScenario(
                scenario_id="scenario_4",
                name="retry_fallback_chain",
                user_input="调用工具失败时自动重试并回退",
                final_output="工具多次失败，系统已回退到降级路径返回可用结果。",
            ),
            TraceScenario(
                scenario_id="scenario_5",
                name="mcp_chain",
                user_input="通过 MCP 搜索并总结最新发布说明",
                final_output="MCP 搜索成功，结果经适配后完成生成。",
            ),
        ]

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Pattern


ROLE_HINTS: dict[str, list[str]] = {
    "agent": ["agent", "assistant", "worker", "handoff"],
    "sub_agent": ["subagent", "sub-agent", "delegate"],
    "planner": ["planner", "plan", "orchestr", "workflow", "graph", "router", "dispatch", "coordinator"],
    "retriever": ["retriev", "search", "query", "rag", "index"],
    "reranker": ["rerank", "ranker", "ranking"],
    "embedding": ["embed", "vectorize", "encoder", "embedding"],
    "memory": ["memory", "state", "cache", "history", "session", "store"],
    "tool": ["tool", "plugin", "action", "function", "shell", "command", "browser", "exec"],
    "mcp": ["mcp", "modelcontextprotocol", "rmcp"],
    "llm": ["llm", "model", "inference", "provider", "chatgpt", "openai", "anthropic", "completion"],
    "prompt": ["prompt", "template", "system_prompt", "instruction"],
    "guardrail": ["guard", "policy", "safety", "moderation", "rule", "sandbox", "approval"],
    "evaluator": ["eval", "judge", "score", "feedback", "metric", "test"],
    "runtime_node": ["runtime", "entry", "main", "cli", "server", "app", "transport", "gateway", "api"],
    "external": ["http", "client", "connector", "integration", "remote", "sdk", "service"],
}


@dataclass
class ParserSignal:
    role_scores: dict[str, float] = field(default_factory=dict)
    import_refs: list[str] = field(default_factory=list)
    registration_line: str | None = None
    unresolved_hints: list[str] = field(default_factory=list)


class LanguageParser:
    """Base lightweight parser for a language family."""

    name = "generic"
    extensions: set[str] = set()
    path_weight: float = 1.1
    content_weight: float = 0.25
    registration_patterns: tuple[Pattern[str], ...] = tuple()
    import_patterns: tuple[Pattern[str], ...] = tuple()
    dynamic_patterns: tuple[Pattern[str], ...] = tuple()

    def supports(self, suffix: str) -> bool:
        return suffix.lower() in self.extensions

    def parse(self, rel_path: str, content: str) -> ParserSignal:
        rel_lower = rel_path.lower()
        content_lower = content.lower()
        scores = self._score_roles(rel_lower, content_lower)
        imports = self._extract_imports(content)
        registration_line = self._find_registration_line(content)
        unresolved_hints = self._find_unresolved_hints(content)
        return ParserSignal(
            role_scores=scores,
            import_refs=imports,
            registration_line=registration_line,
            unresolved_hints=unresolved_hints,
        )

    def _score_roles(self, rel_lower: str, content_lower: str) -> dict[str, float]:
        scores: dict[str, float] = {}
        for role, hints in ROLE_HINTS.items():
            role_score = 0.0
            for hint in hints:
                if hint in rel_lower:
                    role_score += self.path_weight
                if hint in content_lower:
                    role_score += self.content_weight
            if role_score > 0:
                scores[role] = role_score

        # Strong entrypoint nudge for main/index files.
        if rel_lower.endswith(("/main.py", "/main.ts", "/main.rs", "/index.ts", "/index.js", "/main.go", "/main.java", "/program.cs")):
            scores["runtime_node"] = scores.get("runtime_node", 0.0) + 1.9

        return scores

    def _extract_imports(self, content: str) -> list[str]:
        refs: list[str] = []
        for line in content.splitlines()[:260]:
            stripped = line.strip()
            if not stripped:
                continue
            for pattern in self.import_patterns:
                match = pattern.search(stripped)
                if not match:
                    continue
                value = match.group(1).strip()
                if value:
                    refs.append(value)

        # Keep bounded output to avoid overfitting noisy files.
        return refs[:80]

    def _find_registration_line(self, content: str) -> str | None:
        for line in content.splitlines()[:280]:
            stripped = line.strip()
            if not stripped:
                continue
            if any(pattern.search(stripped) for pattern in self.registration_patterns):
                return stripped[:180]
        return None

    def _find_unresolved_hints(self, content: str) -> list[str]:
        hints: list[str] = []
        for line in content.splitlines()[:320]:
            stripped = line.strip()
            if not stripped:
                continue
            if any(pattern.search(stripped) for pattern in self.dynamic_patterns):
                hints.append(stripped[:180])
                if len(hints) >= 3:
                    break
        return hints


def compile_patterns(raw_patterns: list[str]) -> tuple[Pattern[str], ...]:
    return tuple(re.compile(pattern, re.IGNORECASE) for pattern in raw_patterns)

from __future__ import annotations

import re

from app.parsers.base import LanguageParser, ParserSignal, compile_patterns


class ConfigParser(LanguageParser):
    """Low-weight parser for config manifests and structured files."""

    name = "config"
    extensions = {".json", ".yaml", ".yml", ".toml", ".ini", ".env"}
    path_weight = 0.58
    content_weight = 0.14

    registration_patterns = compile_patterns(
        [
            r"workflow",
            r"graph",
            r"registry",
            r"planner",
            r"retriev",
            r"tool",
            r"mcp",
            r"guardrail",
            r"retry",
            r"fallback",
        ]
    )

    import_patterns = compile_patterns(
        [
            r"\"([A-Za-z0-9_./-]+)\"",
            r"^\s*([A-Za-z0-9_.-]+)\s*:\s*",
            r"^\s*([A-Za-z0-9_.-]+)\s*=",
        ]
    )

    dynamic_patterns = compile_patterns(
        [
            r"runtime_generated",
            r"dynamic",
            r"plugin_loader",
            r"register_dynamic",
            r"experimental",
        ]
    )

    ROLE_KEYWORD_PATTERNS: dict[str, tuple[re.Pattern[str], ...]] = {
        "planner": compile_patterns([r"\bplanner\b", r"\borchestrator\b", r"\bworkflow\b"]),
        "tool": compile_patterns([r"\btool(s)?\b", r"\btoolset(s)?\b", r"\bplugins?\b"]),
        "mcp": compile_patterns([r"\bmcp\b", r"\bmodel[_-]?context[_-]?protocol\b"]),
        "memory": compile_patterns([r"\bmemory\b", r"\bsession\b", r"\bstate\b"]),
        "retriever": compile_patterns([r"\bretriev", r"\brag\b", r"\bindex\b"]),
        "llm": compile_patterns([r"\bllm\b", r"\bmodel\b", r"\bprovider\b", r"\bcompletion\b"]),
        "guardrail": compile_patterns([r"\bguardrail\b", r"\bpolicy\b", r"\bsafety\b"]),
        "runtime_node": compile_patterns([r"\bruntime\b", r"\bgateway\b", r"\bserver\b"]),
    }

    def parse(self, rel_path: str, content: str) -> ParserSignal:
        signal = super().parse(rel_path=rel_path, content=content)
        content_lower = content.lower()

        # Config-oriented role nudge so we can recover topology from manifests.
        role_scores = dict(signal.role_scores)
        for role, patterns in self.ROLE_KEYWORD_PATTERNS.items():
            hits = 0
            for pattern in patterns:
                hits += len(pattern.findall(content_lower))
            if hits > 0:
                role_scores[role] = role_scores.get(role, 0.0) + min(3.0, hits * 0.26)

        unresolved_hints = list(signal.unresolved_hints)
        if "todo" in content_lower and "config" in content_lower:
            unresolved_hints.append("missing_config:todo markers found in config manifests")

        return ParserSignal(
            role_scores=role_scores,
            import_refs=signal.import_refs,
            registration_line=signal.registration_line,
            unresolved_hints=unresolved_hints[:6],
        )


class DocumentationParser(LanguageParser):
    """Documentation parser with strongly reduced influence to avoid overfitting."""

    name = "docs"
    extensions = {".md", ".rst", ".txt"}
    path_weight = 0.26
    content_weight = 0.06

    registration_patterns = compile_patterns(
        [
            r"\bregister\b",
            r"\bworkflow\b",
            r"\bgraph\b",
            r"\btool\b",
            r"\bmcp\b",
            r"\bmemory\b",
            r"\bplanner\b",
        ]
    )

    import_patterns = compile_patterns([])
    dynamic_patterns = compile_patterns([r"runtime generated", r"reflection", r"dynamic registration"])

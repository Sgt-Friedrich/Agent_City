from __future__ import annotations

from app.parsers.base import LanguageParser, compile_patterns


class ConfigParser(LanguageParser):
    """Low-weight parser for config manifests and structured files."""

    name = "config"
    extensions = {".json", ".yaml", ".yml", ".toml", ".ini"}
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
        ]
    )

    dynamic_patterns = compile_patterns([r"runtime_generated", r"dynamic"]) 


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

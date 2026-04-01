from __future__ import annotations

from app.parsers.base import LanguageParser, compile_patterns


class GoParser(LanguageParser):
    name = "go"
    extensions = {".go"}
    path_weight = 1.3
    content_weight = 0.24

    registration_patterns = compile_patterns(
        [
            r"Register[A-Za-z0-9_]+\(",
            r"New[A-Za-z0-9_]+Agent\(",
            r"Workflow",
            r"Tool",
            r"MCP",
            r"Guardrail",
        ]
    )

    import_patterns = compile_patterns(
        [
            r"^\s*import\s+\"([^\"]+)\"",
            r"^\s*\"([^\"]+)\"\s*$",
        ]
    )

    dynamic_patterns = compile_patterns(
        [
            r"reflect\.",
            r"plugin\.Open\(",
            r"go\s+func\(",
        ]
    )

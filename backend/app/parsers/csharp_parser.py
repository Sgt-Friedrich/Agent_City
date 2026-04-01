from __future__ import annotations

from app.parsers.base import LanguageParser, compile_patterns


class CSharpParser(LanguageParser):
    name = "csharp"
    extensions = {".cs"}
    path_weight = 1.24
    content_weight = 0.22

    registration_patterns = compile_patterns(
        [
            r"\[KernelFunction\]",
            r"\[Function\]",
            r"services\.Add",
            r"builder\.Services",
            r"Register[A-Za-z0-9_]+\(",
            r"Workflow",
            r"Planner",
        ]
    )

    import_patterns = compile_patterns(
        [
            r"^\s*using\s+([A-Za-z0-9_\.]+);",
            r"^\s*namespace\s+([A-Za-z0-9_\.]+)",
        ]
    )

    dynamic_patterns = compile_patterns(
        [
            r"Assembly\.Load",
            r"GetType\(",
            r"dynamic\b",
        ]
    )

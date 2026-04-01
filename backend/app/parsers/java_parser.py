from __future__ import annotations

from app.parsers.base import LanguageParser, compile_patterns


class JavaParser(LanguageParser):
    name = "java"
    extensions = {".java", ".kt", ".scala"}
    path_weight = 1.25
    content_weight = 0.22

    registration_patterns = compile_patterns(
        [
            r"@Component\b",
            r"@Service\b",
            r"@Bean\b",
            r"@Tool\b",
            r"@KernelFunction\b",
            r"register[A-Za-z0-9_]+\(",
            r"Workflow",
            r"Planner",
        ]
    )

    import_patterns = compile_patterns(
        [
            r"^\s*import\s+([A-Za-z0-9_\.]+);",
            r"^\s*package\s+([A-Za-z0-9_\.]+);",
        ]
    )

    dynamic_patterns = compile_patterns(
        [
            r"Class\.forName\(",
            r"reflection",
            r"ServiceLoader",
            r"Proxy\.newProxyInstance",
        ]
    )

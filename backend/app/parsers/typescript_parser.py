from __future__ import annotations

from app.parsers.base import LanguageParser, compile_patterns


class TypeScriptParser(LanguageParser):
    name = "typescript"
    extensions = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}
    path_weight = 1.25
    content_weight = 0.24

    registration_patterns = compile_patterns(
        [
            r"register[A-Za-z]+\(",
            r"create[A-Za-z]+Agent\(",
            r"toolRegistry",
            r"workflow",
            r"graph\.add(Node|Edge)",
            r"mcp",
            r"guardrail",
        ]
    )

    import_patterns = compile_patterns(
        [
            r"^\s*import\s+.*?from\s+['\"]([^'\"]+)['\"]",
            r"^\s*import\(\s*['\"]([^'\"]+)['\"]\s*\)",
            r"require\(\s*['\"]([^'\"]+)['\"]\s*\)",
        ]
    )

    dynamic_patterns = compile_patterns(
        [
            r"globalThis\[",
            r"Reflect\.",
            r"eval\(",
            r"Function\(",
            r"import\(\s*`",
        ]
    )

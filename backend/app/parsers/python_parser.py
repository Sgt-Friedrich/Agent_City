from __future__ import annotations

from app.parsers.base import LanguageParser, compile_patterns


class PythonParser(LanguageParser):
    name = "python"
    extensions = {".py"}
    path_weight = 1.35
    content_weight = 0.28

    registration_patterns = compile_patterns(
        [
            r"@tool\b",
            r"@agent\b",
            r"@[A-Za-z_][A-Za-z0-9_]*\.(register|attach|mount)\b",
            r"register_[a-z_]+\(",
            r"register\(",
            r"registry\.[a-z_]+\(",
            r"factory\(",
            r"plugin_loader",
            r"mount_mcp",
            r"attach_toolset",
            r"create_agent\(",
            r"ToolRegistry",
            r"workflow",
            r"graph",
            r"mcp",
        ]
    )

    import_patterns = compile_patterns(
        [
            r"^\s*from\s+([A-Za-z0-9_\.]+)\s+import\b",
            r"^\s*import\s+([A-Za-z0-9_\.]+)",
            r"importlib\.import_module\(\s*['\"]([^'\"]+)['\"]\s*\)",
            r"__import__\(\s*['\"]([^'\"]+)['\"]\s*\)",
            r"entry_points\(\)\.select\(\s*group=['\"]([^'\"]+)['\"]\s*\)",
        ]
    )

    dynamic_patterns = compile_patterns(
        [
            r"importlib\.import_module",
            r"getattr\(",
            r"setattr\(",
            r"eval\(",
            r"exec\(",
            r"pkgutil\.iter_modules",
            r"entry_points\(",
            r"load_plugins?",
            r"mount_mcp",
            r"attach_toolset",
        ]
    )

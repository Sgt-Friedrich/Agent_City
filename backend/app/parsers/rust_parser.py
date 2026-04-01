from __future__ import annotations

from app.parsers.base import LanguageParser, compile_patterns


class RustParser(LanguageParser):
    name = "rust"
    extensions = {".rs"}
    path_weight = 1.28
    content_weight = 0.23

    registration_patterns = compile_patterns(
        [
            r"register_[a-z_]+\(",
            r"impl\s+[A-Za-z0-9_]+",
            r"trait\s+[A-Za-z0-9_]+",
            r"workflow",
            r"tool",
            r"mcp",
        ]
    )

    import_patterns = compile_patterns(
        [
            r"^\s*use\s+([A-Za-z0-9_:]+)",
            r"^\s*mod\s+([A-Za-z0-9_]+)",
        ]
    )

    dynamic_patterns = compile_patterns(
        [
            r"libloading",
            r"dyn\s+",
            r"Any",
        ]
    )

from __future__ import annotations

from dataclasses import dataclass

from app.parsers.base import LanguageParser, ParserSignal
from app.parsers.config_parser import ConfigParser, DocumentationParser
from app.parsers.csharp_parser import CSharpParser
from app.parsers.go_parser import GoParser
from app.parsers.java_parser import JavaParser
from app.parsers.python_parser import PythonParser
from app.parsers.rust_parser import RustParser
from app.parsers.typescript_parser import TypeScriptParser


@dataclass
class ParserRegistry:
    parsers: list[LanguageParser]
    fallback: LanguageParser

    def parser_for_suffix(self, suffix: str) -> LanguageParser:
        normalized = suffix.lower()
        for parser in self.parsers:
            if parser.supports(normalized):
                return parser
        return self.fallback

    def parse(self, rel_path: str, suffix: str, content: str) -> ParserSignal:
        parser = self.parser_for_suffix(suffix)
        return parser.parse(rel_path=rel_path, content=content)


class GenericParser(LanguageParser):
    name = "generic"
    extensions = set()
    path_weight = 0.76
    content_weight = 0.13


def default_parser_registry() -> ParserRegistry:
    return ParserRegistry(
        parsers=[
            PythonParser(),
            TypeScriptParser(),
            GoParser(),
            RustParser(),
            JavaParser(),
            CSharpParser(),
            ConfigParser(),
            DocumentationParser(),
        ],
        fallback=GenericParser(),
    )

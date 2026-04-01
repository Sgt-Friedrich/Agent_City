from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.parsers.parser_registry import default_parser_registry  # noqa: E402


class LanguageParsersTest(unittest.TestCase):
    def setUp(self) -> None:
        self.registry = default_parser_registry()

    def test_typescript_workflow_signal(self) -> None:
        signal = self.registry.parse(
            rel_path="src/workflow/graph.ts",
            suffix=".ts",
            content="import { createWorkflow } from 'mastra'; graph.addNode('planner')",
        )
        self.assertGreater(signal.role_scores.get("planner", 0.0), 0)
        self.assertIsNotNone(signal.registration_line)

    def test_go_registry_signal(self) -> None:
        signal = self.registry.parse(
            rel_path="internal/agent/registry.go",
            suffix=".go",
            content='import "github.com/x/y"\nfunc init(){ RegisterTool("shell") }',
        )
        self.assertGreater(signal.role_scores.get("tool", 0.0), 0)
        self.assertTrue(any("github.com" in item for item in signal.import_refs))

    def test_java_annotation_signal(self) -> None:
        signal = self.registry.parse(
            rel_path="src/main/java/com/acme/AgentService.java",
            suffix=".java",
            content="@Service\npublic class AgentService { }",
        )
        self.assertGreater(signal.role_scores.get("agent", 0.0), 0)
        self.assertIsNotNone(signal.registration_line)


if __name__ == "__main__":
    unittest.main()

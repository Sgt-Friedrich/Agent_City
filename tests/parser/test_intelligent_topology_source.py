from __future__ import annotations

import shutil
import tempfile
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.sources.intelligent_topology_source import IntelligentTopologySource  # noqa: E402


class IntelligentTopologySourceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="agent_city_parser_"))

    def tearDown(self) -> None:
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_python_signals_outweigh_documentation_noise(self) -> None:
        (self.temp_dir / "src" / "planner").mkdir(parents=True, exist_ok=True)
        (self.temp_dir / "src" / "tools").mkdir(parents=True, exist_ok=True)
        (self.temp_dir / "docs").mkdir(parents=True, exist_ok=True)

        (self.temp_dir / "src" / "planner" / "orchestrator.py").write_text(
            """
import importlib

def register_agent():
    planner = AgentPlanner()
    return planner

def dynamic_loader(name: str):
    return importlib.import_module(name)
""".strip(),
            encoding="utf-8",
        )

        (self.temp_dir / "src" / "tools" / "registry.py").write_text(
            """
@tool
class ShellTool:
    pass
""".strip(),
            encoding="utf-8",
        )

        # This file intentionally contains many role words that should not dominate parsing.
        (self.temp_dir / "docs" / "README.md").write_text(
            """
planner llm mcp retriever memory guardrail prompt evaluator tool workflow graph
planner llm mcp retriever memory guardrail prompt evaluator tool workflow graph
""".strip(),
            encoding="utf-8",
        )

        source = IntelligentTopologySource(self.temp_dir, target_hint="unit", max_files=120)
        components = source.config_components()
        roles = {component["role"] for component in components}

        self.assertIn("planner", roles)
        self.assertIn("tool", roles)
        self.assertIn("runtime_node", roles)
        self.assertNotIn("mcp", roles, "mcp should not be inferred from docs-only weak signals")

        hints = source.unresolved_hints()
        self.assertTrue(any("importlib.import_module" in hint for hint in hints))


if __name__ == "__main__":
    unittest.main()

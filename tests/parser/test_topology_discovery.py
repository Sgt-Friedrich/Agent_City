from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.topology_discovery import TopologyDiscovery  # noqa: E402


class StubSource:
    def config_components(self):
        return [
            {
                "id": "node.entry",
                "name": "Entry",
                "role": "runtime_node",
                "summary": "entry",
                "source_type": "agent_config",
                "source_location": "runtime/main.py",
                "tags": ["entry"],
                "metadata": {"weight": 1.0},
            }
        ]

    def workflow_relations(self):
        return []

    def python_registration_snippets(self):
        return []

    def unresolved_hints(self):
        return [
            "dynamic registration encountered",
            "dynamic_runtime:importlib.import_module(plugin_name)",
            "config/app.yaml missing key",
            "# comment should be ignored",
            "\"this is a long documentation sentence that should not become unresolved symbol noise\"",
        ]


class TopologyDiscoveryTest(unittest.TestCase):
    def test_discovery_includes_confidence_and_unresolved(self) -> None:
        discovery = TopologyDiscovery(StubSource()).discover()

        self.assertIsNotNone(discovery.parser_confidence)
        self.assertIsNotNone(discovery.parser_grade)
        unresolved = " ".join(discovery.unresolved_symbols)
        self.assertIn("dynamic_runtime", unresolved)
        self.assertIn("missing_config", unresolved)
        self.assertNotIn("# comment", unresolved)
        self.assertNotIn("dynamic_runtime:dynamic_runtime", unresolved)


if __name__ == "__main__":
    unittest.main()

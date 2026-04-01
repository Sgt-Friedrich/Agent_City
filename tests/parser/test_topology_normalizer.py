from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.models.schemas import DiscoveryResult, RawComponent, RawRelation  # noqa: E402
from app.services.topology_normalizer import TopologyNormalizer  # noqa: E402


class TopologyNormalizerTest(unittest.TestCase):
    def test_creates_provisional_node_for_unresolved_relation_endpoint(self) -> None:
        discovery = DiscoveryResult(
            components=[
                RawComponent(
                    id="node.entry",
                    name="Entry",
                    role="runtime_node",
                    summary="entry",
                    source_type="unit",
                    source_location="/tmp/entry.py",
                )
            ],
            relations=[
                RawRelation(
                    id="edge.entry_missing",
                    source="node.entry",
                    target="node.unknown_tool",
                    relation_type="dependency",
                    protocol="internal/http+json",
                    confidence=0.8,
                )
            ],
            parser_confidence=0.51,
            parser_grade="C",
            unresolved_symbols=["missing core roles: llm, planner, tool"],
            source_coverage={"config": False, "registry": True, "code": True},
        )

        topology = TopologyNormalizer().normalize(discovery)

        node_ids = {node.id for node in topology.nodes}
        self.assertIn("node.unknown_tool", node_ids)

        provisional = next(node for node in topology.nodes if node.id == "node.unknown_tool")
        self.assertEqual(provisional.status, "idle")
        self.assertTrue("provisional" in provisional.labels)

        self.assertEqual(topology.metadata["parser_grade"], "C")
        self.assertIn("missing core roles", " ".join(topology.metadata["unresolved_symbols"]))


if __name__ == "__main__":
    unittest.main()

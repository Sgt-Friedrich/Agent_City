from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.models.schemas import RawComponent, RawRelation  # noqa: E402
from app.services.confidence_scoring import ConfidenceScoringService  # noqa: E402


class ConfidenceScoringServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.scorer = ConfidenceScoringService()

    def test_low_confidence_when_core_roles_missing(self) -> None:
        components = [
            RawComponent(
                id="node.entry",
                name="Entry",
                role="runtime_node",
                summary="entry",
                source_type="intelligent_repo_scan",
                source_location="/tmp/main.py",
                metadata={"synthetic": True},
            )
        ]

        score = self.scorer.score(components=components, relations=[], snippet_count=0)

        self.assertLess(score.score, 0.6)
        self.assertIn("missing core roles", " ".join(score.unresolved_symbols))
        self.assertIn(score.grade, {"C", "D"})
        self.assertIn("runtime_consistency", score.breakdown)
        self.assertIn("code", score.breakdown)

    def test_higher_confidence_with_core_roles_and_relations(self) -> None:
        components = [
            RawComponent(
                id="node.runtime",
                name="Runtime",
                role="runtime_node",
                summary="runtime",
                source_type="agent_config",
                source_location="/tmp/main.py",
            ),
            RawComponent(
                id="node.planner",
                name="Planner",
                role="planner",
                summary="planner",
                source_type="workflow_graph",
                source_location="/tmp/graph.yaml",
            ),
            RawComponent(
                id="node.tool",
                name="Tool",
                role="tool",
                summary="tool",
                source_type="tool_registry",
                source_location="/tmp/tools.py",
            ),
            RawComponent(
                id="node.llm",
                name="LLM",
                role="llm",
                summary="llm",
                source_type="llm_config",
                source_location="/tmp/model.yaml",
            ),
        ]
        relations = [
            RawRelation(
                id="edge.runtime.planner",
                source="node.runtime",
                target="node.planner",
                relation_type="invocation",
                protocol="internal/http+json",
                confidence=0.9,
                inferred_from=["semantic:entry->planner"],
            ),
            RawRelation(
                id="edge.planner.tool",
                source="node.planner",
                target="node.tool",
                relation_type="invocation",
                protocol="tool-call",
                confidence=0.9,
                inferred_from=["registry"],
            ),
            RawRelation(
                id="edge.planner.llm",
                source="node.planner",
                target="node.llm",
                relation_type="invocation",
                protocol="internal/http+json",
                confidence=0.9,
                inferred_from=["workflow"],
            ),
        ]

        score = self.scorer.score(components=components, relations=relations, snippet_count=3)

        self.assertGreaterEqual(score.score, 0.68)
        self.assertIn(score.grade, {"A", "B"})
        self.assertEqual(score.source_coverage["code"], True)
        self.assertEqual(score.source_coverage["config"], True)
        self.assertEqual(score.source_coverage["registry"], True)


if __name__ == "__main__":
    unittest.main()

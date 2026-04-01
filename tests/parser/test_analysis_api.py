from __future__ import annotations

import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app  # noqa: E402


class AnalysisApiTest(unittest.TestCase):
    def test_parser_analysis_edge_alias_fields(self) -> None:
        with TestClient(app) as client:
            response = client.get("/api/analysis/parser", params={"target": "mock"})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("low_confidence_edges", payload)

        edges = payload["low_confidence_edges"]
        if edges:
            first = edges[0]
            # API responses must expose the normalized edge schema (`from`/`to`),
            # so frontend consumers do not need to branch on backend internals.
            self.assertIn("from", first)
            self.assertIn("to", first)
            self.assertNotIn("from_node", first)
            self.assertNotIn("to_node", first)


if __name__ == "__main__":
    unittest.main()

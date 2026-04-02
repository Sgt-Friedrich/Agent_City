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


class TopologyPreviewApiTest(unittest.TestCase):
    def test_target_preview_returns_parse_summary(self) -> None:
        repo_path = str((ROOT / "frontend").resolve())
        with TestClient(app) as client:
            response = client.post(
                "/api/targets/preview",
                json={"repo_path": repo_path},
            )

        self.assertEqual(response.status_code, 200)
        preview = response.json()["preview"]
        self.assertEqual(preview["repo_path"], repo_path)
        self.assertIn("source_type", preview)
        self.assertIn("language_hints", preview)
        self.assertIn("framework_hints", preview)
        self.assertGreaterEqual(preview["node_count"], 1)
        self.assertGreaterEqual(preview["edge_count"], 0)
        self.assertGreaterEqual(preview["parser_confidence"], 0.0)
        self.assertLessEqual(preview["parser_confidence"], 1.0)


if __name__ == "__main__":
    unittest.main()


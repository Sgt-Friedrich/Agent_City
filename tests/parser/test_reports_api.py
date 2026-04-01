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


class ReportsApiTest(unittest.TestCase):
    def test_reports_catalog_and_content(self) -> None:
        with TestClient(app) as client:
            catalog = client.get("/api/reports")
            self.assertEqual(catalog.status_code, 200)
            payload = catalog.json()
            self.assertIn("items", payload)
            self.assertGreater(len(payload["items"]), 0)

            first_id = payload["items"][0]["id"]
            content = client.get(f"/api/reports/{first_id}")
            self.assertEqual(content.status_code, 200)
            content_payload = content.json()
            self.assertIn("artifact", content_payload)
            self.assertIn("content", content_payload)
            self.assertIsInstance(content_payload["content"], str)


if __name__ == "__main__":
    unittest.main()

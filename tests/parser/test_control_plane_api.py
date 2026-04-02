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


class ControlPlaneApiTest(unittest.TestCase):
    def test_repositories_runtime_and_settings(self) -> None:
        with TestClient(app) as client:
            repo_resp = client.get("/api/control/repositories")
            runtime_resp = client.get("/api/control/runtime")
            settings_resp = client.get("/api/control/settings")
            update_resp = client.put("/api/control/settings", json={"language": "zh"})
            updated_settings_resp = client.get("/api/control/settings")
            reset_resp = client.put("/api/control/settings", json={"language": "en"})

        self.assertEqual(repo_resp.status_code, 200)
        self.assertIn("items", repo_resp.json())
        self.assertEqual(runtime_resp.status_code, 200)
        self.assertIn("runtime", runtime_resp.json())
        self.assertEqual(settings_resp.status_code, 200)
        self.assertIn("settings", settings_resp.json())
        self.assertEqual(update_resp.status_code, 200)
        self.assertEqual(update_resp.json()["settings"]["language"], "zh")
        self.assertEqual(updated_settings_resp.status_code, 200)
        self.assertEqual(updated_settings_resp.json()["settings"]["language"], "zh")
        self.assertEqual(reset_resp.status_code, 200)

    def test_run_control_job(self) -> None:
        with TestClient(app) as client:
            run_resp = client.post(
                "/api/control/jobs",
                json={
                    "type": "live_simulation",
                    "target": "mock",
                    "payload": {"count": 1},
                },
            )
            list_resp = client.get("/api/control/jobs")

        self.assertEqual(run_resp.status_code, 200)
        job = run_resp.json()["job"]
        self.assertIn(job["status"], {"queued", "running", "success"})
        self.assertEqual(list_resp.status_code, 200)
        self.assertGreaterEqual(list_resp.json()["count"], 1)


if __name__ == "__main__":
    unittest.main()

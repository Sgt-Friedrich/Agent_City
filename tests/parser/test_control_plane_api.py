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
            update_resp = client.put(
                "/api/control/settings",
                json={"language": "zh", "live_flow_mode": "codex_real_only", "codex_activity_poll_sec": 1.2},
            )
            updated_settings_resp = client.get("/api/control/settings")
            reset_resp = client.put(
                "/api/control/settings",
                json={"language": "en", "live_flow_mode": "always_simulated", "codex_activity_poll_sec": 1.8},
            )

        self.assertEqual(repo_resp.status_code, 200)
        self.assertIn("items", repo_resp.json())
        self.assertEqual(runtime_resp.status_code, 200)
        self.assertIn("runtime", runtime_resp.json())
        self.assertEqual(settings_resp.status_code, 200)
        self.assertIn("settings", settings_resp.json())
        self.assertEqual(update_resp.status_code, 200)
        self.assertEqual(update_resp.json()["settings"]["language"], "zh")
        self.assertEqual(update_resp.json()["settings"]["live_flow_mode"], "codex_real_only")
        self.assertEqual(updated_settings_resp.status_code, 200)
        self.assertEqual(updated_settings_resp.json()["settings"]["language"], "zh")
        self.assertEqual(updated_settings_resp.json()["settings"]["live_flow_mode"], "codex_real_only")
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

    def test_update_settings_validation_guardrails(self) -> None:
        with TestClient(app) as client:
            invalid_path_resp = client.put(
                "/api/control/settings",
                json={"workspace_dir": "relative/path"},
            )
            invalid_threshold_resp = client.put(
                "/api/control/settings",
                json={"cleanup_threshold_mb": 5},
            )
            invalid_mode_resp = client.put(
                "/api/control/settings",
                json={"live_flow_mode": "unknown_mode"},
            )
            invalid_poll_resp = client.put(
                "/api/control/settings",
                json={"codex_activity_poll_sec": 0.1},
            )

        self.assertEqual(invalid_path_resp.status_code, 422)
        self.assertIn("absolute path is required", invalid_path_resp.json().get("detail", ""))
        self.assertEqual(invalid_threshold_resp.status_code, 422)
        self.assertIn("must be between 50 and 5000", invalid_threshold_resp.json().get("detail", ""))
        self.assertEqual(invalid_mode_resp.status_code, 422)
        self.assertIn("live_flow_mode", str(invalid_mode_resp.json()))
        self.assertEqual(invalid_poll_resp.status_code, 422)
        self.assertIn("codex_activity_poll_sec", invalid_poll_resp.json().get("detail", ""))


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.models.schemas import LiveFlowMode  # noqa: E402
from app.services.runtime_activity_gate import RuntimeActivityGate  # noqa: E402


class RuntimeActivityGateTest(unittest.TestCase):
    def test_always_simulated_mode_emits(self) -> None:
        gate = RuntimeActivityGate(codex_probe=lambda: (False, "waiting_codex"))
        emit, reason = gate.should_emit(target="codex", mode=LiveFlowMode.ALWAYS_SIMULATED)
        self.assertTrue(emit)
        self.assertEqual(reason, "always_simulated")

    def test_manual_mode_pauses(self) -> None:
        gate = RuntimeActivityGate(codex_probe=lambda: (True, "codex_active"))
        emit, reason = gate.should_emit(target="codex", mode=LiveFlowMode.MANUAL)
        self.assertFalse(emit)
        self.assertEqual(reason, "manual_pause")

    def test_codex_real_only_for_codex_target(self) -> None:
        gate = RuntimeActivityGate(codex_probe=lambda: (False, "waiting_codex"))
        emit, reason = gate.should_emit(target="codex", mode=LiveFlowMode.CODEX_REAL_ONLY)
        self.assertFalse(emit)
        self.assertEqual(reason, "waiting_codex")

    def test_codex_real_only_non_codex_target_not_blocked(self) -> None:
        gate = RuntimeActivityGate(codex_probe=lambda: (False, "waiting_codex"))
        emit, reason = gate.should_emit(target="mock", mode=LiveFlowMode.CODEX_REAL_ONLY)
        self.assertTrue(emit)
        self.assertEqual(reason, "mode_not_applicable")


if __name__ == "__main__":
    unittest.main()


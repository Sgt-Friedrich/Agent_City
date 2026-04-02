from __future__ import annotations

import json
import subprocess
import sys
import time
from threading import RLock
from typing import Callable, Tuple

from app.models.schemas import LiveFlowMode

ProbeResult = Tuple[bool, str]


class RuntimeActivityGate:
    """Gate websocket live flow based on configured runtime activity strategy."""

    def __init__(
        self,
        poll_interval_sec: float = 1.8,
        codex_probe: Callable[[], ProbeResult] | None = None,
    ) -> None:
        self._poll_interval_sec = max(0.5, float(poll_interval_sec))
        self._codex_probe = codex_probe or self._probe_codex_activity
        self._lock = RLock()
        self._last_checked = 0.0
        self._last_result: ProbeResult = (False, "idle")
        self._cpu_samples: dict[int, float] = {}

    def set_poll_interval(self, poll_interval_sec: float) -> None:
        with self._lock:
            self._poll_interval_sec = max(0.5, float(poll_interval_sec))

    def should_emit(self, *, target: str, mode: LiveFlowMode) -> ProbeResult:
        if mode == LiveFlowMode.ALWAYS_SIMULATED:
            return True, "always_simulated"
        if mode == LiveFlowMode.MANUAL:
            return False, "manual_pause"
        if target != "codex":
            return True, "mode_not_applicable"
        return self._probe_codex_activity_cached()

    def _probe_codex_activity_cached(self) -> ProbeResult:
        now = time.monotonic()
        with self._lock:
            if (now - self._last_checked) < self._poll_interval_sec:
                return self._last_result

        result = self._codex_probe()
        with self._lock:
            self._last_checked = now
            self._last_result = result
        return result

    def _probe_codex_activity(self) -> ProbeResult:
        try:
            if sys.platform.startswith("win"):
                return self._probe_codex_activity_windows()
            return self._probe_codex_activity_unix()
        except Exception as exc:  # pragma: no cover - defensive guard
            return False, f"probe_error:{exc}"

    def _probe_codex_activity_windows(self) -> ProbeResult:
        script = (
            "$selfPid=$PID; "
            "$matches = Get-CimInstance Win32_Process | "
            "Where-Object { "
            "$_.ProcessId -ne $selfPid -and "
            "(($_.Name -match '(?i)codex') -or ($_.CommandLine -match '(?i)\\bcodex\\b')) -and "
            "($_.CommandLine -notmatch '(?i)agent-city|start-app\\.js|run-tauri\\.js|uvicorn') "
            "}; "
            "$result = @(); "
            "foreach ($m in $matches) { "
            "$p = Get-Process -Id $m.ProcessId -ErrorAction SilentlyContinue; "
            "if ($null -ne $p) { "
            "$cpu = 0.0; if ($null -ne $p.CPU) { $cpu = [double]$p.CPU }; "
            "$result += [PSCustomObject]@{ pid=[int]$m.ProcessId; cpu=$cpu } "
            "} "
            "}; "
            "$result | ConvertTo-Json -Compress"
        )
        completed = subprocess.run(
            ["powershell", "-NoProfile", "-Command", script],
            capture_output=True,
            text=True,
            timeout=3,
            shell=False,
        )
        if completed.returncode != 0:
            return False, "probe_error"
        raw = (completed.stdout or "").strip()
        if not raw:
            self._cpu_samples.clear()
            return False, "waiting_codex_process"

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            self._cpu_samples.clear()
            return False, "probe_error"

        records = parsed if isinstance(parsed, list) else [parsed]
        if not records:
            self._cpu_samples.clear()
            return False, "waiting_codex_process"

        threshold = 0.03
        active = False
        next_samples: dict[int, float] = {}
        max_delta = 0.0

        for item in records:
            try:
                pid = int(item.get("pid", 0))
                cpu_total = float(item.get("cpu", 0.0))
            except Exception:
                continue
            if pid <= 0:
                continue
            next_samples[pid] = cpu_total
            previous = self._cpu_samples.get(pid)
            if previous is None:
                continue
            delta = max(0.0, cpu_total - previous)
            max_delta = max(max_delta, delta)
            if delta >= threshold:
                active = True

        self._cpu_samples = next_samples
        if active:
            return True, "codex_active_cpu"
        if max_delta > 0:
            return False, "waiting_codex_cpu_low"
        if next_samples:
            return False, "waiting_codex_baseline"
        return False, "waiting_codex_process"

    def _probe_codex_activity_unix(self) -> ProbeResult:
        completed = subprocess.run(
            [
                "sh",
                "-lc",
                "ps -Ao pid,pcpu,command | grep -Ei '\\bcodex\\b' | grep -Evi 'grep|agent-city|uvicorn'",
            ],
            capture_output=True,
            text=True,
            timeout=3,
            shell=False,
        )
        if completed.returncode not in {0, 1}:
            return False, "probe_error"
        rows = [line.strip() for line in (completed.stdout or "").splitlines() if line.strip()]
        if not rows:
            return False, "waiting_codex_process"
        for row in rows:
            parts = row.split(maxsplit=2)
            if len(parts) < 3:
                continue
            try:
                cpu_pct = float(parts[1])
            except ValueError:
                continue
            if cpu_pct >= 2.0:
                return True, "codex_active_cpu"
        return False, "waiting_codex_cpu_low"

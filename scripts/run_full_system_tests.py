from __future__ import annotations

import json
import locale
import os
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from shutil import which


@dataclass
class CommandResult:
    name: str
    command: list[str]
    ok: bool
    duration_s: float
    output: str


def run_command(name: str, command: list[str], cwd: Path) -> CommandResult:
    executable = command[0]
    if executable == "python":
        command = [sys.executable, *command[1:]]
    elif executable in {"npm", "npm.cmd"}:
        npm_exec = which("npm") or which("npm.cmd")
        if npm_exec:
            command = [npm_exec, *command[1:]]

    started = datetime.now(timezone.utc)
    process = subprocess.run(
        command,
        cwd=cwd,
        env=os.environ.copy(),
        text=False,
        capture_output=True,
        shell=False,
    )
    ended = datetime.now(timezone.utc)
    duration = (ended - started).total_seconds()
    output = (process.stdout or b"") + (process.stderr or b"")
    preferred = locale.getpreferredencoding(False)
    decoded_output = ""
    for encoding in ("utf-8", preferred, "gbk", "latin-1"):
        try:
            decoded_output = output.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if not decoded_output:
        decoded_output = output.decode("utf-8", errors="replace")
    return CommandResult(
        name=name,
        command=command,
        ok=process.returncode == 0,
        duration_s=duration,
        output=decoded_output.strip(),
    )


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    docs = root / "docs"
    docs.mkdir(parents=True, exist_ok=True)

    checks = [
        ("Backend compile", ["python", "-m", "compileall", "backend/app"]),
        (
            "Parser unit tests",
            ["python", "-m", "unittest", "discover", "-s", "tests/parser", "-p", "test_*.py", "-v"],
        ),
        ("Parser representative retest", ["python", "scripts/run_parser_retest.py"]),
        ("Frontend build", ["npm", "--prefix", "frontend", "run", "build:clean"]),
        ("App UI automation tests", ["npm", "--prefix", "frontend", "run", "e2e"]),
        ("Desktop shell smoke", ["npm", "--prefix", "desktop", "run", "test:smoke"]),
        (
            "Reference cleanup dry-run",
            [
                "python",
                "scripts/cleanup_refs.py",
                "--root",
                ".",
                "--targets",
                "refs",
                "--threshold-mb",
                "200",
                "--keep-list-file",
                "docs/parser-tested-keep.txt",
                "--delete-unlisted",
                "--dry-run",
            ],
        ),
    ]

    results: list[CommandResult] = []
    for name, command in checks:
        result = run_command(name=name, command=command, cwd=root)
        results.append(result)

    generated_at = datetime.now(timezone.utc)
    failed = [item for item in results if not item.ok]

    lines = [
        "# Full System Test Report",
        "",
        f"Generated at (UTC): {generated_at.isoformat()}",
        "",
        "## Summary",
        f"- Total checks: {len(results)}",
        f"- Passed: {len(results) - len(failed)}",
        f"- Failed: {len(failed)}",
        "",
        "## Results",
    ]

    for item in results:
        status = "PASS" if item.ok else "FAIL"
        cmd = " ".join(item.command)
        lines.extend(
            [
                f"### {item.name}",
                f"- Status: {status}",
                f"- Duration: {item.duration_s:.2f}s",
                f"- Command: `{cmd}`",
                "- Output:",
                "```text",
                (item.output or "(no output)")[:12000],
                "```",
                "",
            ]
        )

    report_path = docs / "full-system-test-report.md"
    report_path.write_text("\n".join(lines), encoding="utf-8")

    summary = {
        "generated_at": generated_at.isoformat(),
        "total": len(results),
        "failed": len(failed),
        "report": str(report_path),
    }
    print(json.dumps(summary, ensure_ascii=False))

    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

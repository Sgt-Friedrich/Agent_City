#!/usr/bin/env python3
"""Cleanup helper for temporary/reference repositories.

Scans configured reference roots (for example refs/tmp/external_examples),
prints directory sizes, and removes directories above a threshold.
"""

from __future__ import annotations

import argparse
import shutil
from dataclasses import dataclass
from pathlib import Path


@dataclass
class DirEntry:
    path: Path
    bytes_size: int

    @property
    def size_mb(self) -> float:
        return self.bytes_size / (1024 * 1024)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scan and cleanup large reference directories.")
    parser.add_argument(
        "--root",
        default=".",
        help="Project root (default: current directory).",
    )
    parser.add_argument(
        "--targets",
        nargs="*",
        default=["refs", "tmp", "external_examples"],
        help="Target parent directories relative to --root.",
    )
    parser.add_argument(
        "--threshold-mb",
        type=float,
        default=200,
        help="Delete threshold in MB (default: 200).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only print actions without deleting directories.",
    )
    return parser.parse_args()


def dir_size_bytes(path: Path) -> int:
    total = 0
    for item in path.rglob("*"):
        try:
            if item.is_file():
                total += item.stat().st_size
        except OSError:
            # Skip unreadable files to keep cleanup resilient.
            continue
    return total


def collect_directories(root: Path, target_dirs: list[str]) -> list[Path]:
    candidates: list[Path] = []
    for rel in target_dirs:
        base = (root / rel).resolve()
        if not base.exists() or not base.is_dir():
            continue
        for child in base.iterdir():
            if child.is_dir():
                candidates.append(child)
    return sorted(candidates)


def scan(root: Path, target_dirs: list[str]) -> list[DirEntry]:
    dirs = collect_directories(root, target_dirs)
    entries: list[DirEntry] = []
    for path in dirs:
        entries.append(DirEntry(path=path, bytes_size=dir_size_bytes(path)))
    return sorted(entries, key=lambda item: item.bytes_size, reverse=True)


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    threshold_bytes = int(args.threshold_mb * 1024 * 1024)

    entries = scan(root, args.targets)

    print(f"[cleanup_refs] root={root}")
    print(f"[cleanup_refs] targets={args.targets}")
    print(f"[cleanup_refs] threshold={args.threshold_mb:.1f}MB dry_run={args.dry_run}")

    if not entries:
        print("[cleanup_refs] no reference directories found.")
        return 0

    removed = 0
    kept = 0
    for entry in entries:
        status = "DELETE" if entry.bytes_size > threshold_bytes else "KEEP"
        print(f"[{status}] {entry.size_mb:9.2f} MB  {entry.path}")

        if entry.bytes_size > threshold_bytes:
            if args.dry_run:
                continue
            shutil.rmtree(entry.path, ignore_errors=True)
            removed += 1
        else:
            kept += 1

    if args.dry_run:
        print("[cleanup_refs] dry-run complete.")
    else:
        print(f"[cleanup_refs] complete. removed={removed} kept={kept}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

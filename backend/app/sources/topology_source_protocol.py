from __future__ import annotations

from typing import Any, Protocol


class TopologySignalSource(Protocol):
    def config_components(self) -> list[dict[str, Any]]:
        ...

    def workflow_relations(self) -> list[dict[str, Any]]:
        ...

    def python_registration_snippets(self) -> list[dict[str, Any]]:
        ...

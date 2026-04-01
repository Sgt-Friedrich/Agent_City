from __future__ import annotations

from abc import ABC, abstractmethod
from typing import AsyncIterator

from app.models.schemas import AdapterCapabilities, FlowEvent, TraceRecord


class TelemetryAdapter(ABC):
    """Interface for pluggable telemetry backends (OTel/Jaeger/Langfuse/Phoenix)."""

    @abstractmethod
    def capabilities(self) -> AdapterCapabilities:
        raise NotImplementedError

    @abstractmethod
    def list_traces(self) -> list[TraceRecord]:
        raise NotImplementedError

    @abstractmethod
    async def stream_flow_events(self) -> AsyncIterator[FlowEvent]:
        raise NotImplementedError


class MockTelemetryAdapter(TelemetryAdapter):
    def capabilities(self) -> AdapterCapabilities:
        return AdapterCapabilities(
            name="mock",
            supports_streaming=True,
            supports_payload_detail=True,
            supports_metrics=True,
        )

    def list_traces(self) -> list[TraceRecord]:
        return []

    async def stream_flow_events(self) -> AsyncIterator[FlowEvent]:
        if False:
            yield  # pragma: no cover

from __future__ import annotations

import asyncio
import random
from typing import AsyncIterator

from app.models.schemas import BoundTrace


class LiveEventGenerator:
    """Turns a bound trace into streamed websocket messages."""

    async def stream_trace(self, bound_trace: BoundTrace) -> AsyncIterator[dict]:
        trace = bound_trace.trace

        yield {
            "type": "trace_started",
            "trace": trace.envelope.model_dump(mode="json"),
        }

        for idx, span in enumerate(trace.spans):
            # Simulate inter-span transport time to make flow replay visible.
            await asyncio.sleep(max(0.18, min(1.0, span.latency_ms / 2400)))
            yield {
                "type": "flow_event",
                "trace_id": trace.envelope.trace_id,
                "span": span.model_dump(mode="json"),
                "binding": bound_trace.bindings[idx].model_dump(mode="json"),
            }

        await asyncio.sleep(random.uniform(0.08, 0.25))
        yield {
            "type": "trace_completed",
            "trace": trace.envelope.model_dump(mode="json"),
            "inferred_edges": [
                edge.model_dump(by_alias=True, mode="json") for edge in bound_trace.inferred_edges
            ],
        }

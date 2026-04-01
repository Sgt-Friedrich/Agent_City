from __future__ import annotations

import asyncio
import logging
import random
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.dependencies import get_platform_service
from app.generators.live_event_generator import LiveEventGenerator
from app.routers.analysis import router as analysis_router
from app.routers.metrics import router as metrics_router
from app.routers.nodes import router as nodes_router
from app.routers.parsing import router as parsing_router
from app.routers.topology import router as topology_router
from app.routers.traces import router as traces_router
from app.services.platform_service import PlatformService

logger = logging.getLogger(__name__)


async def _auto_ingest_loop(service: PlatformService, stop_event: asyncio.Event) -> None:
    while not stop_event.is_set():
        try:
            await asyncio.to_thread(service.scan_ingest_directory)
        except Exception:  # pragma: no cover - safety guard for background loop
            logger.exception("auto ingest scan failed")

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=1.5)
        except asyncio.TimeoutError:
            continue


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Warm up discovery/normalizer/runtime cache once at startup.
    service = get_platform_service()

    stop_event = asyncio.Event()
    ingest_task = asyncio.create_task(_auto_ingest_loop(service, stop_event))

    try:
        yield
    finally:
        stop_event.set()
        ingest_task.cancel()
        with suppress(asyncio.CancelledError):
            await ingest_task


app = FastAPI(
    title="Agent_City Visual Observability Platform",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(topology_router)
app.include_router(traces_router)
app.include_router(nodes_router)
app.include_router(metrics_router)
app.include_router(parsing_router)
app.include_router(analysis_router)


@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True, "service": "agent_city-backend"}


@app.websocket("/ws/live")
async def ws_live(websocket: WebSocket) -> None:
    await websocket.accept()
    service = get_platform_service()
    generator = LiveEventGenerator()

    target = websocket.query_params.get("target", "mock")
    scenario_id = websocket.query_params.get("scenario_id")

    try:
        while True:
            bound_trace = service.generate_live_trace(target=target, scenario_id=scenario_id)
            async for message in generator.stream_trace(bound_trace):
                message["target"] = target
                await websocket.send_json(message)

            await websocket.send_json(
                {
                    "type": "heartbeat",
                    "active_trace_id": bound_trace.trace.envelope.trace_id,
                    "target": target,
                }
            )
            await asyncio.sleep(random.uniform(0.8, 2.2))

    except WebSocketDisconnect:
        return
    except Exception as exc:  # pragma: no cover - safety guard for ws loop
        await websocket.send_json({"type": "error", "message": str(exc), "target": target})
        await websocket.close(code=1011)

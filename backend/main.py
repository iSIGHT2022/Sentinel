"""SENTINEL Cloud Backend — FastAPI entry point."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from api.websocket import manager
from api.routes.events import router as events_router
from api.routes.alerts import router as alerts_router
from api.routes.residents import router as residents_router
from api.routes.dashboard import router as dashboard_router
from models.database import engine, Base

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("sentinel.backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables ensured.")
    yield
    await engine.dispose()


app = FastAPI(title="SENTINEL Backend", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST routes
app.include_router(events_router)
app.include_router(alerts_router)
app.include_router(residents_router)
app.include_router(dashboard_router)


# WebSocket — real-time event stream
@app.websocket("/ws/{room}")
async def websocket_endpoint(ws: WebSocket, room: str = "global"):
    await manager.connect(ws, room)
    try:
        while True:
            await ws.receive_text()  # keep-alive pings from client
    except WebSocketDisconnect:
        manager.disconnect(ws, room)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "sentinel-backend"}

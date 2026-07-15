"""SENTINEL Edge Server — on-premise inference entry point."""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from api.routes import router
from pipeline import registry
from pipeline.event_emitter import EventEmitter
from pipeline.frame_processor import CameraProcessor
from config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("sentinel.edge")


@asynccontextmanager
async def lifespan(app: FastAPI):
    registry.emitter = EventEmitter()
    cameras = settings.camera_list
    if not cameras:
        logger.warning("No CAMERA_SOURCES configured — edge server idle until a push-mode client connects.")
    for idx, source in enumerate(cameras):
        cam_id = f"cam_{idx}"
        proc = CameraProcessor(cam_id, source, registry.emitter)
        registry.processors[cam_id] = proc
        asyncio.create_task(proc.run())
        logger.info("Started processor for camera %s → %s", cam_id, source)
    yield
    if registry.emitter:
        await registry.emitter.close()


app = FastAPI(title="SENTINEL Edge Server", version="1.0.0", lifespan=lifespan)
app.include_router(router, prefix="/edge")

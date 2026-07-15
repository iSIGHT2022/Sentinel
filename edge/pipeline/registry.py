"""Shared emitter + camera processor registry.

Pull-mode cameras (configured via CAMERA_SOURCES) are registered at startup
in main.py's lifespan. Push-mode cameras (phone/CCTV clients streaming over
the WebSocket ingest route) are registered lazily on first connection.
"""
from __future__ import annotations
from typing import Dict, Optional

from pipeline.event_emitter import EventEmitter
from pipeline.frame_processor import CameraProcessor

emitter: Optional[EventEmitter] = None
processors: Dict[str, CameraProcessor] = {}


def get_or_create_processor(camera_id: str) -> CameraProcessor:
    proc = processors.get(camera_id)
    if proc is None:
        proc = CameraProcessor(camera_id, source=None, emitter=emitter)
        processors[camera_id] = proc
    return proc

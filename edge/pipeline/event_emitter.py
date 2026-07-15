"""Sends detection events to the cloud backend over HTTP + optional clip upload."""
from __future__ import annotations
import asyncio
import cv2
import httpx
import io
import logging
import numpy as np
import time
from typing import Optional

from detectors.base import DetectionEvent
from config import settings

logger = logging.getLogger(__name__)

# Rate-limit: don't repeat the same event_type + reid within COOLDOWN seconds
COOLDOWN: dict[str, float] = {}
COOLDOWN_SECONDS = 30


class EventEmitter:
    def __init__(self) -> None:
        self._client = httpx.AsyncClient(
            base_url=settings.backend_url,
            headers={"X-Edge-API-Key": settings.edge_api_key},
            timeout=10.0,
        )

    async def emit(self, event: DetectionEvent, frame: Optional[np.ndarray] = None) -> None:
        key = f"{event.event_type}:{event.reid_id}"
        now = time.time()
        if now - COOLDOWN.get(key, 0) < COOLDOWN_SECONDS:
            return
        COOLDOWN[key] = now

        clip_url = None
        if event.clip_trigger and frame is not None:
            clip_url = await self._upload_clip(frame, event)

        payload = {
            "event_type": event.event_type,
            "zone": event.zone,
            "camera_id": event.camera_id,
            "reid_id": event.reid_id,
            "confidence": event.confidence,
            "metadata": event.metadata,
            "clip_url": clip_url,
        }
        try:
            r = await self._client.post("/internal/events", json=payload)
            r.raise_for_status()
        except Exception as exc:
            logger.warning("Failed to emit event %s: %s", event.event_type, exc)

    async def _upload_clip(self, frame: np.ndarray, event: DetectionEvent) -> Optional[str]:
        try:
            _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            files = {"file": (f"{event.event_type}_{int(time.time())}.jpg",
                               io.BytesIO(buf.tobytes()), "image/jpeg")}
            r = await self._client.post("/internal/clips", files=files,
                                        data={"zone": event.zone, "event_type": event.event_type})
            r.raise_for_status()
            return r.json().get("url")
        except Exception as exc:
            logger.warning("Clip upload failed: %s", exc)
            return None

    async def close(self) -> None:
        await self._client.aclose()

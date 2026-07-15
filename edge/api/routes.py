"""Edge server health, status, and camera ingest API routes."""
import cv2
import numpy as np
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from fastapi.security.api_key import APIKeyHeader
from fastapi import HTTPException, status
from config import settings
from pipeline import registry

router = APIRouter()
api_key_header = APIKeyHeader(name="X-Edge-API-Key")


def verify_key(key: str = Depends(api_key_header)):
    if key != settings.edge_api_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid API key")


@router.get("/health")
async def health():
    return {"status": "ok", "service": "sentinel-edge"}


@router.get("/status", dependencies=[Depends(verify_key)])
async def status_endpoint():
    import torch
    return {
        "gpu_available": torch.cuda.is_available(),
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "device": settings.device,
        "inference_fps": settings.inference_fps,
    }


@router.websocket("/ws/ingest/{camera_id}")
async def ingest_camera(websocket: WebSocket, camera_id: str) -> None:
    """Accepts a phone/CCTV client streaming JPEG frames as binary WebSocket frames —
    matches the Sentinel Android app's KtorWebSocketClient (Frame.Binary per frame).
    That client sends no in-band auth headers, so the edge API key is passed as a
    query param instead: wss://host/edge/ws/ingest/{camera_id}?key=<edge_api_key>
    """
    if websocket.query_params.get("key") != settings.edge_api_key:
        await websocket.close(code=4403)
        return

    await websocket.accept()
    processor = registry.get_or_create_processor(camera_id)
    try:
        while True:
            data = await websocket.receive_bytes()
            frame = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
            if frame is not None:
                await processor.ingest(frame)
    except WebSocketDisconnect:
        pass

"""Internal edge → backend event ingestion + public event query API."""
from __future__ import annotations
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from pydantic import BaseModel
from typing import Optional

from models.database import get_db
from models.event import Event, EVENT_CATEGORIES
from models.alert import Alert
from api.websocket import manager
from workers.tasks import dispatch_alert
from config import settings
import time

router = APIRouter()


# ── Internal endpoint: Edge server posts events here ─────────────────────────

class EdgeEvent(BaseModel):
    event_type: str
    zone: str
    camera_id: str
    reid_id: Optional[str] = None
    confidence: float
    metadata: dict = {}
    clip_url: Optional[str] = None


SEVERITY_MAP = {
    "fall_detected": "critical",
    "slow_collapse": "critical",
    "person_on_floor": "critical",
    "choking_gesture": "critical",
    "crowd_emergency": "high",
    "bathroom_duration_alert": "high",
    "wandering_detected": "medium",
    "disorientation": "medium",
    "gait_abnormal": "medium",
    "limping_detected": "medium",
    "balance_instability": "medium",
    "tremor_detected": "medium",
    "meal_skipped": "medium",
    "prolonged_inactivity": "low",
    "poor_posture": "low",
    "social_isolation": "low",
}


def _human_message(event_type: str, zone: str, reid_id: str | None) -> str:
    who = f"Resident {reid_id}" if reid_id else "A resident"
    zone_name = zone.replace("_", " ").title()
    messages = {
        "fall_detected": f"{who} has fallen in {zone_name}. Immediate response required.",
        "slow_collapse": f"{who} is slowly collapsing in {zone_name}.",
        "person_on_floor": f"{who} has been on the floor for an extended period in {zone_name}.",
        "choking_gesture": f"{who} may be choking in {zone_name}.",
        "bathroom_duration_alert": f"{who} has been in the bathroom for an unusually long time.",
        "wandering_detected": f"{who} is wandering in {zone_name}.",
        "gait_abnormal": f"{who} is showing abnormal gait in {zone_name}.",
        "meal_skipped": f"{who} was not present at a scheduled meal.",
        "prolonged_inactivity": f"{who} has been inactive for an extended period in {zone_name}.",
    }
    return messages.get(event_type, f"{who}: {event_type.replace('_', ' ')} detected in {zone_name}.")


@router.post("/internal/events", status_code=201)
async def ingest_event(
    payload: EdgeEvent,
    db: AsyncSession = Depends(get_db),
    x_edge_api_key: str = Header(...),
):
    if x_edge_api_key != settings.edge_api_key:
        raise HTTPException(status_code=403, detail="Forbidden")

    category = EVENT_CATEGORIES.get(payload.event_type, "unknown")
    event = Event(
        zone=payload.zone,
        event_type=payload.event_type,
        category=category,
        confidence=payload.confidence,
        metadata_=payload.metadata,
        clip_url=payload.clip_url,
        reid_id=payload.reid_id,
    )
    db.add(event)
    await db.flush()

    severity = SEVERITY_MAP.get(payload.event_type)
    alert = None
    if severity:
        message = _human_message(payload.event_type, payload.zone, payload.reid_id)
        alert = Alert(
            event_id=event.id,
            severity=severity,
            alert_type=payload.event_type,
            category=category,
            zone=payload.zone,
            message=message,
            metadata_=payload.metadata,
        )
        db.add(alert)

    await db.commit()

    # Broadcast to all dashboard WebSocket clients
    ws_payload = {
        "type": "new_event",
        "event": {
            "id": str(event.id),
            "event_type": payload.event_type,
            "category": category,
            "zone": payload.zone,
            "confidence": payload.confidence,
            "reid_id": payload.reid_id,
            "time": datetime.now(timezone.utc).isoformat(),
            "metadata": payload.metadata,
        },
    }
    if alert:
        ws_payload["alert"] = {
            "id": str(alert.id),
            "severity": severity,
            "message": alert.message,
        }
    await manager.broadcast_all(ws_payload)

    # Async notification dispatch
    if alert and severity in ("high", "critical"):
        dispatch_alert.delay(
            str(alert.id), None, severity,
            payload.event_type, alert.message, payload.zone, payload.metadata,
        )

    return {"id": str(event.id)}


@router.post("/internal/clips")
async def upload_clip(
    file: UploadFile = File(...),
    zone: str = Form(...),
    event_type: str = Form(...),
    x_edge_api_key: str = Header(...),
):
    if x_edge_api_key != settings.edge_api_key:
        raise HTTPException(status_code=403, detail="Forbidden")
    from storage.minio_client import upload_clip as minio_upload
    data = await file.read()
    obj_name = f"{zone}/{event_type}/{int(time.time())}_{uuid.uuid4().hex[:8]}.jpg"
    url = minio_upload(data, obj_name)
    return {"url": url}


# ── Public event query API ────────────────────────────────────────────────────

@router.get("/events")
async def list_events(
    category: Optional[str] = None,
    zone: Optional[str] = None,
    hours: int = 24,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    q = select(Event).where(Event.time >= since).order_by(Event.time.desc()).limit(limit)
    if category:
        q = q.where(Event.category == category)
    if zone:
        q = q.where(Event.zone == zone)
    result = await db.execute(q)
    events = result.scalars().all()
    return [
        {
            "id": str(e.id), "time": e.time, "event_type": e.event_type,
            "category": e.category, "zone": e.zone, "confidence": e.confidence,
            "reid_id": e.reid_id, "metadata": e.metadata_, "clip_url": e.clip_url,
        }
        for e in events
    ]


@router.get("/events/counts")
async def event_counts_by_category(hours: int = 24, db: AsyncSession = Depends(get_db)):
    """Returns event count per category for dashboard tile badges."""
    from sqlalchemy import func
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    result = await db.execute(
        select(Event.category, func.count().label("cnt"))
        .where(Event.time >= since)
        .group_by(Event.category)
    )
    return {row[0]: row[1] for row in result.fetchall()}

import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from models.database import get_db
from models.resident import Resident
from models.event import Event

router = APIRouter(prefix="/residents", tags=["residents"])


class ResidentCreate(BaseModel):
    name: str
    age: Optional[int] = None
    room_number: Optional[str] = None
    medical_notes: Optional[str] = None
    emergency_contacts: list[dict] = []


@router.get("")
async def list_residents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Resident).order_by(Resident.name))
    residents = result.scalars().all()
    return [
        {
            "id": str(r.id), "name": r.name, "age": r.age,
            "room_number": r.room_number, "medical_notes": r.medical_notes,
            "emergency_contacts": r.emergency_contacts,
        }
        for r in residents
    ]


@router.post("", status_code=201)
async def create_resident(body: ResidentCreate, db: AsyncSession = Depends(get_db)):
    r = Resident(**body.model_dump())
    db.add(r)
    await db.commit()
    return {"id": str(r.id), "name": r.name}


@router.get("/{resident_id}/timeline")
async def resident_timeline(
    resident_id: uuid.UUID,
    hours: int = 24,
    db: AsyncSession = Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    result = await db.execute(
        select(Event.time, Event.event_type, Event.category, Event.zone,
               Event.confidence, Event.metadata_)
        .where(Event.resident_id == str(resident_id))
        .where(Event.time >= since)
        .order_by(Event.time.desc())
        .limit(200)
    )
    return [
        {"time": r[0], "event_type": r[1], "category": r[2],
         "zone": r[3], "confidence": r[4], "metadata": r[5]}
        for r in result.fetchall()
    ]


@router.get("/{resident_id}/status")
async def resident_status(resident_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Last seen location, inferred room status, activity summary."""
    result = await db.execute(
        select(Event.zone, Event.event_type, Event.time)
        .where(Event.resident_id == str(resident_id))
        .order_by(Event.time.desc())
        .limit(1)
    )
    last = result.fetchone()

    in_room_inferred = False
    if last and last[0] in ("corridors_hallways",) and last[1] == "room_entry_inferred":
        in_room_inferred = True

    return {
        "resident_id": str(resident_id),
        "last_seen_zone": last[0] if last else None,
        "last_seen_time": last[2] if last else None,
        "in_room_inferred": in_room_inferred,
    }


@router.get("/{resident_id}/digest")
async def resident_digest(resident_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT date, resident_summaries
        FROM daily_digests
        ORDER BY date DESC LIMIT 7
    """))
    rows = result.fetchall()
    rid = str(resident_id)
    return [
        {"date": str(r[0]), "summary": (r[1] or {}).get(rid, "No summary available.")}
        for r in rows
    ]

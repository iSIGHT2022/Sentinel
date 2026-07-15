"""Dashboard summary endpoint — all data needed for the home screen in one call."""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from models.database import get_db
from models.alert import Alert
from models.event import Event
from models.resident import Resident

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

CATEGORIES = ["emergency", "activity", "bathroom", "dining", "behaviour", "social", "room"]


@router.get("/summary")
async def dashboard_summary(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    since_24h = now - timedelta(hours=24)
    since_1h = now - timedelta(hours=1)

    # Active alerts per category
    q_active = (select(Alert.category, func.count(Alert.id).label("cnt"))
                .where(Alert.resolved == False).group_by(Alert.category))
    active_map = {r[0]: r[1] for r in (await db.execute(q_active)).fetchall()}

    # Critical alerts per category
    q_crit = (select(Alert.category, func.count(Alert.id).label("cnt"))
              .where(Alert.resolved == False, Alert.severity == "critical")
              .group_by(Alert.category))
    crit_map = {r[0]: r[1] for r in (await db.execute(q_crit)).fetchall()}

    # High alerts per category
    q_high = (select(Alert.category, func.count(Alert.id).label("cnt"))
              .where(Alert.resolved == False, Alert.severity == "high")
              .group_by(Alert.category))
    high_map = {r[0]: r[1] for r in (await db.execute(q_high)).fetchall()}

    # Last alert time per category
    q_last_alert = select(Alert.category, func.max(Alert.time).label("t")).group_by(Alert.category)
    last_alert_map = {r[0]: r[1] for r in (await db.execute(q_last_alert)).fetchall()}

    # Last event time per category (last 24 h)
    q_last_event = (select(Event.category, func.max(Event.time).label("t"))
                    .where(Event.time >= since_24h).group_by(Event.category))
    last_event_map = {r[0]: r[1] for r in (await db.execute(q_last_event)).fetchall()}

    tiles = [
        {
            "category": cat,
            "active_alerts": active_map.get(cat, 0),
            "critical_count": crit_map.get(cat, 0),
            "high_count": high_map.get(cat, 0),
            "last_alert_time": last_alert_map.get(cat),
            "last_event_time": last_event_map.get(cat),
        }
        for cat in CATEGORIES
    ]

    # Recent critical / high alerts (top 5)
    q_crit_alerts = (
        select(Alert)
        .where(Alert.resolved == False, Alert.severity.in_(["critical", "high"]))
        .order_by(Alert.time.desc())
        .limit(5)
    )
    critical_alerts = [
        {
            "id": a.id, "alert_type": a.alert_type, "category": a.category,
            "zone": a.zone, "message": a.message, "severity": a.severity,
            "time": a.time, "resident_id": a.resident_id,
        }
        for a in (await db.execute(q_crit_alerts)).scalars().all()
    ]

    total_residents = await db.scalar(select(func.count(Resident.id))) or 0
    open_alerts = await db.scalar(select(func.count(Alert.id)).where(Alert.resolved == False)) or 0
    events_last_hour = await db.scalar(
        select(func.count(Event.id)).where(Event.time >= since_1h)
    ) or 0

    return {
        "tiles": tiles,
        "critical_alerts": critical_alerts,
        "stats": {
            "total_residents": total_residents,
            "open_alerts": open_alerts,
            "events_last_hour": events_last_hour,
        },
    }

from datetime import datetime, timezone
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from models.database import get_db
from models.alert import Alert
from api.websocket import manager

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
async def list_alerts(
    category: Optional[str] = None,
    severity: Optional[str] = None,
    resolved: bool = False,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    q = (select(Alert)
         .where(Alert.resolved == resolved)
         .order_by(Alert.time.desc())
         .limit(limit))
    if category:
        q = q.where(Alert.category == category)
    if severity:
        q = q.where(Alert.severity == severity)
    result = await db.execute(q)
    alerts = result.scalars().all()
    return [
        {
            "id": str(a.id), "time": a.time, "severity": a.severity,
            "alert_type": a.alert_type, "category": a.category, "zone": a.zone,
            "message": a.message, "acknowledged": a.acknowledged,
            "resident_id": str(a.resident_id) if a.resident_id else None,
            "metadata": a.metadata_,
        }
        for a in alerts
    ]


class AcknowledgeRequest(BaseModel):
    acknowledged_by: str


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: uuid.UUID,
    body: AcknowledgeRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.acknowledged = True
    alert.acknowledged_by = body.acknowledged_by
    alert.acknowledged_at = datetime.now(timezone.utc)
    await db.commit()
    await manager.broadcast_all({"type": "alert_acknowledged", "alert_id": str(alert_id)})
    return {"status": "acknowledged"}


@router.post("/{alert_id}/resolve")
async def resolve_alert(
    alert_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.resolved = True
    alert.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    await manager.broadcast_all({"type": "alert_resolved", "alert_id": str(alert_id)})
    return {"status": "resolved"}


@router.get("/summary")
async def alert_summary(db: AsyncSession = Depends(get_db)):
    """Active alert counts by category and severity for dashboard tiles."""
    from sqlalchemy import text
    result = await db.execute(text("""
        SELECT category, severity, COUNT(*) as cnt
        FROM alerts
        WHERE resolved = FALSE
        GROUP BY category, severity
        ORDER BY category, severity
    """))
    rows = result.fetchall()
    summary: dict = {}
    for category, severity, cnt in rows:
        summary.setdefault(category, {"total": 0})
        summary[category][severity] = cnt
        summary[category]["total"] += cnt
    return summary

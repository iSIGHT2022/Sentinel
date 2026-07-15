"""Celery tasks — alert dispatch, digest generation, meal checks."""
from __future__ import annotations
import json
import logging
from datetime import date, datetime, timezone

from workers.celery_app import celery_app

logger = logging.getLogger(__name__)

# Severity → notification routing
CRITICAL_ALERT_TYPES = {
    "fall_detected", "slow_collapse", "person_on_floor",
    "choking_gesture", "crowd_emergency", "bathroom_duration_alert",
}


@celery_app.task(bind=True, max_retries=3, default_retry_delay=10)
def dispatch_alert(self, alert_id: str, resident_id: str | None, severity: str,
                   alert_type: str, message: str, zone: str, metadata: dict):
    """Send FCM push + SMS for high/critical alerts."""
    from sqlalchemy import create_engine, text
    from config import settings
    import asyncio

    try:
        if severity not in ("high", "critical"):
            return

        # Fetch resident + contacts (sync query via sync engine for Celery)
        sync_url = settings.database_url.replace("+asyncpg", "")
        engine = create_engine(sync_url)
        with engine.connect() as conn:
            if resident_id:
                row = conn.execute(
                    text("SELECT name, emergency_contacts FROM residents WHERE id = :id"),
                    {"id": resident_id},
                ).fetchone()
            else:
                row = None

            # Fetch FCM tokens of all staff (nurses + admins)
            tokens = [r[0] for r in conn.execute(
                text("SELECT fcm_token FROM staff WHERE role IN ('admin','nurse') AND fcm_token IS NOT NULL")
            ).fetchall()]

        from notifications import fcm, twilio_sms
        title = f"SENTINEL — {alert_type.replace('_', ' ').title()}"
        fcm.send_multicast(tokens, title, message, {"alert_id": alert_id, "zone": zone})

        if row and alert_type in CRITICAL_ALERT_TYPES:
            contacts = row[1] if row[1] else []
            twilio_sms.send_emergency_sms(row[0], alert_type.replace("_", " "), zone, contacts)

    except Exception as exc:
        logger.error("dispatch_alert failed: %s", exc)
        raise self.retry(exc=exc)


@celery_app.task
def generate_daily_digest():
    """Generate and store daily digest for all residents using Gemini."""
    from sqlalchemy import create_engine, text
    from config import settings
    from ai.daily_digest import generate_resident_digest, generate_facility_digest

    today = date.today().isoformat()
    sync_url = settings.database_url.replace("+asyncpg", "")
    engine = create_engine(sync_url)

    with engine.connect() as conn:
        residents = conn.execute(text("SELECT id, name, age FROM residents")).fetchall()
        for rid, name, age in residents:
            events = conn.execute(
                text("""
                    SELECT event_type, zone, category, COUNT(*) as cnt
                    FROM events
                    WHERE resident_id = :rid
                      AND time >= CURRENT_DATE - INTERVAL '1 day'
                      AND time < CURRENT_DATE
                    GROUP BY event_type, zone, category
                """),
                {"rid": str(rid)},
            ).fetchall()
            events_json = json.dumps([dict(r._mapping) for r in events], default=str)
            summary = generate_resident_digest(name, age or 0, today, events_json)
            conn.execute(
                text("""
                    INSERT INTO daily_digests (date, summary, resident_summaries)
                    VALUES (:date, :summary, :rs::jsonb)
                    ON CONFLICT (date) DO UPDATE SET summary = EXCLUDED.summary
                """),
                {"date": today, "summary": summary, "rs": json.dumps({str(rid): summary})},
            )
        conn.commit()
    logger.info("Daily digests generated for %d residents", len(residents))


@celery_app.task
def check_meal_attendance(meal: str):
    """Detect residents who did not appear in dining hall during meal window."""
    from sqlalchemy import create_engine, text
    from config import settings

    MEAL_WINDOWS = {
        "breakfast": ("07:00", "09:30"),
        "lunch": ("12:00", "13:30"),
        "dinner": ("18:00", "20:00"),
    }
    window = MEAL_WINDOWS.get(meal)
    if not window:
        return

    sync_url = settings.database_url.replace("+asyncpg", "")
    engine = create_engine(sync_url)
    with engine.connect() as conn:
        residents = conn.execute(text("SELECT id, name FROM residents")).fetchall()
        for rid, name in residents:
            present = conn.execute(
                text("""
                    SELECT COUNT(*) FROM events
                    WHERE resident_id = :rid
                      AND zone = 'dining_hall'
                      AND time::time BETWEEN :start AND :end
                      AND time::date = CURRENT_DATE
                """),
                {"rid": str(rid), "start": window[0], "end": window[1]},
            ).scalar()
            if not present:
                conn.execute(
                    text("""
                        INSERT INTO alerts
                        (resident_id, severity, alert_type, category, zone, message)
                        VALUES (:rid, 'medium', 'meal_skipped', 'dining', 'dining_hall', :msg)
                    """),
                    {"rid": str(rid), "msg": f"{name} was not seen in the dining hall during {meal}."},
                )
        conn.commit()


@celery_app.task
def cleanup_resolved_alerts():
    from sqlalchemy import create_engine, text
    from config import settings
    sync_url = settings.database_url.replace("+asyncpg", "")
    engine = create_engine(sync_url)
    with engine.connect() as conn:
        conn.execute(text("""
            DELETE FROM alerts
            WHERE resolved = TRUE AND resolved_at < NOW() - INTERVAL '30 days'
        """))
        conn.commit()

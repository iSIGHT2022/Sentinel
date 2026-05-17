"""
SENTINEL FastAPI Backend
Receives events from cctv_processor.py, auto-generates alerts,
serves REST endpoints and broadcasts via WebSocket.
"""

from __future__ import annotations

import json
import uuid
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Optional

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="SENTINEL")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory stores ───────────────────────────────────────────────────────────
_events: deque = deque(maxlen=2000)
_alerts: list   = []
_camera         = {"online": False, "source": None}
_ws_clients: list[WebSocket] = []

CATEGORIES = ["emergency", "activity", "bathroom", "dining", "behaviour", "social", "room"]

# Event type → (severity, category, human message template)
EVENT_META: dict[str, tuple[str, str, str]] = {
    "fall_detected":            ("critical", "emergency",  "Fall detected in {zone}"),
    "slow_collapse":            ("critical", "emergency",  "Slow collapse detected in {zone}"),
    "crowd_emergency":          ("critical", "emergency",  "Crowd emergency in {zone}"),
    "sleeping_detected":        ("high",     "activity",   "Person sleeping in {zone}"),
    "wandering_detected":       ("high",     "behaviour",  "Wandering detected in {zone}"),
    "bathroom_extended_stay":   ("high",     "bathroom",   "Extended bathroom stay — {zone}"),
    "gait_abnormal":            ("medium",   "activity",   "Abnormal gait detected in {zone}"),
    "balance_instability":      ("medium",   "activity",   "Balance instability in {zone}"),
    "tremor_detected":          ("medium",   "activity",   "Tremor detected in {zone}"),
    "limping_detected":         ("medium",   "activity",   "Limping detected in {zone}"),
    "prolonged_inactivity":     ("medium",   "social",     "Prolonged inactivity in {zone}"),
    "bathroom_duration_alert":  ("high",     "bathroom",   "Extended bathroom stay — {zone}"),
    # posture updates
    "posture_standing":         ("low",      "activity",   "Person standing in {zone}"),
    "posture_sitting":          ("low",      "activity",   "Person sitting in {zone}"),
    "posture_lying":            ("medium",   "activity",   "Person lying down in {zone}"),
    "posture_crouching":        ("medium",   "activity",   "Person crouching in {zone}"),
    "posture_bending":          ("low",      "activity",   "Person bending in {zone}"),
}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _parse_time(t: str) -> datetime:
    try:
        return datetime.fromisoformat(t.replace("Z", "+00:00"))
    except Exception:
        return datetime.now(timezone.utc)


async def _broadcast(msg: dict):
    text = json.dumps(msg)
    dead = []
    for ws in list(_ws_clients):
        try:
            await ws.send_text(text)
        except Exception:
            dead.append(ws)
    for ws in dead:
        try:
            _ws_clients.remove(ws)
        except ValueError:
            pass


def _auto_alert(event: dict) -> Optional[dict]:
    """Create an alert from an event if it warrants one."""
    et = event.get("event_type", "")
    meta = EVENT_META.get(et)
    if not meta:
        return None
    severity, category, tpl = meta
    zone = event.get("zone", "unknown").replace("_", " ").title()
    return {
        "id":           str(uuid.uuid4()),
        "time":         event["time"],
        "severity":     severity,
        "alert_type":   et,
        "category":     category,
        "zone":         event.get("zone", "unknown"),
        "message":      tpl.format(zone=zone) + f" (Track {event.get('reid_id', '?')})",
        "acknowledged": False,
        "resident_id":  event.get("resident_id", None),
        "metadata":     event.get("metadata", {}),
    }


# ── Camera endpoints ───────────────────────────────────────────────────────────

@app.get("/camera/status")
async def camera_status():
    return _camera


@app.post("/camera/source")
async def set_source(body: dict):
    _camera["source"] = body.get("source")
    return {"ok": True}


@app.post("/camera/online")
async def camera_online(body: dict):
    _camera["online"] = True
    _camera["source"] = body.get("source")
    await _broadcast({"type": "camera_online", "source": _camera["source"]})
    return {"ok": True}


@app.post("/camera/offline")
async def camera_offline():
    _camera["online"] = False
    await _broadcast({"type": "camera_offline"})
    return {"ok": True}


# ── Event / Alert endpoints ────────────────────────────────────────────────────

@app.get("/events")
async def get_events(
    category: Optional[str] = None,
    hours: int = 24,
    limit: int = 50,
):
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    result = [
        e for e in _events
        if _parse_time(e.get("time", "")) >= cutoff
        and (category is None or e.get("category") == category)
    ]
    return result[-limit:]


@app.post("/events")
async def post_event(body: dict):
    body.setdefault("id",   str(uuid.uuid4()))
    body.setdefault("time", datetime.now(timezone.utc).isoformat())
    _events.append(body)

    alert = _auto_alert(body)
    if alert:
        _alerts.append(alert)
        await _broadcast({"type": "new_event", "event": body, "alert": alert})
    else:
        await _broadcast({"type": "new_event", "event": body})

    return {"ok": True, "id": body["id"]}


@app.get("/alerts")
async def get_alerts(
    category: Optional[str] = None,
    resolved: Optional[str] = None,
    limit: int = 30,
):
    result = list(_alerts)
    if category:
        result = [a for a in result if a.get("category") == category]
    if resolved == "false":
        result = [a for a in result if not a.get("acknowledged", False)]
    return result[-limit:]


@app.post("/alerts/acknowledge/{alert_id}")
async def ack_alert(alert_id: str):
    for a in _alerts:
        if a["id"] == alert_id:
            a["acknowledged"] = True
    await _broadcast({"type": "alert_acknowledged", "alert_id": alert_id})
    return {"ok": True}


# ── Dashboard summary ──────────────────────────────────────────────────────────

@app.get("/dashboard/summary")
async def dashboard_summary():
    now      = datetime.now(timezone.utc)
    hour_ago = now - timedelta(hours=1)

    open_alerts = [a for a in _alerts if not a.get("acknowledged", False)]

    tiles = []
    for cat in CATEGORIES:
        cat_open   = [a for a in open_alerts  if a.get("category") == cat]
        cat_events = [e for e in _events      if e.get("category") == cat]

        last_alert_t = max((a["time"] for a in cat_open),   default=None)
        last_event_t = max((e["time"] for e in cat_events), default=None)

        tiles.append({
            "category":       cat,
            "active_alerts":  len(cat_open),
            "critical_count": sum(1 for a in cat_open if a.get("severity") == "critical"),
            "high_count":     sum(1 for a in cat_open if a.get("severity") == "high"),
            "last_alert_time": last_alert_t,
            "last_event_time": last_event_t,
        })

    critical = sorted(
        [a for a in open_alerts if a.get("severity") in ("critical", "high")],
        key=lambda x: x["time"],
        reverse=True,
    )[:10]

    events_last_hour = sum(
        1 for e in _events
        if _parse_time(e.get("time", "")) >= hour_ago
    )

    return {
        "tiles":           tiles,
        "critical_alerts": critical,
        "stats": {
            "total_residents":  0,
            "open_alerts":      len(open_alerts),
            "events_last_hour": events_last_hour,
        },
    }


# ── WebSocket ──────────────────────────────────────────────────────────────────

@app.websocket("/ws/global")
async def ws_global(ws: WebSocket):
    await ws.accept()
    _ws_clients.append(ws)
    try:
        await ws.send_text(json.dumps({"type": "server_ready", "camera": _camera}))
        while True:
            try:
                data = await ws.receive_text()
                if data == "ping":
                    await ws.send_text(json.dumps({"type": "pong"}))
            except Exception:
                break
    except WebSocketDisconnect:
        pass
    finally:
        try:
            _ws_clients.remove(ws)
        except ValueError:
            pass


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)

"""Bathroom entry/exit duration tracker — alerts on abnormal stays."""
from __future__ import annotations
import time
from collections import defaultdict
from typing import Dict, List, Set

from detectors.base import BaseDetector, DetectionEvent
from vision.pose_estimator import PersonPose
from config import settings

ALERT_MINUTES = settings.bathroom_duration_alert_minutes
ALERT_SECONDS = ALERT_MINUTES * 60


class DurationTracker(BaseDetector):
    """Tracks corridor-camera visibility transitions as bathroom entry/exit."""

    def __init__(self) -> None:
        self._entry_time: Dict[str, float] = {}
        self._inside: Set[str] = set()
        self._alerted: Set[str] = set()

    def record_entry(self, reid_id: str) -> None:
        if reid_id not in self._inside:
            self._inside.add(reid_id)
            self._entry_time[reid_id] = time.time()

    def record_exit(self, reid_id: str) -> None:
        self._inside.discard(reid_id)
        self._alerted.discard(reid_id)
        self._entry_time.pop(reid_id, None)

    def process(self, frame_id: int, camera_id: str, zone: str, poses: List[PersonPose]):
        """
        For bathroom_entry zone: persons visible on corridor cam are entering/exiting.
        Call record_entry / record_exit externally based on direction logic.
        This tick checks durations.
        """
        events: List[DetectionEvent] = []
        now = time.time()
        for rid in list(self._inside):
            elapsed = now - self._entry_time.get(rid, now)
            if elapsed > ALERT_SECONDS and rid not in self._alerted:
                self._alerted.add(rid)
                events.append(DetectionEvent(
                    event_type="bathroom_duration_alert",
                    zone=zone,
                    camera_id=camera_id,
                    reid_id=rid,
                    confidence=0.90,
                    metadata={"duration_minutes": round(elapsed / 60, 1)},
                    clip_trigger=True,
                ))
        return events

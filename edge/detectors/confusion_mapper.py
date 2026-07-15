"""Confusion mapping — resident repeatedly visiting the same common-area room."""
from __future__ import annotations
import time
from collections import defaultdict, deque
from typing import Dict, Deque, List, Tuple

from detectors.base import BaseDetector, DetectionEvent
from vision.pose_estimator import PersonPose

WINDOW_SECONDS = 600        # 10 min window
MIN_ZONE_REVISITS = 3       # flagged if same zone visited 3+ times in window


class ConfusionMapper(BaseDetector):
    """
    Called once per camera feed per frame; tracks zone-visit timestamps.
    Zone visits are recorded externally via record_zone_visit().
    """
    def __init__(self) -> None:
        self._visits: Dict[str, Deque[Tuple[str, float]]] = defaultdict(
            lambda: deque(maxlen=50)
        )
        self._alerted: Dict[str, bool] = defaultdict(bool)

    def record_zone_visit(self, reid_id: str, zone: str) -> None:
        self._visits[reid_id].append((zone, time.time()))

    def process(self, frame_id: int, camera_id: str, zone: str, poses: List[PersonPose]):
        events: List[DetectionEvent] = []
        now = time.time()

        for pose in poses:
            rid = pose.reid_id or f"T{pose.track_id}"
            # Record this zone visit
            last = self._visits[rid][-1][0] if self._visits[rid] else None
            if last != zone:
                self.record_zone_visit(rid, zone)

            visits = self._visits[rid]
            recent = [(z, t) for z, t in visits if now - t <= WINDOW_SECONDS]

            zone_counts: Dict[str, int] = {}
            for z, _ in recent:
                zone_counts[z] = zone_counts.get(z, 0) + 1

            for z, cnt in zone_counts.items():
                if cnt >= MIN_ZONE_REVISITS and not self._alerted[rid]:
                    self._alerted[rid] = True
                    events.append(DetectionEvent(
                        event_type="confusion_mapping",
                        zone=zone,
                        camera_id=camera_id,
                        reid_id=rid,
                        confidence=min(cnt / 6.0, 0.85),
                        metadata={"revisited_zone": z, "visits_in_window": cnt,
                                  "window_minutes": WINDOW_SECONDS // 60},
                    ))
                    break

            if not any(cnt >= MIN_ZONE_REVISITS for cnt in zone_counts.values()):
                self._alerted[rid] = False
        return events

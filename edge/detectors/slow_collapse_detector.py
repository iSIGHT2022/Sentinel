"""Slow collapse and person-on-floor detection."""
from __future__ import annotations
import numpy as np
import time
from collections import defaultdict, deque
from typing import Dict, Deque, List

from detectors.base import BaseDetector, DetectionEvent
from vision.pose_estimator import PersonPose

DESCENT_WINDOW = 90           # ~6 s
FLOOR_ASPECT_THRESHOLD = 1.8  # horizontal
NOT_RISING_SECONDS = 15       # alert if still on floor after N seconds


class SlowCollapseDetector(BaseDetector):
    def __init__(self) -> None:
        self._center_y: Dict[str, Deque] = defaultdict(lambda: deque(maxlen=DESCENT_WINDOW))
        self._on_floor_since: Dict[str, float | None] = defaultdict(lambda: None)
        self._alerted: Dict[str, bool] = defaultdict(bool)

    def _is_horizontal(self, pose: PersonPose) -> bool:
        w = pose.bbox[2] - pose.bbox[0]
        h = pose.bbox[3] - pose.bbox[1]
        return (w / (h + 1e-6)) > FLOOR_ASPECT_THRESHOLD

    def process(self, frame_id: int, camera_id: str, zone: str, poses: List[PersonPose]):
        events: List[DetectionEvent] = []
        now = time.time()

        for pose in poses:
            rid = pose.reid_id or f"T{pose.track_id}"
            self._center_y[rid].append(float(pose.center[1]))
            horiz = self._is_horizontal(pose)

            if horiz:
                if self._on_floor_since[rid] is None:
                    self._on_floor_since[rid] = now
                elapsed = now - self._on_floor_since[rid]
                if elapsed > NOT_RISING_SECONDS and not self._alerted[rid]:
                    self._alerted[rid] = True
                    events.append(DetectionEvent(
                        event_type="person_on_floor",
                        zone=zone,
                        camera_id=camera_id,
                        reid_id=rid,
                        confidence=0.85,
                        metadata={"seconds_on_floor": round(elapsed, 1)},
                        clip_trigger=True,
                    ))
            else:
                self._on_floor_since[rid] = None
                self._alerted[rid] = False

            # Slow collapse: centre-y descending gradually over window
            buf = np.array(self._center_y[rid])
            if len(buf) >= DESCENT_WINDOW:
                slope = float(np.polyfit(np.arange(len(buf)), buf, 1)[0])
                if slope > 0.8:   # centre moving down px/frame
                    events.append(DetectionEvent(
                        event_type="slow_collapse",
                        zone=zone,
                        camera_id=camera_id,
                        reid_id=rid,
                        confidence=min(slope / 2.0, 0.90),
                        metadata={"descent_slope_px_per_frame": round(slope, 3)},
                        clip_trigger=True,
                    ))
        return events

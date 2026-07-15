"""Repetitive pacing — same corridor path traversed multiple times in short window."""
from __future__ import annotations
import numpy as np
from collections import defaultdict, deque
from typing import Dict, Deque, List

from detectors.base import BaseDetector, DetectionEvent
from vision.pose_estimator import PersonPose

WINDOW = 300          # ~20 s
REVERSAL_COUNT = 4    # at least 4 back-and-forth reversals = pacing
MOVEMENT_MIN_PX = 60  # must traverse at least 60 px to count


class PacingDetector(BaseDetector):
    def __init__(self) -> None:
        self._x_history: Dict[str, Deque] = defaultdict(lambda: deque(maxlen=WINDOW))
        self._pacing_alerted: Dict[str, bool] = defaultdict(bool)

    def process(self, frame_id: int, camera_id: str, zone: str, poses: List[PersonPose]):
        events: List[DetectionEvent] = []
        for pose in poses:
            rid = pose.reid_id or f"T{pose.track_id}"
            self._x_history[rid].append(float(pose.center[0]))

            buf = np.array(self._x_history[rid])
            if len(buf) < WINDOW // 2:
                continue

            diff = np.diff(buf)
            sign_changes = int(np.sum(np.diff(np.sign(diff)) != 0))
            x_range = float(np.max(buf) - np.min(buf))

            if sign_changes >= REVERSAL_COUNT and x_range > MOVEMENT_MIN_PX and not self._pacing_alerted[rid]:
                self._pacing_alerted[rid] = True
                events.append(DetectionEvent(
                    event_type="repetitive_pacing",
                    zone=zone,
                    camera_id=camera_id,
                    reid_id=rid,
                    confidence=min(sign_changes / 10.0, 0.85),
                    metadata={"reversals": sign_changes, "path_width_px": round(x_range, 1)},
                ))
            elif sign_changes < 2:
                self._pacing_alerted[rid] = False
        return events

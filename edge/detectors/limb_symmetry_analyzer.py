"""Limping / asymmetric stride — left vs right ankle step-height difference."""
from __future__ import annotations
import numpy as np
from collections import defaultdict, deque
from typing import Dict, Deque, List

from detectors.base import BaseDetector, DetectionEvent
from vision.pose_estimator import PersonPose

WINDOW = 60
ASYMMETRY_THRESHOLD = 0.25  # 25% step-height difference between legs


class LimbSymmetryAnalyzer(BaseDetector):
    def __init__(self) -> None:
        self._ankle_l: Dict[str, Deque] = defaultdict(lambda: deque(maxlen=WINDOW))
        self._ankle_r: Dict[str, Deque] = defaultdict(lambda: deque(maxlen=WINDOW))

    def process(self, frame_id: int, camera_id: str, zone: str, poses: List[PersonPose]):
        events: List[DetectionEvent] = []
        for pose in poses:
            rid = pose.reid_id or f"T{pose.track_id}"
            if pose.kp_visible("left_ankle"):
                self._ankle_l[rid].append(float(pose.kp("left_ankle")[1]))
            if pose.kp_visible("right_ankle"):
                self._ankle_r[rid].append(float(pose.kp("right_ankle")[1]))

            l_buf = self._ankle_l[rid]
            r_buf = self._ankle_r[rid]
            if len(l_buf) < 20 or len(r_buf) < 20:
                continue

            # Step height ≈ range of ankle-y oscillation
            l_range = float(np.max(l_buf) - np.min(l_buf))
            r_range = float(np.max(r_buf) - np.min(r_buf))
            ref = max(l_range, r_range, 1.0)
            asymmetry = abs(l_range - r_range) / ref

            if asymmetry > ASYMMETRY_THRESHOLD and ref > 5:
                events.append(DetectionEvent(
                    event_type="limping_detected",
                    zone=zone,
                    camera_id=camera_id,
                    reid_id=rid,
                    confidence=min(asymmetry, 0.95),
                    metadata={
                        "asymmetry_ratio": round(asymmetry, 3),
                        "left_step_height_px": round(l_range, 1),
                        "right_step_height_px": round(r_range, 1),
                    },
                ))
        return events

"""Gait analysis — stride irregularity and slow/shuffling gait detection."""
from __future__ import annotations
import numpy as np
from collections import defaultdict, deque
from typing import Dict, Deque, List

from detectors.base import BaseDetector, DetectionEvent
from vision.pose_estimator import PersonPose
from config import settings

HISTORY_FRAMES = 60    # ~4 s at 15 fps
SHUFFLE_SPEED_PX_PER_FRAME = 1.5    # px per frame below which = shuffle
STRIDE_STD_THRESHOLD = 8.0          # ankle-y std deviation threshold


class GaitAnalyzer(BaseDetector):
    def __init__(self) -> None:
        self._centers: Dict[str, Deque] = defaultdict(lambda: deque(maxlen=HISTORY_FRAMES))
        self._ankle_y: Dict[str, Deque] = defaultdict(lambda: deque(maxlen=HISTORY_FRAMES))

    def process(self, frame_id: int, camera_id: str, zone: str, poses: List[PersonPose]):
        events: List[DetectionEvent] = []
        for pose in poses:
            rid = pose.reid_id or f"T{pose.track_id}"
            self._centers[rid].append(pose.center.copy())

            if pose.kp_visible("left_ankle") and pose.kp_visible("right_ankle"):
                avg_ankle_y = (pose.kp("left_ankle")[1] + pose.kp("right_ankle")[1]) / 2
                self._ankle_y[rid].append(avg_ankle_y)

            centers = np.array(self._centers[rid])
            if len(centers) < HISTORY_FRAMES // 2:
                continue

            # Speed: mean displacement per frame
            displacements = np.linalg.norm(np.diff(centers, axis=0), axis=1)
            mean_speed = float(np.mean(displacements))

            # Stride irregularity from ankle-y oscillation
            ankles = np.array(self._ankle_y[rid])
            stride_std = float(np.std(ankles)) if len(ankles) > 10 else 999.0

            if mean_speed < SHUFFLE_SPEED_PX_PER_FRAME and stride_std < STRIDE_STD_THRESHOLD:
                events.append(DetectionEvent(
                    event_type="gait_abnormal",
                    zone=zone,
                    camera_id=camera_id,
                    reid_id=rid,
                    confidence=0.70,
                    metadata={
                        "mean_speed_px": round(mean_speed, 2),
                        "stride_std": round(stride_std, 2),
                        "pattern": "shuffling",
                    },
                ))
        return events

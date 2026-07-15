"""Tremor & unsteady movement — high-frequency keypoint oscillation while walking."""
from __future__ import annotations
import numpy as np
from collections import defaultdict, deque
from typing import Dict, Deque, List

from detectors.base import BaseDetector, DetectionEvent
from vision.pose_estimator import PersonPose

WINDOW = 45          # ~3 s at 15 fps
TREMOR_STD_THRESHOLD = 4.5     # px std for hand/wrist keypoints = tremor
WALKING_SPEED_MIN_PX = 1.2     # only flag tremor if person is also moving


class TremorDetector(BaseDetector):
    def __init__(self) -> None:
        self._wrist_l: Dict[str, Deque] = defaultdict(lambda: deque(maxlen=WINDOW))
        self._wrist_r: Dict[str, Deque] = defaultdict(lambda: deque(maxlen=WINDOW))
        self._centers: Dict[str, Deque] = defaultdict(lambda: deque(maxlen=WINDOW))

    def process(self, frame_id: int, camera_id: str, zone: str, poses: List[PersonPose]):
        events: List[DetectionEvent] = []
        for pose in poses:
            rid = pose.reid_id or f"T{pose.track_id}"
            self._centers[rid].append(pose.center.copy())
            if pose.kp_visible("left_wrist"):
                self._wrist_l[rid].append(pose.kp("left_wrist")[:2].copy())
            if pose.kp_visible("right_wrist"):
                self._wrist_r[rid].append(pose.kp("right_wrist")[:2].copy())

            if len(self._centers[rid]) < WINDOW:
                continue

            centers = np.array(self._centers[rid])
            speed = float(np.mean(np.linalg.norm(np.diff(centers, axis=0), axis=1)))
            if speed < WALKING_SPEED_MIN_PX:
                continue

            stds = []
            for buf in (self._wrist_l[rid], self._wrist_r[rid]):
                if len(buf) > 10:
                    arr = np.array(buf)
                    stds.append(float(np.std(arr[:, 0])) + float(np.std(arr[:, 1])))

            if stds and max(stds) > TREMOR_STD_THRESHOLD:
                events.append(DetectionEvent(
                    event_type="tremor_detected",
                    zone=zone,
                    camera_id=camera_id,
                    reid_id=rid,
                    confidence=min(max(stds) / 10.0, 0.90),
                    metadata={"wrist_oscillation_std": round(max(stds), 2)},
                ))
        return events

"""Eating gesture — hand-to-mouth keypoint pattern; meal attendance proxy."""
from __future__ import annotations
import numpy as np
from collections import defaultdict
from typing import Dict, List

from detectors.base import BaseDetector, DetectionEvent
from vision.pose_estimator import PersonPose

MOUTH_HAND_DIST_FACTOR = 0.20  # wrist within 20% of torso-height from mouth


class EatingGestureDetector(BaseDetector):
    def __init__(self) -> None:
        self._gesture_count: Dict[str, int] = defaultdict(int)

    def _hand_near_mouth(self, pose: PersonPose) -> bool:
        if not (pose.kp_visible("nose") and pose.kp_visible("left_shoulder")):
            return False
        nose = pose.kp("nose")[:2]
        sh_mid = (pose.kp("left_shoulder")[:2] + pose.kp("right_shoulder")[:2]) / 2
        scale = float(np.linalg.norm(sh_mid - nose)) * 2  # rough torso unit
        for wrist in ("left_wrist", "right_wrist"):
            if pose.kp_visible(wrist):
                d = float(np.linalg.norm(pose.kp(wrist)[:2] - nose))
                if d < scale * MOUTH_HAND_DIST_FACTOR:
                    return True
        return False

    def process(self, frame_id: int, camera_id: str, zone: str, poses: List[PersonPose]):
        events: List[DetectionEvent] = []
        for pose in poses:
            rid = pose.reid_id or f"T{pose.track_id}"
            if self._hand_near_mouth(pose):
                self._gesture_count[rid] += 1
                if self._gesture_count[rid] == 5:  # confirmed after 5 frames
                    events.append(DetectionEvent(
                        event_type="eating_gesture",
                        zone=zone,
                        camera_id=camera_id,
                        reid_id=rid,
                        confidence=0.72,
                        metadata={},
                    ))
            else:
                self._gesture_count[rid] = max(0, self._gesture_count[rid] - 1)
        return events

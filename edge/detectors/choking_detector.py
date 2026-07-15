"""Choking gesture — one or both hands to throat keypoint pattern (dining hall)."""
from __future__ import annotations
import numpy as np
from collections import defaultdict
from typing import Dict, List

from detectors.base import BaseDetector, DetectionEvent
from vision.pose_estimator import PersonPose

THROAT_NECK_Y_FACTOR = 0.25   # wrist must be within 25% of neck-to-hip distance from neck


class ChokingDetector(BaseDetector):
    def __init__(self) -> None:
        self._counters: Dict[str, int] = defaultdict(int)
        self._alerted: Dict[str, bool] = defaultdict(bool)

    def _is_hand_at_throat(self, pose: PersonPose) -> bool:
        # Estimate throat as midpoint between nose and mid-shoulder
        if not (pose.kp_visible("nose") and pose.kp_visible("left_shoulder")
                and pose.kp_visible("right_shoulder")):
            return False

        nose = pose.kp("nose")[:2]
        sh_mid = (pose.kp("left_shoulder")[:2] + pose.kp("right_shoulder")[:2]) / 2
        throat = (nose + sh_mid) / 2

        # Hip reference for scale
        if pose.kp_visible("left_hip") and pose.kp_visible("right_hip"):
            hip_mid = (pose.kp("left_hip")[:2] + pose.kp("right_hip")[:2]) / 2
            scale = float(np.linalg.norm(sh_mid - hip_mid))
        else:
            scale = float(pose.height_px) * 0.4

        for wrist in ("left_wrist", "right_wrist"):
            if pose.kp_visible(wrist):
                dist = float(np.linalg.norm(pose.kp(wrist)[:2] - throat))
                if dist < scale * THROAT_NECK_Y_FACTOR:
                    return True
        return False

    def process(self, frame_id: int, camera_id: str, zone: str, poses: List[PersonPose]):
        events: List[DetectionEvent] = []
        for pose in poses:
            rid = pose.reid_id or f"T{pose.track_id}"
            if self._is_hand_at_throat(pose):
                self._counters[rid] += 1
            else:
                self._counters[rid] = 0
                self._alerted[rid] = False

            if self._counters[rid] >= 5 and not self._alerted[rid]:
                self._alerted[rid] = True
                events.append(DetectionEvent(
                    event_type="choking_gesture",
                    zone=zone,
                    camera_id=camera_id,
                    reid_id=rid,
                    confidence=0.80,
                    metadata={"consecutive_frames": self._counters[rid]},
                    clip_trigger=True,
                ))
        return events

"""Fall detection using keypoint geometry and aspect-ratio change."""
from __future__ import annotations
import numpy as np
from collections import defaultdict, deque
from typing import Dict, Deque, List

from detectors.base import BaseDetector, DetectionEvent
from vision.pose_estimator import PersonPose
from config import settings

# Shoulder-to-ankle vertical angle > threshold signals a fall
FALL_ANGLE_THRESHOLD = 45.0      # degrees from vertical
ASPECT_RATIO_THRESHOLD = 1.5    # width/height > this → person is horizontal
CONFIRMATION_FRAMES = 3          # must persist across N frames


class FallDetector(BaseDetector):
    def __init__(self) -> None:
        self._counters: Dict[str, int] = defaultdict(int)  # reid_id → consecutive fall frames
        self._alerted: Dict[str, bool] = defaultdict(bool)

    def _is_fallen(self, pose: PersonPose) -> tuple[bool, float]:
        kp = pose.keypoints

        # Method 1: bounding-box aspect ratio
        w = pose.bbox[2] - pose.bbox[0]
        h = pose.bbox[3] - pose.bbox[1]
        aspect = w / (h + 1e-6)

        # Method 2: shoulder-to-hip vertical angle
        angle_conf = 0.0
        if (pose.kp_visible("left_shoulder") and pose.kp_visible("left_hip") and
                pose.kp_visible("right_shoulder") and pose.kp_visible("right_hip")):
            sh = (kp[5, :2] + kp[6, :2]) / 2  # mid-shoulder
            hi = (kp[11, :2] + kp[12, :2]) / 2  # mid-hip
            delta = sh - hi
            angle = abs(np.degrees(np.arctan2(delta[0], delta[1] + 1e-6)))
            angle_conf = min(angle / 90.0, 1.0)

        fallen = aspect > ASPECT_RATIO_THRESHOLD or angle_conf > (FALL_ANGLE_THRESHOLD / 90.0)
        confidence = max(min(aspect / ASPECT_RATIO_THRESHOLD, 1.0), angle_conf)
        return fallen, confidence

    def process(self, frame_id: int, camera_id: str, zone: str, poses: List[PersonPose]):
        events: List[DetectionEvent] = []
        seen_ids = set()

        for pose in poses:
            rid = pose.reid_id or f"T{pose.track_id}"
            seen_ids.add(rid)
            fallen, conf = self._is_fallen(pose)

            if fallen:
                self._counters[rid] += 1
            else:
                self._counters[rid] = 0
                self._alerted[rid] = False

            if (self._counters[rid] >= CONFIRMATION_FRAMES
                    and not self._alerted[rid]
                    and conf >= settings.fall_confidence_threshold):
                self._alerted[rid] = True
                events.append(DetectionEvent(
                    event_type="fall_detected",
                    zone=zone,
                    camera_id=camera_id,
                    reid_id=rid,
                    confidence=round(conf, 3),
                    metadata={"aspect_ratio": round((pose.bbox[2]-pose.bbox[0])/(pose.bbox[3]-pose.bbox[1]+1e-6), 2)},
                    clip_trigger=True,
                ))
        return events

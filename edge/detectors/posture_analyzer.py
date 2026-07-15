"""Eating posture + slouch detection for dining hall and common room."""
from __future__ import annotations
import numpy as np
from collections import defaultdict
from typing import Dict, List

from detectors.base import BaseDetector, DetectionEvent
from vision.pose_estimator import PersonPose

SLOUCH_ANGLE_THRESHOLD = 30.0   # degrees — spine deviation from vertical
SEATED_HEIGHT_RATIO = 0.55      # bbox height < 55% of standing avg → seated


class PostureAnalyzer(BaseDetector):
    def __init__(self) -> None:
        self._standing_heights: Dict[str, float] = {}

    def _spine_angle(self, pose: PersonPose) -> float:
        """Angle of mid-shoulder → mid-hip vector from vertical."""
        if not (pose.kp_visible("left_shoulder") and pose.kp_visible("left_hip")):
            return 0.0
        sh = (pose.kp("left_shoulder")[:2] + pose.kp("right_shoulder")[:2]) / 2
        hi = (pose.kp("left_hip")[:2] + pose.kp("right_hip")[:2]) / 2
        delta = hi - sh
        return abs(float(np.degrees(np.arctan2(delta[0], delta[1] + 1e-6))))

    def process(self, frame_id: int, camera_id: str, zone: str, poses: List[PersonPose]):
        events: List[DetectionEvent] = []
        for pose in poses:
            rid = pose.reid_id or f"T{pose.track_id}"
            angle = self._spine_angle(pose)

            # Update standing height reference
            bbox_h = float(pose.bbox[3] - pose.bbox[1])
            if angle < 10 and bbox_h > 0:
                self._standing_heights[rid] = max(
                    self._standing_heights.get(rid, 0), bbox_h
                )

            seated = False
            if rid in self._standing_heights:
                seated = bbox_h < self._standing_heights[rid] * SEATED_HEIGHT_RATIO

            if angle > SLOUCH_ANGLE_THRESHOLD:
                events.append(DetectionEvent(
                    event_type="poor_posture",
                    zone=zone,
                    camera_id=camera_id,
                    reid_id=rid,
                    confidence=min(angle / 90.0, 0.95),
                    metadata={"spine_angle_deg": round(angle, 1), "seated": seated},
                ))
        return events

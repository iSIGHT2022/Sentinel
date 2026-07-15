"""Withdrawn posture & crowd stress — head-down angle and backing-away motion."""
from __future__ import annotations
import numpy as np
from collections import defaultdict, deque
from typing import Dict, Deque, List

from detectors.base import BaseDetector, DetectionEvent
from vision.pose_estimator import PersonPose

HEAD_DOWN_ANGLE = 40.0        # nose below shoulder midpoint by this many degrees
BACKING_AWAY_SPEED = 2.0      # px/frame moving away from nearest person


class MoodProxyDetector(BaseDetector):
    def __init__(self) -> None:
        self._head_down_frames: Dict[str, int] = defaultdict(int)
        self._centers: Dict[str, Deque] = defaultdict(lambda: deque(maxlen=30))

    def _head_angle_deg(self, pose: PersonPose) -> float:
        if not (pose.kp_visible("nose") and pose.kp_visible("left_shoulder")):
            return 0.0
        nose = pose.kp("nose")[:2]
        sh = (pose.kp("left_shoulder")[:2] + pose.kp("right_shoulder")[:2]) / 2
        delta = nose - sh
        return float(np.degrees(np.arctan2(delta[0], -delta[1] + 1e-6)))

    def process(self, frame_id: int, camera_id: str, zone: str, poses: List[PersonPose]):
        events: List[DetectionEvent] = []
        centers = {(p.reid_id or f"T{p.track_id}"): p.center for p in poses}

        for pose in poses:
            rid = pose.reid_id or f"T{pose.track_id}"
            self._centers[rid].append(pose.center.copy())

            # Withdrawn posture (head down)
            angle = self._head_angle_deg(pose)
            if angle > HEAD_DOWN_ANGLE:
                self._head_down_frames[rid] += 1
            else:
                self._head_down_frames[rid] = max(0, self._head_down_frames[rid] - 1)

            if self._head_down_frames[rid] == 45:  # ~3 s sustained
                events.append(DetectionEvent(
                    event_type="withdrawn_posture",
                    zone=zone,
                    camera_id=camera_id,
                    reid_id=rid,
                    confidence=0.65,
                    metadata={"head_angle_deg": round(angle, 1)},
                ))

            # Crowd stress: backing away from nearest person
            others = np.array([c for r, c in centers.items() if r != rid])
            if len(others) > 0 and len(self._centers[rid]) >= 10:
                nearest = others[np.argmin(np.linalg.norm(others - pose.center, axis=1))]
                hist = np.array(self._centers[rid])
                dists = np.linalg.norm(hist - nearest, axis=1)
                speed = float(np.mean(np.diff(dists)[-10:]))
                if speed > BACKING_AWAY_SPEED:
                    events.append(DetectionEvent(
                        event_type="crowd_stress",
                        zone=zone,
                        camera_id=camera_id,
                        reid_id=rid,
                        confidence=min(speed / 5.0, 0.80),
                        metadata={"backing_away_px_per_frame": round(speed, 2)},
                    ))
        return events

"""Social interaction and prolonged inactivity detection for lounge/dining."""
from __future__ import annotations
import numpy as np
import time
from collections import defaultdict, deque
from typing import Dict, Deque, List

from detectors.base import BaseDetector, DetectionEvent
from vision.pose_estimator import PersonPose

INTERACTION_DISTANCE_PX = 150   # persons within this distance = interacting
INACTIVITY_SECONDS = 300        # 5 min without movement = prolonged inactivity
MOVEMENT_THRESHOLD_PX = 10


class SocialDetector(BaseDetector):
    def __init__(self) -> None:
        self._last_moved: Dict[str, float] = {}
        self._last_center: Dict[str, np.ndarray] = {}
        self._inactivity_alerted: Dict[str, bool] = defaultdict(bool)

    def process(self, frame_id: int, camera_id: str, zone: str, poses: List[PersonPose]):
        events: List[DetectionEvent] = []
        now = time.time()
        centers = {(pose.reid_id or f"T{pose.track_id}"): pose.center for pose in poses}

        # Inactivity check
        for rid, center in centers.items():
            prev = self._last_center.get(rid)
            if prev is not None and np.linalg.norm(center - prev) > MOVEMENT_THRESHOLD_PX:
                self._last_moved[rid] = now
                self._inactivity_alerted[rid] = False
            elif rid not in self._last_moved:
                self._last_moved[rid] = now
            self._last_center[rid] = center.copy()

            elapsed = now - self._last_moved[rid]
            if elapsed > INACTIVITY_SECONDS and not self._inactivity_alerted[rid]:
                self._inactivity_alerted[rid] = True
                events.append(DetectionEvent(
                    event_type="prolonged_inactivity",
                    zone=zone,
                    camera_id=camera_id,
                    reid_id=rid,
                    confidence=0.75,
                    metadata={"inactive_minutes": round(elapsed / 60, 1)},
                ))

        # Social interaction detection (proximity pairs)
        rids = list(centers.keys())
        for i in range(len(rids)):
            for j in range(i + 1, len(rids)):
                dist = np.linalg.norm(centers[rids[i]] - centers[rids[j]])
                if dist < INTERACTION_DISTANCE_PX:
                    events.append(DetectionEvent(
                        event_type="social_interaction",
                        zone=zone,
                        camera_id=camera_id,
                        reid_id=rids[i],
                        confidence=0.65,
                        metadata={"partner_reid": rids[j], "distance_px": round(float(dist), 1)},
                    ))
        return events

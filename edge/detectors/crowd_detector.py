"""Crowd formation — multiple persons clustering around one individual (emergency proxy)."""
from __future__ import annotations
import numpy as np
from typing import List

from detectors.base import BaseDetector, DetectionEvent
from vision.pose_estimator import PersonPose

CLUSTER_RADIUS_PX = 120    # persons within radius = clustered
CLUSTER_MIN_COUNT = 3      # at least 3 persons around one individual


class CrowdDetector(BaseDetector):
    def process(self, frame_id: int, camera_id: str, zone: str, poses: List[PersonPose]):
        events: List[DetectionEvent] = []
        if len(poses) < CLUSTER_MIN_COUNT:
            return events

        centers = np.array([p.center for p in poses])
        rids = [p.reid_id or f"T{p.track_id}" for p in poses]

        for i, center in enumerate(centers):
            dists = np.linalg.norm(centers - center, axis=1)
            nearby = int(np.sum(dists < CLUSTER_RADIUS_PX)) - 1  # exclude self
            if nearby >= CLUSTER_MIN_COUNT - 1:
                events.append(DetectionEvent(
                    event_type="crowd_emergency",
                    zone=zone,
                    camera_id=camera_id,
                    reid_id=rids[i],
                    confidence=min(nearby / 5.0, 0.90),
                    metadata={
                        "persons_nearby": nearby,
                        "cluster_radius_px": CLUSTER_RADIUS_PX,
                    },
                    clip_trigger=True,
                ))
                break  # one event per frame per zone
        return events

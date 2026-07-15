"""Wandering / prolonged-dwell detection using trajectory analysis."""
from __future__ import annotations
import numpy as np
from collections import defaultdict, deque
from typing import Dict, Deque, List
import time

from detectors.base import BaseDetector, DetectionEvent
from vision.pose_estimator import PersonPose
from config import settings

DWELL_SECONDS = 120          # alert if person in same small area for > 2 min
DWELL_RADIUS_PX = 80         # "same area" threshold (pixels)
ERRATIC_PATH_THRESHOLD = 3.0 # path-length / displacement ratio for wandering


class WanderingDetector(BaseDetector):
    def __init__(self) -> None:
        self._history: Dict[str, Deque] = defaultdict(lambda: deque(maxlen=1800))
        self._first_seen: Dict[str, float] = {}
        self._dwell_alerted: Dict[str, bool] = defaultdict(bool)

    def _path_efficiency(self, positions: np.ndarray) -> float:
        """Returns path_length / displacement — high = wandering."""
        if len(positions) < 2:
            return 1.0
        displacements = np.linalg.norm(np.diff(positions, axis=0), axis=1)
        path_len = float(displacements.sum())
        net_disp = float(np.linalg.norm(positions[-1] - positions[0]))
        return path_len / (net_disp + 1e-6)

    def process(self, frame_id: int, camera_id: str, zone: str, poses: List[PersonPose]):
        events: List[DetectionEvent] = []
        now = time.time()

        for pose in poses:
            rid = pose.reid_id or f"T{pose.track_id}"
            self._history[rid].append(pose.center.copy())
            if rid not in self._first_seen:
                self._first_seen[rid] = now

            positions = np.array(self._history[rid])
            if len(positions) < 30:
                continue

            # Prolonged dwell: centroid hasn't moved much
            centroid = positions.mean(axis=0)
            dists = np.linalg.norm(positions - centroid, axis=1)
            if np.percentile(dists, 90) < DWELL_RADIUS_PX:
                dwell_sec = now - self._first_seen[rid]
                if dwell_sec > DWELL_SECONDS and not self._dwell_alerted[rid]:
                    self._dwell_alerted[rid] = True
                    events.append(DetectionEvent(
                        event_type="prolonged_dwell",
                        zone=zone,
                        camera_id=camera_id,
                        reid_id=rid,
                        confidence=0.80,
                        metadata={"dwell_seconds": int(dwell_sec)},
                    ))
            else:
                self._dwell_alerted[rid] = False
                self._first_seen[rid] = now

            # Erratic path = wandering
            efficiency = self._path_efficiency(positions[-90:])  # last 6 s
            if efficiency > ERRATIC_PATH_THRESHOLD:
                events.append(DetectionEvent(
                    event_type="wandering_detected",
                    zone=zone,
                    camera_id=camera_id,
                    reid_id=rid,
                    confidence=min(efficiency / 5.0, 0.95),
                    metadata={"path_efficiency_ratio": round(efficiency, 2)},
                ))
        return events

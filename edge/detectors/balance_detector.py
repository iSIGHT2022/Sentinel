"""Balance instability — frequent lateral weight shifts and centre-of-mass sway."""
from __future__ import annotations
import numpy as np
from collections import defaultdict, deque
from typing import Dict, Deque, List

from detectors.base import BaseDetector, DetectionEvent
from vision.pose_estimator import PersonPose

WINDOW = 45
SWAY_THRESHOLD_PX = 12.0       # lateral centre-of-mass sway > threshold
DIRECTION_REVERSAL_MIN = 5     # at least N direction reversals in window = instability


class BalanceDetector(BaseDetector):
    def __init__(self) -> None:
        self._hip_x: Dict[str, Deque] = defaultdict(lambda: deque(maxlen=WINDOW))

    def process(self, frame_id: int, camera_id: str, zone: str, poses: List[PersonPose]):
        events: List[DetectionEvent] = []
        for pose in poses:
            rid = pose.reid_id or f"T{pose.track_id}"

            if pose.kp_visible("left_hip") and pose.kp_visible("right_hip"):
                mid_hip_x = float((pose.kp("left_hip")[0] + pose.kp("right_hip")[0]) / 2)
                self._hip_x[rid].append(mid_hip_x)

            buf = self._hip_x[rid]
            if len(buf) < WINDOW:
                continue

            arr = np.array(buf)
            lateral_sway = float(np.std(arr))
            # Count direction reversals
            diff = np.diff(arr)
            reversals = int(np.sum(np.diff(np.sign(diff)) != 0))

            if lateral_sway > SWAY_THRESHOLD_PX and reversals >= DIRECTION_REVERSAL_MIN:
                events.append(DetectionEvent(
                    event_type="balance_instability",
                    zone=zone,
                    camera_id=camera_id,
                    reid_id=rid,
                    confidence=min(lateral_sway / 25.0, 0.90),
                    metadata={
                        "lateral_sway_px": round(lateral_sway, 2),
                        "direction_reversals": reversals,
                    },
                ))
        return events

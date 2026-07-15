"""
Room presence inference — inferred from corridor camera when resident not seen in
any common area for X minutes after entering room-side corridor.
No in-room camera exists; this is an inference only.
"""
from __future__ import annotations
import time
from collections import defaultdict
from typing import Dict, List, Set

from detectors.base import BaseDetector, DetectionEvent
from vision.pose_estimator import PersonPose

IN_ROOM_INFERENCE_MINUTES = 5
IN_ROOM_SECONDS = IN_ROOM_INFERENCE_MINUTES * 60


class RoomPresenceInferrer(BaseDetector):
    """
    Tracks last-seen time per person on the room-corridor camera.
    Emits room_entry_inferred when a person disappears toward the room side.
    Emits in_room_inferred periodically while they remain unseen.
    """
    def __init__(self) -> None:
        self._last_seen: Dict[str, float] = {}
        self._entry_emitted: Set[str] = set()
        self._in_room_alerted: Dict[str, float] = {}

    def record_seen(self, reid_id: str) -> None:
        self._last_seen[reid_id] = time.time()
        self._entry_emitted.discard(reid_id)

    def process(self, frame_id: int, camera_id: str, zone: str, poses: List[PersonPose]):
        events: List[DetectionEvent] = []
        now = time.time()

        # Update last-seen for visible persons
        for pose in poses:
            rid = pose.reid_id or f"T{pose.track_id}"
            self.record_seen(rid)

        # Check persons last seen but not currently visible
        for rid, last in list(self._last_seen.items()):
            if any((p.reid_id or f"T{p.track_id}") == rid for p in poses):
                continue  # still visible

            elapsed = now - last
            if elapsed > IN_ROOM_SECONDS and rid not in self._entry_emitted:
                self._entry_emitted.add(rid)
                events.append(DetectionEvent(
                    event_type="room_entry_inferred",
                    zone=zone,
                    camera_id=camera_id,
                    reid_id=rid,
                    confidence=0.70,
                    metadata={
                        "minutes_unseen": round(elapsed / 60, 1),
                        "note": "Inferred only — no in-room camera",
                    },
                ))
        return events

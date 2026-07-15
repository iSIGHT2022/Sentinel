"""Per-camera frame processing pipeline — pose → track → detect → emit."""
from __future__ import annotations
import cv2
import asyncio
import numpy as np
import time
from typing import Dict, List, Optional

from vision.pose_estimator import PoseEstimator
from vision.tracker import ByteTracker
from vision.zone_mapper import get_zone, ENTRY_ONLY_ZONES
from detectors.fall_detector import FallDetector
from detectors.slow_collapse_detector import SlowCollapseDetector
from detectors.gait_analyzer import GaitAnalyzer
from detectors.tremor_detector import TremorDetector
from detectors.limb_symmetry_analyzer import LimbSymmetryAnalyzer
from detectors.balance_detector import BalanceDetector
from detectors.wandering_detector import WanderingDetector
from detectors.pacing_detector import PacingDetector
from detectors.posture_analyzer import PostureAnalyzer
from detectors.duration_tracker import DurationTracker
from detectors.social_detector import SocialDetector
from detectors.choking_detector import ChokingDetector
from detectors.crowd_detector import CrowdDetector
from detectors.eating_gesture_detector import EatingGestureDetector
from detectors.confusion_mapper import ConfusionMapper
from detectors.mood_proxy_detector import MoodProxyDetector
from detectors.room_presence_inferrer import RoomPresenceInferrer
from detectors.base import DetectionEvent
from pipeline.event_emitter import EventEmitter
from config import settings


class CameraProcessor:
    def __init__(self, camera_id: str, source: Optional[str], emitter: EventEmitter) -> None:
        self.camera_id = camera_id
        self.source = source
        self.emitter = emitter
        self.zone_ctx = get_zone(camera_id)

        self._pose = PoseEstimator()
        self._tracker = ByteTracker()

        zone = self.zone_ctx.zone

        # Universal detectors — every common area
        self._detectors = [
            FallDetector(),
            SlowCollapseDetector(),
            WanderingDetector(),
            CrowdDetector(),
            MoodProxyDetector(),
        ]

        # Zone-specific detectors
        if zone == "bathroom_entry":
            self._duration = DurationTracker()
            self._detectors.append(self._duration)
        else:
            # Gait suite — all non-bathroom zones
            self._detectors.extend([
                GaitAnalyzer(),
                TremorDetector(),
                LimbSymmetryAnalyzer(),
                BalanceDetector(),
                PacingDetector(),
                PostureAnalyzer(),
            ])

        if zone == "dining_hall":
            self._detectors.extend([
                SocialDetector(),
                ChokingDetector(),
                EatingGestureDetector(),
            ])
        elif zone == "common_room_lounge":
            self._detectors.extend([SocialDetector()])

        if zone in ("corridors_hallways", "stairwells_elevators"):
            self._detectors.append(ConfusionMapper())

        if zone == "corridors_hallways":
            self._detectors.append(RoomPresenceInferrer())

        self._frame_id = 0

    async def run(self) -> None:
        """Pull-mode loop — reads frames from an RTSP/webcam source configured via CAMERA_SOURCES."""
        cap = cv2.VideoCapture(self.source)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)
        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    await asyncio.sleep(1)
                    continue
                await self.ingest(frame)
        finally:
            cap.release()

    async def ingest(self, frame: np.ndarray) -> None:
        """Push-mode entry point — feeds a single already-decoded frame through the pipeline.
        Used both by the pull-mode loop above and by the WebSocket ingest route for
        phone/CCTV clients that stream frames directly."""
        self._frame_id += 1
        if self._frame_id % settings.frame_skip != 0:
            return
        await self._process(frame)

    async def _process(self, frame: np.ndarray) -> None:
        poses = self._pose.infer(frame)
        poses = self._tracker.assign_reid(frame, poses)

        all_events: List[DetectionEvent] = []
        for detector in self._detectors:
            events = detector.process(
                self._frame_id,
                self.camera_id,
                self.zone_ctx.zone,
                poses,
            )
            all_events.extend(events)

        for event in all_events:
            await self.emitter.emit(event, frame if event.clip_trigger else None)

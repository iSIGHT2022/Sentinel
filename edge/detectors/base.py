from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from vision.pose_estimator import PersonPose


@dataclass
class DetectionEvent:
    event_type: str
    zone: str
    camera_id: str
    reid_id: Optional[str]
    confidence: float
    metadata: Dict[str, Any] = field(default_factory=dict)
    clip_trigger: bool = False  # whether to save an evidence clip


class BaseDetector(ABC):
    @abstractmethod
    def process(
        self,
        frame_id: int,
        camera_id: str,
        zone: str,
        poses: List[PersonPose],
    ) -> List[DetectionEvent]:
        ...

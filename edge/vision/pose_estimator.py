"""YOLOv8-pose wrapper — returns keypoints + bounding boxes per frame."""
from __future__ import annotations
import numpy as np
from dataclasses import dataclass, field
from typing import List, Optional
import torch

from ultralytics import YOLO
from config import settings

# COCO 17-keypoint indices
KP = {
    "nose": 0, "left_eye": 1, "right_eye": 2, "left_ear": 3, "right_ear": 4,
    "left_shoulder": 5, "right_shoulder": 6,
    "left_elbow": 7, "right_elbow": 8,
    "left_wrist": 9, "right_wrist": 10,
    "left_hip": 11, "right_hip": 12,
    "left_knee": 13, "right_knee": 14,
    "left_ankle": 15, "right_ankle": 16,
}


@dataclass
class PersonPose:
    bbox: np.ndarray          # [x1, y1, x2, y2]
    keypoints: np.ndarray     # (17, 3) — x, y, confidence
    confidence: float
    track_id: Optional[int] = None
    reid_id: Optional[str] = None

    @property
    def center(self) -> np.ndarray:
        return np.array([(self.bbox[0] + self.bbox[2]) / 2,
                         (self.bbox[1] + self.bbox[3]) / 2])

    @property
    def height_px(self) -> float:
        return float(self.bbox[3] - self.bbox[1])

    def kp(self, name: str) -> np.ndarray:
        """Return (x, y, conf) for a named keypoint."""
        return self.keypoints[KP[name]]

    def kp_visible(self, name: str, min_conf: float = 0.3) -> bool:
        return float(self.kp(name)[2]) >= min_conf


class PoseEstimator:
    def __init__(self) -> None:
        self.model = YOLO(settings.yolo_model_path)
        self.device = settings.device
        self.model.to(self.device)

    def infer(self, frame: np.ndarray) -> List[PersonPose]:
        results = self.model(
            frame,
            device=self.device,
            verbose=False,
            conf=0.25,
            iou=0.45,
        )
        poses: List[PersonPose] = []
        for r in results:
            if r.keypoints is None or r.boxes is None:
                continue
            kps = r.keypoints.data.cpu().numpy()   # (N, 17, 3)
            boxes = r.boxes.xyxy.cpu().numpy()      # (N, 4)
            confs = r.boxes.conf.cpu().numpy()      # (N,)
            for i in range(len(boxes)):
                poses.append(PersonPose(
                    bbox=boxes[i],
                    keypoints=kps[i],
                    confidence=float(confs[i]),
                ))
        return poses

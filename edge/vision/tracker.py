"""ByteTrack multi-person tracker with OSNet Re-ID for cross-camera identity."""
from __future__ import annotations
import numpy as np
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
import torch
import torchreid

from vision.pose_estimator import PersonPose
from config import settings


@dataclass
class TrackState:
    track_id: int
    reid_id: Optional[str]
    history: List[np.ndarray] = field(default_factory=list)  # center positions


class ByteTracker:
    """Lightweight ByteTrack wrapper using Ultralytics built-in tracker."""

    def __init__(self) -> None:
        # Re-ID model for cross-camera identity matching
        self._reid = self._load_reid()
        self._gallery: Dict[str, np.ndarray] = {}   # reid_id → feature vector
        self._track_to_reid: Dict[int, str] = {}

    def _load_reid(self):
        try:
            model = torchreid.models.build_model(
                name="osnet_x1_0",
                num_classes=1000,
                pretrained=False,
            )
            torchreid.utils.load_pretrained_weights(model, settings.reid_model_path)
            model.eval()
            if settings.device == "cuda" and torch.cuda.is_available():
                model = model.cuda()
            return model
        except Exception:
            return None  # Re-ID optional; fall back to track_id only

    def _extract_feature(self, frame: np.ndarray, bbox: np.ndarray) -> Optional[np.ndarray]:
        if self._reid is None:
            return None
        import cv2
        x1, y1, x2, y2 = map(int, bbox)
        crop = frame[max(0, y1):y2, max(0, x1):x2]
        if crop.size == 0:
            return None
        crop = cv2.resize(crop, (128, 256))
        t = torch.tensor(crop.transpose(2, 0, 1), dtype=torch.float32).unsqueeze(0) / 255.0
        if settings.device == "cuda":
            t = t.cuda()
        with torch.no_grad():
            feat = self._reid(t).cpu().numpy()[0]
        return feat / (np.linalg.norm(feat) + 1e-6)

    def _match_reid(self, feature: np.ndarray, threshold: float = 0.6) -> Optional[str]:
        best_id, best_sim = None, -1.0
        for rid, gf in self._gallery.items():
            sim = float(np.dot(feature, gf))
            if sim > best_sim:
                best_sim, best_id = sim, rid
        if best_sim >= threshold:
            return best_id
        return None

    def assign_reid(
        self, frame: np.ndarray, poses: List[PersonPose]
    ) -> List[PersonPose]:
        for pose in poses:
            if pose.track_id is None:
                continue
            tid = pose.track_id
            if tid in self._track_to_reid:
                pose.reid_id = self._track_to_reid[tid]
                continue
            feat = self._extract_feature(frame, pose.bbox)
            if feat is None:
                pose.reid_id = f"T{tid}"
                continue
            matched = self._match_reid(feat)
            if matched:
                reid_id = matched
            else:
                reid_id = f"R{len(self._gallery):04d}"
                self._gallery[reid_id] = feat
            self._track_to_reid[tid] = reid_id
            pose.reid_id = reid_id
        return poses

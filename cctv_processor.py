#!/usr/bin/env python3
"""
SENTINEL CCTV Processor  (torch-free build)
============================================
Stack: cv2.dnn / onnxruntime · MediaPipe Pose · centroid tracker
No PyTorch or ultralytics required.

Detection suite
---------------
  Person detection          YOLOv8n ONNX  (cv2.dnn)
  Multi-person tracking     IoU centroid tracker
  Pose estimation           MediaPipe Pose per person crop
  Posture classification    Standing / Sitting / Lying
  Fall detection            Upright→Lying + bbox aspect ratio
  Sleeping                  Lying + inactivity > 60 s
  Yoga poses                Warrior · Tree · Downward-Dog · T-Pose · Wide-Stance · Mountain-Arms
  Exercise                  Plank · Squat · Arms-Raised · Arms-Overhead · Lateral-Raise · Seated-Raise
  Gait analysis             Shuffling · Balance instability
  Limping                   Ankle Y-oscillation asymmetry
  Tremor detection          Wrist oscillation amplitude
  Wandering                 Path efficiency ratio < 0.28
  Prolonged inactivity      Position delta timer > 60 s
  Bathroom dwell            Zone-specific entry timestamp > 10 min

First run
---------
  python setup_model.py          # downloads yolov8n.onnx (~12 MB)
  python cctv_processor.py --droidcam-ip 192.168.1.42
  python cctv_processor.py --source 0 --zone bathroom_entry
"""

from __future__ import annotations

import argparse
import math
import socket
import threading
import time
import uuid
import queue as Q
import logging
from collections import deque, Counter
from typing import Optional

import cv2
import numpy as np
import requests

# MediaPipe 0.10+ removed mp.solutions — mock matplotlib so Tasks API loads cleanly
import sys as _sys
from unittest.mock import MagicMock as _MM
for _m in ("matplotlib", "matplotlib.pyplot", "matplotlib.colors",
           "matplotlib.patches", "matplotlib.lines"):
    _sys.modules.setdefault(_m, _MM())

import mediapipe as mp
from mediapipe.tasks import python as _mp_tasks
from mediapipe.tasks.python import vision as _mp_vision

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s  %(levelname)-7s  %(message)s")
log = logging.getLogger("sentinel")

# ── Defaults ───────────────────────────────────────────────────────────────────
DEFAULT_BACKEND    = "http://localhost:8000"
DEFAULT_MJPEG_PORT = 8081
DEFAULT_MODEL      = "yolov8n.onnx"
DEFAULT_POSE_MODEL = "pose_landmarker_lite.task"
DEFAULT_ZONE       = "corridors_hallways"
YOLO_INPUT_SIZE    = 640

# ── MediaPipe landmark indices ─────────────────────────────────────────────────
_NOSE        = 0
_L_SHOULDER  = 11;  _R_SHOULDER = 12
_L_ELBOW     = 13;  _R_ELBOW    = 14
_L_WRIST     = 15;  _R_WRIST    = 16
_L_HIP       = 23;  _R_HIP      = 24
_L_KNEE      = 25;  _R_KNEE     = 26
_L_ANKLE     = 27;  _R_ANKLE    = 28

# ── Event cooldowns (s) ────────────────────────────────────────────────────────
_COOLDOWN: dict[str, float] = {
    "fall_detected":              30,  "sleeping_detected":        120,
    "wandering_detected":         45,  "prolonged_inactivity":     120,
    "gait_abnormal":              60,  "balance_instability":       60,
    "tremor_detected":            60,  "limping_detected":          60,
    "bathroom_extended_stay":    300,
    "yoga_warrior":               30,  "yoga_tree":                 30,
    "yoga_downward_dog":          30,  "yoga_t_pose":               30,
    "yoga_wide_stance":           30,  "yoga_mountain_arms_wide":   30,
    "exercise_plank":             30,  "exercise_squat":            30,
    "exercise_arms_raised":       30,  "exercise_arms_overhead":    30,
    "exercise_arm_lateral_raise": 30,  "exercise_seated_arm_raise": 30,
    # posture update events
    "posture_standing":  30, "posture_sitting":   30,
    "posture_lying":     15, "posture_crouching": 20,
    "posture_bending":   20,
}

_SKELETON = [
    (_L_SHOULDER, _R_SHOULDER),
    (_L_SHOULDER, _L_ELBOW), (_L_ELBOW, _L_WRIST),
    (_R_SHOULDER, _R_ELBOW), (_R_ELBOW, _R_WRIST),
    (_L_SHOULDER, _L_HIP),   (_R_SHOULDER, _R_HIP),
    (_L_HIP, _R_HIP),
    (_L_HIP, _L_KNEE), (_L_KNEE, _L_ANKLE),
    (_R_HIP, _R_KNEE), (_R_KNEE, _R_ANKLE),
]

_POSTURE_COLOR = {
    "standing":  ( 50, 210,  50),   # green
    "sitting":   ( 50, 160, 255),   # blue
    "lying":     ( 50,  50, 255),   # red-blue
    "crouching": (  0, 200, 200),   # cyan
    "bending":   (200, 130,   0),   # orange
    "unknown":   (150, 150, 150),   # grey
}


# ══════════════════════════════════════════════════════════════════════════════
#  Person detector  (YOLOv8n ONNX when available, HOG fallback otherwise)
# ══════════════════════════════════════════════════════════════════════════════

class PersonDetector:
    """
    Automatically picks the best available backend:
      1. YOLOv8n ONNX via cv2.dnn  (most accurate, needs yolov8n.onnx)
      2. OpenCV HOG SVM             (built-in, zero setup, works immediately)
    """
    def __init__(self, model_path: str, conf: float = 0.42, iou: float = 0.45):
        self.conf = conf
        self.iou  = iou
        self._yolo_net = None
        self._hog      = None

        import os
        if model_path and os.path.exists(model_path):
            try:
                net = cv2.dnn.readNetFromONNX(model_path)
                net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
                net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
                self._yolo_net = net
                log.info(f"Detector: YOLOv8n ONNX ({model_path})")
            except Exception as e:
                log.warning(f"ONNX load failed ({e}) — falling back to HOG")

        if self._yolo_net is None:
            self._hog = cv2.HOGDescriptor()
            self._hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
            log.info("Detector: OpenCV HOG (built-in)  —  place yolov8n.onnx here for better accuracy")

    def detect(self, frame: np.ndarray) -> list[tuple[int,int,int,int,float]]:
        if self._yolo_net is not None:
            return self._detect_yolo(frame)
        return self._detect_hog(frame)

    # ── YOLOv8n ONNX ─────────────────────────────────────────────────────────
    def _detect_yolo(self, frame: np.ndarray) -> list[tuple[int,int,int,int,float]]:
        h, w = frame.shape[:2]
        S    = YOLO_INPUT_SIZE

        scale  = min(S/w, S/h)
        new_w  = int(w*scale); new_h = int(h*scale)
        pad_x  = (S-new_w)//2; pad_y = (S-new_h)//2
        padded = np.full((S,S,3), 114, dtype=np.uint8)
        padded[pad_y:pad_y+new_h, pad_x:pad_x+new_w] = cv2.resize(frame, (new_w,new_h))

        blob = cv2.dnn.blobFromImage(padded, 1/255.0, (S,S), swapRB=True, crop=False)
        self._yolo_net.setInput(blob)
        raw = self._yolo_net.forward()[0].T   # (8400, 84)

        cx_n,cy_n,bw_n,bh_n = raw[:,0],raw[:,1],raw[:,2],raw[:,3]
        person_scores = raw[:,4]

        mask = person_scores >= self.conf
        if not mask.any(): return []
        cx_n,cy_n,bw_n,bh_n,confs = cx_n[mask],cy_n[mask],bw_n[mask],bh_n[mask],person_scores[mask]

        x1 = np.clip(((cx_n-bw_n/2-pad_x)/scale), 0, w).astype(int)
        y1 = np.clip(((cy_n-bh_n/2-pad_y)/scale), 0, h).astype(int)
        x2 = np.clip(((cx_n+bw_n/2-pad_x)/scale), 0, w).astype(int)
        y2 = np.clip(((cy_n+bh_n/2-pad_y)/scale), 0, h).astype(int)

        cv_boxes = [[int(x1[i]),int(y1[i]),int(x2[i]-x1[i]),int(y2[i]-y1[i])] for i in range(len(x1))]
        idxs = cv2.dnn.NMSBoxes(cv_boxes, confs.tolist(), self.conf, self.iou)
        if len(idxs)==0: return []
        return [(x1[i],y1[i],x2[i],y2[i],float(confs[i])) for i in idxs.flatten()]

    # ── HOG SVM (built-in, no model file needed) ─────────────────────────────
    def _detect_hog(self, frame: np.ndarray) -> list[tuple[int,int,int,int,float]]:
        h, w = frame.shape[:2]
        scale = min(1.0, 640 / max(h, w))
        small = cv2.resize(frame, (int(w*scale), int(h*scale))) if scale < 1.0 else frame
        rects, weights = self._hog.detectMultiScale(
            small, winStride=(8,8), padding=(8,8), scale=1.05,
            hitThreshold=0.5,   # suppress background hits
        )
        if len(rects) == 0:
            return []
        result = []
        for i, (x, y, bw, bh) in enumerate(rects):
            wt = float(weights[i].item() if hasattr(weights[i], "item") else weights[i])
            # strict confidence gate
            if wt < 0.8:
                continue
            x1, y1 = int(x / scale), int(y / scale)
            x2, y2 = int((x + bw) / scale), int((y + bh) / scale)
            box_h, box_w = y2 - y1, x2 - x1
            # must look like a person: taller than wide, at least 80px tall
            if box_h < 80 or box_w < 30 or box_h < box_w * 1.2:
                continue
            result.append((x1, y1, x2, y2, min(wt / 3.0, 1.0)))
        if len(result) > 1:
            boxes  = [[x1, y1, x2-x1, y2-y1] for x1,y1,x2,y2,_ in result]
            scores = [s for *_,s in result]
            idxs   = cv2.dnn.NMSBoxes(boxes, scores, 0.3, 0.45)
            result = [result[i] for i in idxs.flatten()] if len(idxs) else result
        return result


# ══════════════════════════════════════════════════════════════════════════════
#  Centroid IoU tracker  (replaces ByteTrack)
# ══════════════════════════════════════════════════════════════════════════════

def _iou(a: tuple, b: tuple) -> float:
    ax1,ay1,ax2,ay2 = a[:4]; bx1,by1,bx2,by2 = b[:4]
    ix1,iy1 = max(ax1,bx1), max(ay1,by1)
    ix2,iy2 = min(ax2,bx2), min(ay2,by2)
    inter = max(0,ix2-ix1)*max(0,iy2-iy1)
    ua = (ax2-ax1)*(ay2-ay1) + (bx2-bx1)*(by2-by1) - inter
    return inter/ua if ua > 0 else 0.0


class CentroidTracker:
    def __init__(self, max_lost: int = 45, min_iou: float = 0.25):
        self.next_id:  int                     = 0
        self.boxes:    dict[int, tuple]        = {}   # id → (x1,y1,x2,y2,conf)
        self.lost:     dict[int, int]          = {}   # id → lost-frame count
        self.max_lost  = max_lost
        self.min_iou   = min_iou

    def update(self, detections: list[tuple]) -> dict[int, tuple]:
        """Returns {track_id: (x1,y1,x2,y2,conf)}"""
        if not detections:
            for oid in list(self.lost):
                self.lost[oid] += 1
                if self.lost[oid] > self.max_lost:
                    del self.boxes[oid]; del self.lost[oid]
            return dict(self.boxes)

        used_trk: set[int] = set()
        used_det: set[int] = set()

        # IoU matching
        for oid, obox in list(self.boxes.items()):
            best_iou, best_di = -1.0, -1
            for di, det in enumerate(detections):
                if di in used_det:
                    continue
                iou = _iou(obox, det)
                if iou > best_iou:
                    best_iou, best_di = iou, di
            if best_iou >= self.min_iou:
                self.boxes[oid] = detections[best_di]
                self.lost[oid]  = 0
                used_trk.add(oid); used_det.add(best_di)

        # Age out unmatched tracks
        for oid in list(self.boxes):
            if oid not in used_trk:
                self.lost[oid] = self.lost.get(oid, 0) + 1
                if self.lost[oid] > self.max_lost:
                    del self.boxes[oid]; del self.lost[oid]

        # Register new detections
        for di, det in enumerate(detections):
            if di not in used_det:
                self.boxes[self.next_id] = det
                self.lost[self.next_id]  = 0
                self.next_id += 1

        return dict(self.boxes)


# ══════════════════════════════════════════════════════════════════════════════
#  Geometry helpers
# ══════════════════════════════════════════════════════════════════════════════

def _angle(a, b, c) -> float:
    a=np.asarray(a,float); b=np.asarray(b,float); c=np.asarray(c,float)
    ba,bc = a-b, c-b
    cos = np.dot(ba,bc)/(np.linalg.norm(ba)*np.linalg.norm(bc)+1e-7)
    return float(np.degrees(np.arccos(np.clip(cos,-1.,1.))))

def _vis(lms, *idxs, thr:float=0.4) -> bool:
    return all((lms[i].visibility or 0.0) >= thr for i in idxs)

def _xy(lms, i) -> tuple[float,float]:
    return (lms[i].x, lms[i].y)


# ══════════════════════════════════════════════════════════════════════════════
#  Posture classification
# ══════════════════════════════════════════════════════════════════════════════

def classify_posture(lms) -> str:
    if lms is None:
        return "unknown"

    has_torso   = _vis(lms, _L_SHOULDER, _R_SHOULDER, _L_HIP, _R_HIP, thr=0.25)
    has_knees   = _vis(lms, _L_KNEE,  _R_KNEE,  thr=0.25)
    has_ankles  = _vis(lms, _L_ANKLE, _R_ANKLE, thr=0.25)

    if not has_torso:
        # try shoulders only
        if not _vis(lms, _L_SHOULDER, _R_SHOULDER, thr=0.25):
            return "unknown"

    # ── Torso tilt (0° = perfectly vertical, 90° = flat horizontal) ──────
    sh_x = (lms[_L_SHOULDER].x + lms[_R_SHOULDER].x) / 2
    sh_y = (lms[_L_SHOULDER].y + lms[_R_SHOULDER].y) / 2
    hp_x = (lms[_L_HIP].x + lms[_R_HIP].x) / 2 if has_torso else sh_x
    hp_y = (lms[_L_HIP].y + lms[_R_HIP].y) / 2 if has_torso else sh_y + 0.2
    tilt = math.degrees(math.atan2(abs(sh_x - hp_x), abs(sh_y - hp_y) + 1e-7))

    # ── Lying down ────────────────────────────────────────────────────────
    if tilt > 50:
        return "lying"

    # ── Knee angles ───────────────────────────────────────────────────────
    avg_knee = 180.0
    if has_knees and has_torso:
        if has_ankles:
            lk = _angle(_xy(lms, _L_HIP),  _xy(lms, _L_KNEE), _xy(lms, _L_ANKLE))
            rk = _angle(_xy(lms, _R_HIP),  _xy(lms, _R_KNEE), _xy(lms, _R_ANKLE))
        else:
            # estimate from hip→knee vector direction
            lk = _angle(_xy(lms, _L_SHOULDER), _xy(lms, _L_HIP), _xy(lms, _L_KNEE))
            rk = _angle(_xy(lms, _R_SHOULDER), _xy(lms, _R_HIP), _xy(lms, _R_KNEE))
        avg_knee = (lk + rk) / 2

    # ── Crouching: deeply bent knees, torso upright ───────────────────────
    if avg_knee < 100 and tilt < 25:
        return "crouching"

    # ── Sitting: moderately bent knees ────────────────────────────────────
    if avg_knee < 135 and tilt < 35:
        return "sitting"

    # ── Forward bend: torso tilted but legs more vertical ─────────────────
    if 25 < tilt <= 50 and avg_knee > 140:
        return "bending"

    # ── Standing ──────────────────────────────────────────────────────────
    return "standing"


# ══════════════════════════════════════════════════════════════════════════════
#  Yoga recognition
# ══════════════════════════════════════════════════════════════════════════════

def detect_yoga(lms) -> Optional[str]:
    if not _vis(lms,_L_SHOULDER,_R_SHOULDER,_L_HIP,_R_HIP,_L_WRIST,_R_WRIST,thr=0.4):
        return None
    lw_y,rw_y = lms[_L_WRIST].y, lms[_R_WRIST].y
    lw_x,rw_x = lms[_L_WRIST].x, lms[_R_WRIST].x
    ls_y,rs_y = lms[_L_SHOULDER].y, lms[_R_SHOULDER].y
    ls_x,rs_x = lms[_L_SHOULDER].x, lms[_R_SHOULDER].x
    nose_y = lms[_NOSE].y if _vis(lms,_NOSE,thr=0.3) else 0.05
    arms_oh = lw_y < nose_y and rw_y < nose_y
    arms_t  = (abs(lw_y-ls_y)<0.12 and abs(rw_y-rs_y)<0.12
               and lw_x<ls_x-0.15 and rw_x>rs_x+0.15)
    # Warrior
    if _vis(lms,_L_KNEE,_R_KNEE,thr=0.4):
        lk = _angle(_xy(lms,_L_HIP),_xy(lms,_L_KNEE),_xy(lms,_L_ANKLE)) if _vis(lms,_L_ANKLE,thr=0.3) else 180
        rk = _angle(_xy(lms,_R_HIP),_xy(lms,_R_KNEE),_xy(lms,_R_ANKLE)) if _vis(lms,_R_ANKLE,thr=0.3) else 180
        if (lk<100 or rk<100) and (lw_y<ls_y or rw_y<rs_y):
            return "yoga_warrior"
    if arms_t: return "yoga_t_pose"
    # Tree
    if arms_oh and _vis(lms,_L_ANKLE,_R_ANKLE,thr=0.4):
        lky = lms[_L_KNEE].y if _vis(lms,_L_KNEE,thr=0.4) else 1.0
        rky = lms[_R_KNEE].y if _vis(lms,_R_KNEE,thr=0.4) else 1.0
        if lms[_L_ANKLE].y<lky-0.08 or lms[_R_ANKLE].y<rky-0.08:
            return "yoga_tree"
    # Downward dog
    hp_y=(lms[_L_HIP].y+lms[_R_HIP].y)/2
    if _vis(lms,_L_ANKLE,_R_ANKLE,_L_WRIST,_R_WRIST,thr=0.3):
        if hp_y<lms[_L_WRIST].y-0.05 and hp_y<lms[_L_ANKLE].y-0.05:
            return "yoga_downward_dog"
    # Wide stance
    if _vis(lms,_L_ANKLE,_R_ANKLE,thr=0.4):
        if abs(lms[_L_ANKLE].x-lms[_R_ANKLE].x)>0.35 and not arms_oh:
            return "yoga_wide_stance"
    # Mountain arms wide
    if abs(lw_y-ls_y)<0.15 and abs(rw_y-rs_y)<0.15 and lw_x<ls_x-0.08 and rw_x>rs_x+0.08:
        return "yoga_mountain_arms_wide"
    return None


# ══════════════════════════════════════════════════════════════════════════════
#  Exercise recognition
# ══════════════════════════════════════════════════════════════════════════════

def detect_exercise(lms, posture: str) -> Optional[str]:
    if not _vis(lms,_L_SHOULDER,_R_SHOULDER,thr=0.4): return None
    ls_y,rs_y = lms[_L_SHOULDER].y, lms[_R_SHOULDER].y
    ls_x,rs_x = lms[_L_SHOULDER].x, lms[_R_SHOULDER].x
    nose_y = lms[_NOSE].y if _vis(lms,_NOSE,thr=0.3) else 0.05
    lwy = lms[_L_WRIST].y if _vis(lms,_L_WRIST,thr=0.3) else None
    rwy = lms[_R_WRIST].y if _vis(lms,_R_WRIST,thr=0.3) else None
    lwx = lms[_L_WRIST].x if _vis(lms,_L_WRIST,thr=0.3) else None
    rwx = lms[_R_WRIST].x if _vis(lms,_R_WRIST,thr=0.3) else None
    # Plank
    if posture=="lying" and _vis(lms,_L_ELBOW,_R_ELBOW,thr=0.3):
        le = _angle(_xy(lms,_L_SHOULDER),_xy(lms,_L_ELBOW),_xy(lms,_L_WRIST)) if _vis(lms,_L_WRIST,thr=0.3) else 0
        re = _angle(_xy(lms,_R_SHOULDER),_xy(lms,_R_ELBOW),_xy(lms,_R_WRIST)) if _vis(lms,_R_WRIST,thr=0.3) else 0
        if le>150 or re>150: return "exercise_plank"
    # Squat
    if posture=="sitting" and _vis(lms,_L_KNEE,_R_KNEE,_L_ANKLE,_R_ANKLE,thr=0.4):
        lk=_angle(_xy(lms,_L_HIP),_xy(lms,_L_KNEE),_xy(lms,_L_ANKLE))
        rk=_angle(_xy(lms,_R_HIP),_xy(lms,_R_KNEE),_xy(lms,_R_ANKLE))
        if lk<90 and rk<90: return "exercise_squat"
    if lwy is None or rwy is None: return None
    if lwy<nose_y and rwy<nose_y:
        return "exercise_seated_arm_raise" if posture=="sitting" else "exercise_arms_overhead"
    if lwy<ls_y and rwy<rs_y: return "exercise_arms_raised"
    if (lwx is not None and rwx is not None
            and abs(lwy-ls_y)<0.13 and abs(rwy-rs_y)<0.13
            and lwx<ls_x-0.12 and rwx>rs_x+0.12):
        return "exercise_arm_lateral_raise"
    return None


# ══════════════════════════════════════════════════════════════════════════════
#  PersonTrack — per-person state machine
# ══════════════════════════════════════════════════════════════════════════════

class PersonTrack:
    def __init__(self, tid: int, zone: str):
        self.track_id = tid
        self.zone     = zone
        self.positions: deque[tuple[float,float]] = deque(maxlen=300)
        self.bboxes:    deque[tuple]               = deque(maxlen=90)
        self.postures:  deque[str]                 = deque(maxlen=90)
        self.l_ankle_y: deque[float] = deque(maxlen=30)
        self.r_ankle_y: deque[float] = deque(maxlen=30)
        self.l_wrist_y: deque[float] = deque(maxlen=30)
        self.r_wrist_y: deque[float] = deque(maxlen=30)
        self.inactivity_start: Optional[float] = None
        self.prev_pos:         Optional[tuple]  = None
        self.last_seen:        float = time.time()
        self.bathroom_entry:   Optional[float] = None
        self.last_events:      dict[str,float] = {}

    def update(self, cx,cy, bbox, posture, lms):
        self.last_seen = time.time()
        self.positions.append((cx,cy))
        self.bboxes.append(bbox)
        self.postures.append(posture)
        if lms:
            if _vis(lms,_L_ANKLE,thr=0.3): self.l_ankle_y.append(lms[_L_ANKLE].y)
            if _vis(lms,_R_ANKLE,thr=0.3): self.r_ankle_y.append(lms[_R_ANKLE].y)
            if _vis(lms,_L_WRIST,thr=0.3): self.l_wrist_y.append(lms[_L_WRIST].y)
            if _vis(lms,_R_WRIST,thr=0.3): self.r_wrist_y.append(lms[_R_WRIST].y)
        if self.prev_pos:
            d = math.hypot(cx-self.prev_pos[0], cy-self.prev_pos[1])
            if d < 12:
                if self.inactivity_start is None: self.inactivity_start = time.time()
            else:
                self.inactivity_start = None
        self.prev_pos = (cx,cy)

    def can_fire(self, evt:str) -> bool:
        return time.time()-self.last_events.get(evt,0) > _COOLDOWN.get(evt,30)

    def mark(self, evt:str): self.last_events[evt] = time.time()

    @property
    def posture(self) -> str:
        if not self.postures: return "unknown"
        c = Counter(p for p in list(self.postures)[-10:] if p!="unknown")
        return c.most_common(1)[0][0] if c else "unknown"

    @property
    def inactive_s(self) -> float:
        return time.time()-self.inactivity_start if self.inactivity_start else 0.0

    # ── Detectors ─────────────────────────────────────────────────────────────

    def detect_fall(self) -> bool:
        if self.posture != "lying": return False
        recent  = list(self.postures)[-60:]
        upright = sum(1 for p in recent[:40] if p in ("standing","sitting"))
        if upright < 6: return False
        if not self.bboxes: return False
        x1,y1,x2,y2 = self.bboxes[-1]
        w,h = x2-x1, y2-y1
        return h>0 and (w/h)>1.05

    def detect_sleeping(self) -> bool:
        return self.posture=="lying" and self.inactive_s>60

    def detect_wandering(self) -> bool:
        pts = list(self.positions)
        if len(pts)<90: return False
        seg   = pts[-150:]
        total = sum(math.hypot(seg[i][0]-seg[i-1][0],seg[i][1]-seg[i-1][1]) for i in range(1,len(seg)))
        if total<80: return False
        disp  = math.hypot(seg[-1][0]-seg[0][0], seg[-1][1]-seg[0][1])
        return (disp/total if total>0 else 1.0) < 0.28

    def detect_gait(self) -> Optional[str]:
        pts = list(self.positions)
        if len(pts)<30: return None
        recent = pts[-30:]
        dists  = [math.hypot(recent[i][0]-recent[i-1][0],recent[i][1]-recent[i-1][1])
                  for i in range(1,len(recent))]
        speed  = float(np.mean(dists))
        if 0.4<speed<2.2 and self.posture=="standing": return "gait_abnormal"
        if speed>1.0 and float(np.std([p[0] for p in recent]))>14: return "balance_instability"
        return None

    def detect_limping(self) -> bool:
        if len(self.l_ankle_y)<20 or len(self.r_ankle_y)<20: return False
        la=float(np.std(list(self.l_ankle_y))); ra=float(np.std(list(self.r_ankle_y)))
        if la<0.003 and ra<0.003: return False
        return max(la,ra)/(min(la,ra)+1e-6) > 2.5

    def detect_tremor(self) -> bool:
        for h in (self.l_wrist_y, self.r_wrist_y):
            if len(h)>=20:
                vals=list(h)
                if float(np.mean([abs(vals[i]-vals[i-1]) for i in range(1,len(vals))]))>0.007:
                    return True
        return False

    def path_efficiency(self) -> float:
        pts=list(self.positions)[-150:]
        if len(pts)<2: return 1.0
        total=sum(math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]) for i in range(1,len(pts)))
        disp=math.hypot(pts[-1][0]-pts[0][0],pts[-1][1]-pts[0][1])
        return disp/total if total>0 else 1.0


# ══════════════════════════════════════════════════════════════════════════════
#  MJPEG Server  (port 8081)
# ══════════════════════════════════════════════════════════════════════════════

class MJPEGServer:
    def __init__(self, port:int=DEFAULT_MJPEG_PORT):
        self.port=port
        self._clients: list[Q.Queue]=[]
        self._lock=threading.Lock()

    def push(self, frame:np.ndarray):
        ok,buf=cv2.imencode(".jpg",frame,[cv2.IMWRITE_JPEG_QUALITY,78])
        if not ok: return
        data=buf.tobytes()
        with self._lock:
            dead=[]
            for q in self._clients:
                try:
                    while q.full():
                        try: q.get_nowait()
                        except Q.Empty: break
                    q.put_nowait(data)
                except: dead.append(q)
            for q in dead:
                try: self._clients.remove(q)
                except ValueError: pass

    def _handle(self, conn:socket.socket):
        try:
            raw=conn.recv(4096).decode("utf-8","ignore")
            if "/mjpeg" not in raw:
                conn.sendall(b"HTTP/1.1 404 Not Found\r\n\r\n"); return
            conn.sendall(
                b"HTTP/1.1 200 OK\r\n"
                b"Content-Type: multipart/x-mixed-replace; boundary=frame\r\n"
                b"Cache-Control: no-cache\r\nPragma: no-cache\r\nConnection: close\r\n"
                b"Access-Control-Allow-Origin: *\r\n"
                b"Access-Control-Allow-Methods: GET, OPTIONS\r\n\r\n"
            )
            q:Q.Queue=Q.Queue(maxsize=3)
            with self._lock: self._clients.append(q)
            try:
                while True:
                    try: frame=q.get(timeout=5)
                    except Q.Empty: break
                    conn.sendall(b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"+frame+b"\r\n")
            finally:
                with self._lock:
                    try: self._clients.remove(q)
                    except ValueError: pass
        except: pass
        finally: conn.close()

    def _serve(self):
        srv=socket.socket(socket.AF_INET,socket.SOCK_STREAM)
        srv.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
        srv.bind(("0.0.0.0",self.port)); srv.listen(20); srv.settimeout(1.0)
        log.info(f"MJPEG  →  http://127.0.0.1:{self.port}/mjpeg")
        while True:
            try:
                conn,_=srv.accept()
                threading.Thread(target=self._handle,args=(conn,),daemon=True).start()
            except socket.timeout: continue

    def start(self): threading.Thread(target=self._serve,daemon=True).start()


# ══════════════════════════════════════════════════════════════════════════════
#  Event category map + posting
# ══════════════════════════════════════════════════════════════════════════════

_EVT_CAT: dict[str,str] = {
    "fall_detected":"emergency","sleeping_detected":"activity",
    "gait_abnormal":"activity","balance_instability":"activity",
    "tremor_detected":"activity","limping_detected":"activity",
    "wandering_detected":"behaviour","prolonged_inactivity":"social",
    "bathroom_extended_stay":"bathroom",
    "posture_standing":"activity","posture_sitting":"activity",
    "posture_lying":"activity","posture_crouching":"activity",
    "posture_bending":"activity",
}
for _p in ("yoga_","exercise_"):
    for _n in ("warrior","tree","downward_dog","t_pose","wide_stance","mountain_arms_wide",
               "plank","squat","arms_raised","arms_overhead","arm_lateral_raise","seated_arm_raise"):
        _EVT_CAT[f"{_p}{_n}"]="activity"


def _post(backend:str, zone:str, evt:str, conf:float, tid:int, meta:dict):
    body={"id":str(uuid.uuid4()),"time":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),
          "event_type":evt,"zone":zone,"confidence":round(conf,3),
          "reid_id":f"T{tid:04d}","category":_EVT_CAT.get(evt,"activity"),
          "metadata":meta,"clip_url":None}
    try: requests.post(f"{backend}/events",json=body,timeout=0.6)
    except: pass


# ══════════════════════════════════════════════════════════════════════════════
#  Drawing
# ══════════════════════════════════════════════════════════════════════════════

def _draw(frame:np.ndarray, trk:PersonTrack, lms, labels:list[str]):
    if not trk.bboxes: return
    x1,y1,x2,y2=(int(v) for v in trk.bboxes[-1])
    posture=trk.posture; color=_POSTURE_COLOR.get(posture,(150,150,150))
    cv2.rectangle(frame,(x1,y1),(x2,y2),color,3 if posture=="lying" else 2)
    if lms:
        fh,fw=frame.shape[:2]
        for a,b in _SKELETON:
            if _vis(lms,a,b,thr=0.25):
                ax=int(lms[a].x*fw); ay=int(lms[a].y*fh)
                bx=int(lms[b].x*fw); by_=int(lms[b].y*fh)
                cv2.line(frame,(ax,ay),(bx,by_),(220,220,220),1,cv2.LINE_AA)
                cv2.circle(frame,(ax,ay),2,color,-1)
    header=f"T{trk.track_id:03d} {posture[:4].upper()}"
    for i,txt in enumerate([header]+labels):
        yp=y1-10-i*17
        if yp>5:
            cv2.putText(frame,txt,(x1+1,yp+1),cv2.FONT_HERSHEY_SIMPLEX,0.42,(0,0,0),2,cv2.LINE_AA)
            cv2.putText(frame,txt,(x1,yp),cv2.FONT_HERSHEY_SIMPLEX,0.42,color,1,cv2.LINE_AA)


# ══════════════════════════════════════════════════════════════════════════════
#  Pose → track matching helper
# ══════════════════════════════════════════════════════════════════════════════

def _match_pose_to_track(lms, tracked: dict, w: int, h: int) -> int:
    """
    Find which track ID the pose belongs to by checking if the hip
    centre (landmarks 23+24) falls inside a tracked bounding box.
    Returns track ID or -1.
    """
    if not (_vis(lms, _L_HIP, _R_HIP, thr=0.2)):
        return -1
    hip_x = ((lms[_L_HIP].x + lms[_R_HIP].x) / 2) * w
    hip_y = ((lms[_L_HIP].y + lms[_R_HIP].y) / 2) * h
    best_id, best_area = -1, float("inf")
    for tid, (x1, y1, x2, y2, _) in tracked.items():
        if x1 <= hip_x <= x2 and y1 <= hip_y <= y2:
            area = (x2 - x1) * (y2 - y1)
            if area < best_area:           # prefer smallest matching box
                best_id, best_area = tid, area
    return best_id


# ══════════════════════════════════════════════════════════════════════════════
#  Main
# ══════════════════════════════════════════════════════════════════════════════

def main():
    ap=argparse.ArgumentParser(description="SENTINEL CCTV Processor")
    ap.add_argument("--source",        default="0")
    ap.add_argument("--droidcam-ip",   default="")
    ap.add_argument("--droidcam-port", default="4747")
    ap.add_argument("--model",         default=DEFAULT_MODEL)
    ap.add_argument("--backend",       default=DEFAULT_BACKEND)
    ap.add_argument("--mjpeg-port",    type=int, default=DEFAULT_MJPEG_PORT)
    ap.add_argument("--zone",          default=DEFAULT_ZONE)
    ap.add_argument("--pose-model",    default=DEFAULT_POSE_MODEL,
                    help="MediaPipe pose_landmarker_lite.task path")
    ap.add_argument("--conf",          type=float, default=0.42)
    ap.add_argument("--width",         type=int,   default=640)
    ap.add_argument("--height",        type=int,   default=480)
    ap.add_argument("--no-display",    action="store_true")
    args=ap.parse_args()

    if args.droidcam_ip:
        source:int|str=f"http://{args.droidcam_ip}:{args.droidcam_port}/video"
    elif args.source.isdigit():
        source=int(args.source)
    else:
        source=args.source

    log.info(f"Source: {source}  Zone: {args.zone}  Backend: {args.backend}")

    # MJPEG
    mjpeg=MJPEGServer(args.mjpeg_port); mjpeg.start()

    # Person detector (YOLO ONNX if available, HOG otherwise)
    detector = PersonDetector(args.model, conf=args.conf)

    # Tracker
    tracker = CentroidTracker(max_lost=15)

    # MediaPipe Pose Landmarker — Tasks API, multi-person, full-frame
    import os as _os
    if not _os.path.exists(args.pose_model):
        log.error(f"Pose model not found: {args.pose_model}  ->  run: python setup_model.py")
        return
    _base_opts = _mp_tasks.BaseOptions(model_asset_path=args.pose_model)
    _pose_opts = _mp_vision.PoseLandmarkerOptions(
        base_options=_base_opts,
        running_mode=_mp_vision.RunningMode.VIDEO,
        num_poses=10,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    pose_model = _mp_vision.PoseLandmarker.create_from_options(_pose_opts)
    log.info("PoseLandmarker ready (multi-person)")

    # Notify backend
    try:
        requests.post(f"{args.backend}/camera/online",json={"source":str(source)},timeout=1.5)
        log.info("Backend: camera online")
    except: log.warning("Backend unreachable")

    # Capture — retry loop for DroidCam (phone app may not be open yet)
    cap = None
    while True:
        cap = cv2.VideoCapture(source)
        if cap.isOpened():
            break
        log.warning(f"Cannot open {source} — retrying in 5 s (open DroidCam on your phone)")
        cap.release()
        time.sleep(5)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,args.width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT,args.height)
    cap.set(cv2.CAP_PROP_BUFFERSIZE,2)

    person_tracks: dict[int,PersonTrack] = {}
    frame_n=0; fps_t0=time.time(); fps_cnt=0; fps_disp=0.0

    # ── Source-change polling (background thread) ──────────────────────────
    _src_state = {"current": str(source), "requested": None}

    def _poll_source():
        while True:
            time.sleep(4)
            try:
                r = requests.get(f"{args.backend}/camera/status", timeout=2)
                desired = r.json().get("source")
                if desired and desired != _src_state["current"]:
                    _src_state["requested"] = desired
                    log.info(f"Source change detected → {desired}")
            except:
                pass

    threading.Thread(target=_poll_source, daemon=True).start()

    log.info("Running — press Q to stop.")

    while True:
        # ── Check for source change ────────────────────────────────────────
        if _src_state["requested"]:
            new_src = _src_state["requested"]
            _src_state["requested"] = None
            _src_state["current"]   = new_src
            log.info(f"Switching capture → {new_src}")
            cap.release()
            cap = cv2.VideoCapture(new_src)
            if not cap.isOpened():
                log.warning(f"Cannot open {new_src} — retrying in 5 s")
                cap.release(); time.sleep(5)
                cap = cv2.VideoCapture(new_src)
            else:
                cap.set(cv2.CAP_PROP_FRAME_WIDTH,  args.width)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)
                try:
                    requests.post(f"{args.backend}/camera/online",
                                  json={"source": new_src}, timeout=1.5)
                except: pass
                log.info(f"Switched to {new_src}")

        ret,frame=cap.read()
        if not ret:
            time.sleep(0.1); continue
        frame_n+=1; fps_cnt+=1
        elapsed=time.time()-fps_t0
        if elapsed>=2.0:
            fps_disp=fps_cnt/elapsed; fps_cnt=0; fps_t0=time.time()

        h_f,w_f=frame.shape[:2]

        # ── MediaPipe pose (full frame) — primary person detector ────────────
        _ts_ms = int(time.time() * 1000)
        _rgb_full = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        _mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=_rgb_full)
        _pose_result = pose_model.detect_for_video(_mp_img, _ts_ms)

        # Build bbox detections from MediaPipe landmarks
        detections: list = []
        _raw_lms: list   = []
        for _plms in _pose_result.pose_landmarks:
            _xs = [lm.x * w_f for lm in _plms if (lm.visibility or 0) > 0.15]
            _ys = [lm.y * h_f for lm in _plms if (lm.visibility or 0) > 0.15]
            if len(_xs) < 5:
                continue
            _bx1 = int(max(0,      min(_xs) - 25))
            _by1 = int(max(0,      min(_ys) - 40))
            _bx2 = int(min(w_f,    max(_xs) + 25))
            _by2 = int(min(h_f,    max(_ys) + 20))
            detections.append((_bx1, _by1, _bx2, _by2, 0.92))
            _raw_lms.append(_plms)

        # HOG fallback only when MediaPipe sees nobody
        if not detections:
            detections = detector.detect(frame)
            _raw_lms   = [None] * len(detections)

        # ── Track ─────────────────────────────────────────────────────────────
        tracked = tracker.update(detections)

        # ── Match pose landmarks to track IDs ─────────────────────────────────
        _pose_by_tid: dict[int, list] = {}
        for _plms in _raw_lms:
            if _plms is None:
                continue
            _tid = _match_pose_to_track(_plms, tracked, w_f, h_f)
            if _tid >= 0:
                _pose_by_tid[_tid] = _plms

        for tid,(x1,y1,x2,y2,conf) in tracked.items():

            lms = _pose_by_tid.get(tid)
            posture=classify_posture(lms) if lms else "unknown"
            cx_p=(x1+x2)/2.0; cy_p=(y1+y2)/2.0

            if tid not in person_tracks:
                person_tracks[tid]=PersonTrack(tid,args.zone)
            trk=person_tracks[tid]
            trk.update(cx_p,cy_p,(x1,y1,x2,y2),posture,lms)

            labels:list[str]=[]

            # ── Posture event ─────────────────────────────────────────────────
            if posture != "unknown":
                _pevt = f"posture_{posture}"
                if trk.can_fire(_pevt):
                    _post(args.backend, args.zone, _pevt, 0.88, tid,
                          {"posture": posture})
                    trk.mark(_pevt)

            # ── Fall ─────────────────────────────────────────────────────────
            if trk.detect_fall() and trk.can_fire("fall_detected"):
                w_b,h_b=x2-x1,y2-y1
                _post(args.backend,args.zone,"fall_detected",0.91,tid,
                      {"aspect_ratio":round(w_b/h_b,2) if h_b else 0})
                trk.mark("fall_detected"); labels.append("⚠ FALL")

            # ── Sleeping ─────────────────────────────────────────────────────
            elif trk.detect_sleeping() and trk.can_fire("sleeping_detected"):
                _post(args.backend,args.zone,"sleeping_detected",0.80,tid,
                      {"inactive_seconds":round(trk.inactive_s)})
                trk.mark("sleeping_detected"); labels.append("SLEEPING")

            # ── Yoga ─────────────────────────────────────────────────────────
            if lms and posture in ("standing","sitting"):
                yoga=detect_yoga(lms)
                if yoga and trk.can_fire(yoga):
                    _post(args.backend,args.zone,yoga,0.78,tid,{})
                    trk.mark(yoga); labels.append(yoga.replace("yoga_","").replace("_"," ").upper())

            # ── Exercise ─────────────────────────────────────────────────────
            if lms:
                exer=detect_exercise(lms,posture)
                if exer and trk.can_fire(exer):
                    _post(args.backend,args.zone,exer,0.75,tid,{})
                    trk.mark(exer); labels.append(exer.replace("exercise_","").replace("_"," ").upper())

            # ── Gait (every 30 frames) ────────────────────────────────────────
            if frame_n%30==0 and posture=="standing":
                gait=trk.detect_gait()
                if gait and trk.can_fire(gait):
                    pts=list(trk.positions)[-30:]
                    spd=round(float(np.mean([math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1])
                                             for i in range(1,len(pts))])),2) if len(pts)>1 else 0
                    _post(args.backend,args.zone,gait,0.76,tid,{"mean_speed_px":spd})
                    trk.mark(gait); labels.append(gait.replace("_"," ").upper())

            # ── Limping (every 30 frames) ─────────────────────────────────────
            if frame_n%30==0 and trk.detect_limping() and trk.can_fire("limping_detected"):
                la=float(np.std(list(trk.l_ankle_y))); ra=float(np.std(list(trk.r_ankle_y)))
                _post(args.backend,args.zone,"limping_detected",0.72,tid,
                      {"asymmetry_ratio":round(max(la,ra)/(min(la,ra)+1e-6),2)})
                trk.mark("limping_detected"); labels.append("LIMPING")

            # ── Tremor (every 30 frames) ──────────────────────────────────────
            if frame_n%30==0 and trk.detect_tremor() and trk.can_fire("tremor_detected"):
                _post(args.backend,args.zone,"tremor_detected",0.70,tid,{})
                trk.mark("tremor_detected"); labels.append("TREMOR")

            # ── Wandering (every 60 frames) ───────────────────────────────────
            if frame_n%60==0 and trk.detect_wandering() and trk.can_fire("wandering_detected"):
                eff=trk.path_efficiency()
                _post(args.backend,args.zone,"wandering_detected",0.85,tid,
                      {"path_efficiency_ratio":round(1/eff,1) if eff>0 else 99})
                trk.mark("wandering_detected"); labels.append("WANDERING")

            # ── Prolonged inactivity ──────────────────────────────────────────
            if trk.inactive_s>60 and trk.can_fire("prolonged_inactivity"):
                _post(args.backend,args.zone,"prolonged_inactivity",0.80,tid,
                      {"inactive_seconds":round(trk.inactive_s),"inactive_minutes":round(trk.inactive_s/60,1)})
                trk.mark("prolonged_inactivity"); labels.append(f"INACTIVE {int(trk.inactive_s)}s")

            # ── Bathroom dwell ────────────────────────────────────────────────
            if args.zone=="bathroom_entry":
                if trk.bathroom_entry is None: trk.bathroom_entry=time.time()
                dwell=time.time()-trk.bathroom_entry
                if dwell>600 and trk.can_fire("bathroom_extended_stay"):
                    _post(args.backend,args.zone,"bathroom_extended_stay",0.92,tid,
                          {"duration_minutes":round(dwell/60,1)})
                    trk.mark("bathroom_extended_stay"); labels.append(f"DWELL {int(dwell/60)}m")

            _draw(frame,trk,lms,labels)

        # ── Remove stale person_tracks ────────────────────────────────────────
        for tid in [t for t,trk in list(person_tracks.items())
                    if time.time()-trk.last_seen>5.0 and t not in tracked]:
            del person_tracks[tid]

        # ── HUD ───────────────────────────────────────────────────────────────
        hud=f"SENTINEL  |  Zone: {args.zone}  |  Tracks: {len(tracked)}  |  {fps_disp:.1f} fps"
        cv2.putText(frame,hud,(8,22),cv2.FONT_HERSHEY_SIMPLEX,0.48,(0,0,0),2,cv2.LINE_AA)
        cv2.putText(frame,hud,(8,22),cv2.FONT_HERSHEY_SIMPLEX,0.48,(255,255,255),1,cv2.LINE_AA)
        cv2.putText(frame,time.strftime("%H:%M:%S"),(w_f-70,22),cv2.FONT_HERSHEY_SIMPLEX,0.48,(180,220,255),1)

        mjpeg.push(frame)

        if not args.no_display:
            cv2.imshow("SENTINEL CCTV",frame)
            if cv2.waitKey(1)&0xFF==ord("q"): break

    cap.release(); pose_model.close()
    if not args.no_display: cv2.destroyAllWindows()
    try: requests.post(f"{args.backend}/camera/offline",timeout=1.5)
    except: pass
    log.info("Stopped.")


if __name__=="__main__":
    main()

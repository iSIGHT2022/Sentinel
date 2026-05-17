#!/usr/bin/env python3
"""
Download model files for the SENTINEL processor.
Run once:  python setup_model.py
"""
import urllib.request, os, sys

def _progress(count, block, total):
    pct = min(count * block / (total or 1) * 100, 100)
    bar = "█" * int(pct // 2) + "░" * (50 - int(pct // 2))
    print(f"\r  [{bar}] {pct:5.1f}%", end="", flush=True)

def download(dest, urls):
    if os.path.exists(dest):
        size_mb = os.path.getsize(dest) / 1e6
        print(f"[OK] {dest} already exists ({size_mb:.1f} MB) — skipping.")
        return True
    print(f"\nDownloading {dest} …")
    for url in urls:
        try:
            print(f"  Source: {url}")
            urllib.request.urlretrieve(url, dest, reporthook=_progress)
            print()
            size_mb = os.path.getsize(dest) / 1e6
            print(f"[OK] Saved {dest}  ({size_mb:.1f} MB)")
            return True
        except Exception as e:
            print(f"\n  Failed: {e}")
            if os.path.exists(dest):
                os.remove(dest)
    return False

# ── pose_landmarker_lite.task (~5.8 MB) ───────────────────────────────────────
pose_ok = download("pose_landmarker_lite.task", [
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1-0-0/pose_landmarker_lite.task",
])

# ── yolov8n.onnx (~12 MB) ─────────────────────────────────────────────────────
yolo_ok = download("yolov8n.onnx", [
    "https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.onnx",
    "https://github.com/ultralytics/assets/releases/download/v8.1.0/yolov8n.onnx",
    "https://github.com/ultralytics/assets/releases/download/v8.0.0/yolov8n.onnx",
])

print()
if not pose_ok:
    print("[FAIL] pose_landmarker_lite.task download failed — pose detection unavailable.")
    print("  Download manually from:")
    print("  https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task")
if not yolo_ok:
    print("[WARN] yolov8n.onnx download failed — processor will use HOG fallback detector (lower accuracy).")

if pose_ok:
    print("All required models ready. Run: python cctv_processor.py --source 0")
    sys.exit(0)
else:
    sys.exit(1)

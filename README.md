# Sentinel Dashboard

This repository contains a Next.js dashboard and a local realtime backend server for CCTV-based elder care monitoring.

## What was added

- `backend/server.js` — a lightweight Node backend that:
  - serves `GET /dashboard/summary` for dashboard data
  - serves `GET /events` and `GET /alerts` for category details
  - accepts `POST /ingest` to receive real-time CCTV detection data
  - broadcasts live alert payloads to `ws://localhost:8000/ws/global`
  - can simulate sample events every 20 seconds (opt-in with `ENABLE_DUMMY=1`)

## Start the system

- Run the dashboard: `npm run dev`
- Run the backend: `npm run backend`
- Run both together: `npm run dev:all`

## CCTV integration

Send detection payloads to the backend from your camera/analytics pipeline.

### Live camera → tracking → backend (included)

This repo includes `cctv_processor.py` which:
- reads from a real camera/video/RTSP stream (`cv2.VideoCapture`)
- runs YOLOv8 person detection + simple tracking
- posts real events to `POST /ingest`

Run it (webcam):

```bash
python -u cctv_processor.py --source 0 --api-url http://localhost:8000/ingest
```

Run it (RTSP):

```bash
python -u cctv_processor.py --source "rtsp://USER:PASS@CAMERA_IP:554/stream1" --api-url http://localhost:8000/ingest --no-display
```

### Live video in the web app (included)

`cctv_processor.py` also hosts an MJPEG stream (default `http://127.0.0.1:8081/mjpeg`) so the dashboard can show live video with detections drawn.

Open: `http://localhost:3000/cctv`

Example request:

```bash
curl -X POST http://localhost:8000/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "event_type": "fall_detected",
      "category": "emergency",
      "zone": "corridors_hallways",
      "confidence": 0.92,
      "reid_id": "R0004",
      "resident_id": "r1",
      "message": "Resident fell in corridor"
    }
  }'
```

The backend will create an associated alert and broadcast it to the dashboard immediately.

## Notes

- The dashboard connects to the backend by default at `http://localhost:8000` and `ws://localhost:8000`.
- Frontend mock data is opt-in: set `NEXT_PUBLIC_USE_MOCK=1` to force mock data.
- The backend uses in-memory state; if you need persistence, replace the in-memory arrays with a database.
- Use the `/ingest` endpoint to plug in your CCTV detection stream or analytics service.

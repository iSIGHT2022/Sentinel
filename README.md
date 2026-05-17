# SENTINEL
AI-powered CCTV monitoring system for elderly care homes.

## What it does
- Detects falls, abnormal gait, wandering, bathroom duration, meal presence, posture, yoga and exercise in real time
- Live alerts pushed to dashboard
- Per-resident activity summary and event timeline
- Live camera feed via DroidCam (phone as CCTV)

## Tech Stack
- Frontend: Next.js, TypeScript, Tailwind CSS
- Backend: Node.js, WebSocket
- CV: Python, YOLOv8, MediaPipe

## How to run
1. `npm install` → `npm run dev` (dashboard)
2. `node backend/server.js` (backend)
3. `pip install -r requirements.txt` → `python cctv_processor.py` (CV processor)
4. Open DroidCam on phone → enter phone IP on the CCTV page

# Sentinel

Sentinel is an elderly care monitoring system. The idea: place a camera near an elderly
person (at home or in a care facility), and let software keep an eye on them so caregivers
don't have to watch a screen all day — it can flag things like a fall or unusual inactivity and
alert someone who can help.

**This repository holds the Android app** — the camera device side of Sentinel. It doesn't do
the "AI watching" part itself; its job is to capture video reliably and get it to a backend
where that analysis happens.

## How it fits together

```
 [ Android phone/camera ]  --live video over WebSocket-->  [ backend (not in this repo) ]
   this repository                                            AI monitoring, alerts, etc.
```

Point a phone's camera at the person being monitored, run this app, and it continuously streams
what the camera sees to a server for processing.

## What this app does

- Shows a live camera preview on screen, so you can confirm it's pointed the right way.
- Compresses each camera frame to JPEG so it's small enough to stream.
- Sends frames over a WebSocket connection to the backend, and automatically reconnects if the
  connection drops (Wi-Fi hiccups, server restarts, etc.) — important for something meant to run
  unattended.
- Keeps running safely across screen rotations and app navigation without leaking memory or
  leaving the camera locked.

## Tech stack

| Piece | Choice |
|---|---|
| Language | Kotlin |
| UI | Jetpack Compose + Material 3 |
| Camera | CameraX |
| Networking | Ktor WebSocket client (OkHttp engine) |
| Binary format | MessagePack |
| Async | Kotlin Coroutines & Flow |
| Dependency injection | Hilt |
| Architecture | MVVM + Clean Architecture (multi-module) |

## Project structure

```
app/                  # UI screens, ViewModels, app entry point
domain/               # Plain Kotlin models & interfaces (no Android/Ktor/CameraX code)
core/camera/          # CameraX capture + JPEG encoding + preview UI
core/network/         # WebSocket client, reconnect/heartbeat logic, MessagePack
core/designsystem/    # Shared Material 3 theme
```

Each module has one job, so the camera or networking code can be tested and changed without
touching the rest of the app.

## Getting started

1. Open the project folder in **Android Studio** (Ladybug or newer).
2. Let Gradle sync finish (it downloads everything it needs automatically).
3. Run the `app` module on a device or emulator with a camera.
4. Grant the camera permission when prompted.

## Requirements

- Android Studio + JDK 11+
- A device/emulator running Android 8.0 (API 26) or higher
- A camera (physical device recommended — emulator cameras are limited)

## Notes for developers

- The WebSocket server address isn't hardcoded into the UI yet — see
  `core/network/.../WebSocketClientConfig.kt` to adjust connection/heartbeat/retry settings.
- Camera frames are handed to the network layer in `CameraViewModel.onFrame` — that's the hook
  point if you're wiring streaming into a new screen.

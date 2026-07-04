# Sentinel — Android Client

The Android app for Sentinel. It uses the phone's camera to capture live video and streams it
over a WebSocket connection to a backend for monitoring/AI processing.

## What it does

- Shows a live camera preview on screen.
- Compresses each camera frame to JPEG.
- Sends frames over a WebSocket connection, with auto-reconnect if the connection drops.
- Keeps running safely across screen rotations and navigation without leaking memory or camera
  resources.

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

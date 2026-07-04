package com.example.clawdbot1.core.camera

import androidx.camera.core.Preview
import androidx.lifecycle.LifecycleOwner
import com.example.clawdbot1.domain.camera.CameraCaptureConfig
import com.example.clawdbot1.domain.camera.CameraFrame
import com.example.clawdbot1.domain.camera.CameraLens
import kotlinx.coroutines.flow.Flow

/**
 * Drives the device camera: renders a live preview through [surfaceProvider] and, at the same
 * time, emits every captured frame as a compressed JPEG via the returned [Flow].
 *
 * The returned [Flow] is cold and lifecycle-scoped: camera binding starts when it is collected
 * and is torn down (use cases unbound, analyzer cleared, background thread stopped) as soon as
 * collection stops, whether that's because the caller cancelled, the composable left
 * composition, or [lifecycleOwner] was destroyed. Callers never need to call an explicit
 * stop/release method.
 */
interface CameraController {
    fun frames(
        lifecycleOwner: LifecycleOwner,
        surfaceProvider: Preview.SurfaceProvider,
        lensFacing: CameraLens = CameraLens.Back,
        config: CameraCaptureConfig = CameraCaptureConfig(),
    ): Flow<CameraFrame>
}

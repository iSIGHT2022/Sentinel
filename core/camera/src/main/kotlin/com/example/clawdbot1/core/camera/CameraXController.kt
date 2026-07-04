package com.example.clawdbot1.core.camera

import android.content.Context
import android.util.Size
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.concurrent.futures.await
import androidx.lifecycle.LifecycleOwner
import com.example.clawdbot1.core.camera.internal.toJpeg
import com.example.clawdbot1.domain.camera.CameraCaptureConfig
import com.example.clawdbot1.domain.camera.CameraFrame
import com.example.clawdbot1.domain.camera.CameraLens
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.concurrent.Executors
import javax.inject.Inject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOn

class CameraXController @Inject constructor(
    @param:ApplicationContext private val context: Context,
) : CameraController {

    override fun frames(
        lifecycleOwner: LifecycleOwner,
        surfaceProvider: Preview.SurfaceProvider,
        lensFacing: CameraLens,
        config: CameraCaptureConfig,
    ): Flow<CameraFrame> = callbackFlow {
        val cameraProvider = ProcessCameraProvider.getInstance(context).await()

        // Dedicated to this collection only; shut down in awaitClose so no thread survives
        // past the camera being unbound.
        val analysisExecutor = Executors.newSingleThreadExecutor()

        val preview = Preview.Builder().build().also {
            it.setSurfaceProvider(surfaceProvider)
        }

        val resolutionSelector = ResolutionSelector.Builder()
            .setResolutionStrategy(
                ResolutionStrategy(
                    Size(config.targetWidth, config.targetHeight),
                    ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER,
                )
            )
            .build()

        val imageAnalysis = ImageAnalysis.Builder()
            .setResolutionSelector(resolutionSelector)
            // Always analyze the newest frame and drop stale ones instead of queuing, so a slow
            // JPEG encode or a slow downstream consumer never builds up unbounded memory.
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()

        imageAnalysis.setAnalyzer(analysisExecutor) { imageProxy ->
            try {
                trySend(
                    CameraFrame(
                        jpegBytes = imageProxy.toJpeg(config.jpegQuality),
                        width = imageProxy.width,
                        height = imageProxy.height,
                        rotationDegrees = imageProxy.imageInfo.rotationDegrees,
                        timestampMs = System.currentTimeMillis(),
                    )
                )
            } catch (e: Exception) {
                // Drop this single malformed/unreadable frame; the stream continues.
            } finally {
                imageProxy.close()
            }
        }

        val cameraSelector = CameraSelector.Builder()
            .requireLensFacing(lensFacing.toCameraXLensFacing())
            .build()

        try {
            // Defensive: clears out any binding left over from a collector that didn't get to
            // run its own cleanup (e.g. process died mid-session) before this one takes over.
            cameraProvider.unbindAll()
            cameraProvider.bindToLifecycle(
                lifecycleOwner,
                cameraSelector,
                preview,
                imageAnalysis,
            )
        } catch (e: Exception) {
            close(e)
        }

        awaitClose {
            imageAnalysis.clearAnalyzer()
            cameraProvider.unbindAll()
            analysisExecutor.shutdown()
        }
    }.flowOn(Dispatchers.Main.immediate) // CameraX binding must happen on the main thread.

    private fun CameraLens.toCameraXLensFacing(): Int = when (this) {
        CameraLens.Back -> CameraSelector.LENS_FACING_BACK
        CameraLens.Front -> CameraSelector.LENS_FACING_FRONT
    }
}

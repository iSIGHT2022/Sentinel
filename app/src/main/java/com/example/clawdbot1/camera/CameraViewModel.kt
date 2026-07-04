package com.example.clawdbot1.camera

import androidx.lifecycle.ViewModel
import com.example.clawdbot1.core.camera.CameraController
import com.example.clawdbot1.domain.camera.CameraFrame
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

@HiltViewModel
class CameraViewModel @Inject constructor(
    val cameraController: CameraController,
) : ViewModel() {

    private val _uiState = MutableStateFlow(CameraUiState())
    val uiState: StateFlow<CameraUiState> = _uiState.asStateFlow()

    private var framesInWindow = 0
    private var windowStartMs = 0L

    // Future step: also hand frame.jpegBytes off to the Ktor websocket sender here.
    fun onFrame(frame: CameraFrame) {
        framesInWindow++
        if (windowStartMs == 0L) windowStartMs = frame.timestampMs
        val elapsedMs = frame.timestampMs - windowStartMs
        if (elapsedMs >= 1000) {
            _uiState.update { it.copy(framesPerSecond = framesInWindow * 1000f / elapsedMs) }
            framesInWindow = 0
            windowStartMs = frame.timestampMs
        }
        _uiState.update {
            it.copy(
                lastFrameSizeBytes = frame.jpegBytes.size,
                totalFramesCaptured = it.totalFramesCaptured + 1,
            )
        }
    }
}

data class CameraUiState(
    val framesPerSecond: Float = 0f,
    val lastFrameSizeBytes: Int = 0,
    val totalFramesCaptured: Long = 0,
)

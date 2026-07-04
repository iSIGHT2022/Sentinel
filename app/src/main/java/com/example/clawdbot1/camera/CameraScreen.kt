package com.example.clawdbot1.camera

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.clawdbot1.core.camera.ui.CameraCaptureView

@Composable
fun CameraScreen(
    modifier: Modifier = Modifier,
    viewModel: CameraViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Box(modifier = modifier.fillMaxSize()) {
        CameraCaptureView(
            cameraController = viewModel.cameraController,
            onFrame = viewModel::onFrame,
            modifier = Modifier.fillMaxSize(),
        )
        CameraStatsOverlay(
            uiState = uiState,
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(16.dp),
        )
    }
}

@Composable
private fun CameraStatsOverlay(
    uiState: CameraUiState,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier,
        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.75f),
        shape = MaterialTheme.shapes.medium,
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text("%.1f fps".format(uiState.framesPerSecond))
            Text("${uiState.lastFrameSizeBytes / 1024} KB/frame")
            Text("${uiState.totalFramesCaptured} frames captured")
        }
    }
}

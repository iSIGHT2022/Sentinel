package com.example.clawdbot1.core.camera.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.example.clawdbot1.core.camera.CameraController
import com.example.clawdbot1.domain.camera.CameraCaptureConfig
import com.example.clawdbot1.domain.camera.CameraFrame
import com.example.clawdbot1.domain.camera.CameraLens

/**
 * Renders a live camera preview and, as a side effect, streams every captured frame to
 * [onFrame] as a compressed JPEG. Requests the camera permission itself if it hasn't been
 * granted yet, and shows a placeholder instead of the preview until it is.
 *
 * All camera binding is driven by [LaunchedEffect]/[androidx.compose.ui.platform.LocalLifecycleOwner],
 * so navigating away or backgrounding the host screen releases the camera automatically -
 * callers do not need to manage teardown themselves.
 */
@Composable
fun CameraCaptureView(
    cameraController: CameraController,
    onFrame: (CameraFrame) -> Unit,
    modifier: Modifier = Modifier,
    lensFacing: CameraLens = CameraLens.Back,
    config: CameraCaptureConfig = CameraCaptureConfig(),
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.CAMERA,
            ) == PackageManager.PERMISSION_GRANTED
        )
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { granted -> hasCameraPermission = granted }

    LaunchedEffect(Unit) {
        if (!hasCameraPermission) {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    if (!hasCameraPermission) {
        CameraPermissionRequired(
            modifier = modifier,
            onRequestPermission = { permissionLauncher.launch(Manifest.permission.CAMERA) },
        )
        return
    }

    val previewView = remember {
        PreviewView(context).apply {
            implementationMode = PreviewView.ImplementationMode.COMPATIBLE
            scaleType = PreviewView.ScaleType.FILL_CENTER
        }
    }
    val latestOnFrame = rememberUpdatedState(onFrame)

    AndroidView(modifier = modifier, factory = { previewView })

    LaunchedEffect(cameraController, previewView, lensFacing, config) {
        cameraController.frames(
            lifecycleOwner = lifecycleOwner,
            surfaceProvider = previewView.surfaceProvider,
            lensFacing = lensFacing,
            config = config,
        ).collect { frame -> latestOnFrame.value(frame) }
    }
}

@Composable
private fun CameraPermissionRequired(
    onRequestPermission: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = "Camera permission is required to start streaming.",
            style = MaterialTheme.typography.bodyLarge,
        )
        Button(onClick = onRequestPermission, modifier = Modifier.padding(top = 16.dp)) {
            Text("Grant permission")
        }
    }
}

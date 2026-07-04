package com.example.clawdbot1.domain.camera

/**
 * Tunables for the outgoing frame stream. Kept small on purpose: this travels over a websocket,
 * so resolution and quality directly trade off against bandwidth and latency.
 */
data class CameraCaptureConfig(
    val targetWidth: Int = 1280,
    val targetHeight: Int = 720,
    val jpegQuality: Int = 80,
) {
    init {
        require(jpegQuality in 1..100) { "jpegQuality must be in 1..100, was $jpegQuality" }
        require(targetWidth > 0 && targetHeight > 0) { "target resolution must be positive" }
    }
}

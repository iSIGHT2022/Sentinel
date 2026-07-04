package com.example.clawdbot1.core.camera.internal

import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import androidx.camera.core.ImageProxy
import java.io.ByteArrayOutputStream

/**
 * Converts a CameraX YUV_420_888 [ImageProxy] straight to JPEG bytes without ever going through
 * a [android.graphics.Bitmap]. This avoids an extra decode/encode pass per frame, which matters
 * when this runs on every frame of a continuous capture stream.
 *
 * Must only be called while [image] is open; callers are responsible for closing it.
 */
internal fun ImageProxy.toJpeg(quality: Int): ByteArray {
    require(format == ImageFormat.YUV_420_888) { "Unsupported image format: $format" }

    val nv21 = yuv420ToNv21(this)
    val yuvImage = YuvImage(nv21, ImageFormat.NV21, width, height, null)
    val output = ByteArrayOutputStream(nv21.size / 4)
    yuvImage.compressToJpeg(Rect(0, 0, width, height), quality, output)
    return output.toByteArray()
}

/**
 * Packs the Y, U and V planes of a YUV_420_888 image into a single NV21 (Y followed by
 * interleaved VU) byte array, honoring each plane's row/pixel stride rather than assuming a
 * tightly packed layout (strides vary across devices/vendors).
 */
private fun yuv420ToNv21(image: ImageProxy): ByteArray {
    val width = image.width
    val height = image.height
    val nv21 = ByteArray(width * height * 3 / 2)
    var pos = 0

    val yPlane = image.planes[0]
    val yBuffer = yPlane.buffer
    val yRowStride = yPlane.rowStride
    val yPixelStride = yPlane.pixelStride

    for (row in 0 until height) {
        val rowStart = row * yRowStride
        if (yPixelStride == 1) {
            yBuffer.position(rowStart)
            yBuffer.get(nv21, pos, width)
            pos += width
        } else {
            for (col in 0 until width) {
                nv21[pos++] = yBuffer.get(rowStart + col * yPixelStride)
            }
        }
    }

    val uPlane = image.planes[1]
    val vPlane = image.planes[2]
    val uBuffer = uPlane.buffer
    val vBuffer = vPlane.buffer
    val uRowStride = uPlane.rowStride
    val uPixelStride = uPlane.pixelStride
    val vRowStride = vPlane.rowStride
    val vPixelStride = vPlane.pixelStride

    val chromaWidth = width / 2
    val chromaHeight = height / 2

    for (row in 0 until chromaHeight) {
        val uRowStart = row * uRowStride
        val vRowStart = row * vRowStride
        for (col in 0 until chromaWidth) {
            // NV21 expects V before U for each interleaved pair.
            nv21[pos++] = vBuffer.get(vRowStart + col * vPixelStride)
            nv21[pos++] = uBuffer.get(uRowStart + col * uPixelStride)
        }
    }

    return nv21
}

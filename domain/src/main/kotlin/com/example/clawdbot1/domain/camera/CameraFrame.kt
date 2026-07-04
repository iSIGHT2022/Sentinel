package com.example.clawdbot1.domain.camera

/**
 * A single captured camera frame, already encoded as JPEG.
 *
 * [rotationDegrees] is the sensor rotation relative to the device's natural orientation at
 * capture time. The JPEG bytes themselves are NOT rotated (encoding a rotation would require an
 * extra bitmap decode/rotate/encode pass on every frame); consumers that need an upright image
 * must apply the rotation using this metadata.
 */
data class CameraFrame(
    val jpegBytes: ByteArray,
    val width: Int,
    val height: Int,
    val rotationDegrees: Int,
    val timestampMs: Long,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is CameraFrame) return false
        return width == other.width &&
            height == other.height &&
            rotationDegrees == other.rotationDegrees &&
            timestampMs == other.timestampMs &&
            jpegBytes.contentEquals(other.jpegBytes)
    }

    override fun hashCode(): Int {
        var result = jpegBytes.contentHashCode()
        result = 31 * result + width
        result = 31 * result + height
        result = 31 * result + rotationDegrees
        result = 31 * result + timestampMs.hashCode()
        return result
    }
}

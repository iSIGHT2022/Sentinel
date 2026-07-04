package com.example.clawdbot1.core.network.internal

/** Thrown when no frame has been observed on a session for longer than the configured idle timeout. */
internal class WebSocketTimeoutException(message: String) : Exception(message)

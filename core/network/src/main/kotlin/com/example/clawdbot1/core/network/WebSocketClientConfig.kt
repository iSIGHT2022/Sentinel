package com.example.clawdbot1.core.network

import com.example.clawdbot1.core.network.internal.ExponentialBackoffRetryStrategy
import com.example.clawdbot1.core.network.internal.RetryStrategy
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

data class WebSocketClientConfig(
    /** Timeout for the initial HTTP upgrade handshake. */
    val connectTimeout: Duration = 10.seconds,
    /** How often a transport-level ping is sent while connected (engine-managed for OkHttp). */
    val heartbeatInterval: Duration = 15.seconds,
    /**
     * If no frame of any kind (data, pong, or otherwise) is observed for this long, the
     * connection is considered dead and torn down so a reconnect can happen. Kept independent of
     * the OkHttp engine's own dead-connection detection so behavior is deterministic and testable.
     * Should be a small multiple of [heartbeatInterval] to tolerate a couple of missed beats.
     */
    val idleTimeout: Duration = 45.seconds,
    val retryStrategy: RetryStrategy = ExponentialBackoffRetryStrategy(),
) {
    init {
        require(idleTimeout > heartbeatInterval) { "idleTimeout must be greater than heartbeatInterval" }
    }
}

package com.example.clawdbot1.domain.network

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow

/**
 * A long-lived, self-healing binary WebSocket connection. Implementations own their own
 * background coroutine scope: [connect] returns immediately and the connection (including
 * reconnect attempts) keeps running independently of whatever scope called it, until
 * [disconnect] is called. Callers observe [connectionState] rather than awaiting a result.
 *
 * All members are safe to call from any thread/coroutine concurrently.
 */
interface WebSocketClient {
    val connectionState: StateFlow<ConnectionState>

    /** Every binary frame received while connected, in arrival order. */
    val incomingMessages: Flow<ByteArray>

    /** Starts connecting to [url]. A no-op if already connected/connecting to the same URL. */
    fun connect(url: String)

    /** Stops the connection and any pending reconnect attempts. Safe to call repeatedly. */
    fun disconnect()

    /** Sends [bytes] as a single binary frame. Returns false if not currently connected. */
    suspend fun send(bytes: ByteArray): Boolean
}

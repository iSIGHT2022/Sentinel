package com.example.clawdbot1.domain.network

/**
 * Lifecycle of a [WebSocketClient] connection. Consumers (UI, telemetry, etc.) observe this
 * instead of poking at socket internals.
 */
sealed interface ConnectionState {
    data object Idle : ConnectionState
    data object Connecting : ConnectionState
    data object Connected : ConnectionState

    /** Session dropped and a retry is scheduled in [nextRetryInMs]; [cause] is for logs/UI. */
    data class Reconnecting(val attempt: Int, val nextRetryInMs: Long, val cause: String? = null) : ConnectionState

    /** Terminal until [WebSocketClient.connect] is called again; [reason] is for logs/UI, not matching. */
    data class Disconnected(val reason: String) : ConnectionState
}

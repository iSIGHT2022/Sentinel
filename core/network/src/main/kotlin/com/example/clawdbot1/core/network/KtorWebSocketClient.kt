package com.example.clawdbot1.core.network

import com.example.clawdbot1.core.network.di.ApplicationScope
import com.example.clawdbot1.core.network.internal.WebSocketTimeoutException
import com.example.clawdbot1.domain.network.ConnectionState
import com.example.clawdbot1.domain.network.WebSocketClient
import io.ktor.client.HttpClient
import io.ktor.client.plugins.websocket.DefaultClientWebSocketSession
import io.ktor.client.plugins.websocket.webSocket
import io.ktor.websocket.CloseReason
import io.ktor.websocket.Frame
import io.ktor.websocket.close
import io.ktor.websocket.readBytes
import java.util.concurrent.atomic.AtomicLong
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Ktor/OkHttp-backed [WebSocketClient]. Owns a single background connection loop per instance
 * (this class is a Hilt `@Singleton`, so there is exactly one for the whole app) that reconnects
 * with backoff on any failure and tears itself down if the peer goes silent for too long.
 *
 * Thread-safety: [connectionState] is a [StateFlow] (safe to read/collect from anywhere).
 * [connect]/[disconnect] serialize their effect on internal state through [stateMutex]; the
 * active session reference is `@Volatile` so [send] always sees the latest one without locking.
 */
@Singleton
class KtorWebSocketClient @Inject constructor(
    private val httpClient: HttpClient,
    private val config: WebSocketClientConfig,
    @param:ApplicationScope private val applicationScope: CoroutineScope,
) : WebSocketClient {

    private val _connectionState = MutableStateFlow<ConnectionState>(ConnectionState.Idle)
    override val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private val _incomingMessages = MutableSharedFlow<ByteArray>(extraBufferCapacity = 64)
    override val incomingMessages = _incomingMessages.asSharedFlow()

    private val stateMutex = Mutex()
    private var connectionJob: Job? = null
    private var targetUrl: String? = null

    @Volatile
    private var activeSession: DefaultClientWebSocketSession? = null

    override fun connect(url: String) {
        applicationScope.launch {
            stateMutex.withLock {
                if (targetUrl == url && connectionJob?.isActive == true) return@withLock
                connectionJob?.cancel()
                targetUrl = url
                connectionJob = applicationScope.launch { runConnectionLoop(url) }
            }
        }
    }

    override fun disconnect() {
        applicationScope.launch {
            stateMutex.withLock {
                targetUrl = null
                activeSession?.let { session ->
                    withTimeoutOrNull(2000) {
                        runCatching { session.close(CloseReason(CloseReason.Codes.NORMAL, "client disconnect")) }
                    }
                }
                connectionJob?.cancel()
                connectionJob = null
                activeSession = null
                _connectionState.value = ConnectionState.Disconnected(reason = "client requested disconnect")
            }
        }
    }

    override suspend fun send(bytes: ByteArray): Boolean {
        val session = activeSession ?: return false
        return try {
            session.send(Frame.Binary(fin = true, data = bytes))
            true
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            false
        }
    }

    private suspend fun runConnectionLoop(url: String) {
        var attempt = 0
        while (currentCoroutineContext().isActive) {
            _connectionState.value = ConnectionState.Connecting
            var failureReason: String? = null
            try {
                httpClient.webSocket(urlString = url) {
                    activeSession = this
                    attempt = 0
                    _connectionState.value = ConnectionState.Connected
                    readIncomingUntilClosedOrTimedOut()
                }
            } catch (e: CancellationException) {
                activeSession = null
                throw e
            } catch (e: Exception) {
                failureReason = e.message ?: e::class.simpleName ?: "connection failed"
            }
            activeSession = null

            if (!currentCoroutineContext().isActive) break

            attempt++
            val retryDelay = config.retryStrategy.delayFor(attempt)
            _connectionState.value = ConnectionState.Reconnecting(attempt, retryDelay.inWholeMilliseconds, failureReason)
            delay(retryDelay)
        }
    }

    private suspend fun DefaultClientWebSocketSession.readIncomingUntilClosedOrTimedOut() = coroutineScope {
        val lastActivityAtMs = AtomicLong(System.currentTimeMillis())
        val watchdog = launch { runIdleWatchdog(lastActivityAtMs) }
        try {
            for (frame in incoming) {
                lastActivityAtMs.set(System.currentTimeMillis())
                if (frame is Frame.Binary) {
                    _incomingMessages.emit(frame.readBytes())
                }
            }
        } finally {
            watchdog.cancel()
        }
    }

    private suspend fun runIdleWatchdog(lastActivityAtMs: AtomicLong) {
        while (true) {
            delay(config.heartbeatInterval)
            val silentForMs = System.currentTimeMillis() - lastActivityAtMs.get()
            if (silentForMs >= config.idleTimeout.inWholeMilliseconds) {
                throw WebSocketTimeoutException(
                    "No frames received for ${silentForMs}ms (idleTimeout=${config.idleTimeout})"
                )
            }
        }
    }
}

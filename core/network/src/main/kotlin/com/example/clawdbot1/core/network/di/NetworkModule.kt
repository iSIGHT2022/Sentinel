package com.example.clawdbot1.core.network.di

import com.example.clawdbot1.core.network.WebSocketClientConfig
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.websocket.WebSockets
import java.util.concurrent.TimeUnit
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideWebSocketClientConfig(): WebSocketClientConfig = WebSocketClientConfig()

    @Provides
    @Singleton
    fun provideHttpClient(config: WebSocketClientConfig): HttpClient = HttpClient(OkHttp) {
        expectSuccess = false
        engine {
            config {
                // The WebSockets plugin's pingInterval is a no-op on the OkHttp engine; OkHttp's
                // own ping/pong keepalive is configured directly on its client builder instead.
                pingInterval(config.heartbeatInterval.inWholeSeconds, TimeUnit.SECONDS)
                connectTimeout(config.connectTimeout.inWholeMilliseconds, TimeUnit.MILLISECONDS)
                retryOnConnectionFailure(true)
            }
        }
        install(WebSockets)
        install(HttpTimeout) {
            requestTimeoutMillis = config.connectTimeout.inWholeMilliseconds
            connectTimeoutMillis = config.connectTimeout.inWholeMilliseconds
        }
    }

    @ApplicationScope
    @Provides
    @Singleton
    fun provideApplicationScope(): CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
}

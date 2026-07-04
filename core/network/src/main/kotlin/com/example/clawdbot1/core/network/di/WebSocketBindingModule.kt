package com.example.clawdbot1.core.network.di

import com.example.clawdbot1.core.network.KtorWebSocketClient
import com.example.clawdbot1.domain.network.WebSocketClient
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class WebSocketBindingModule {

    @Binds
    @Singleton
    abstract fun bindWebSocketClient(impl: KtorWebSocketClient): WebSocketClient
}

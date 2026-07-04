package com.example.clawdbot1.core.network

import com.ensarsarajcic.kotlinx.serialization.msgpack.MsgPack
import com.example.clawdbot1.domain.network.WebSocketClient
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.mapNotNull
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.SerializationStrategy

/** Encodes [value] as MessagePack and sends it as a single binary frame. */
suspend fun <T> WebSocketClient.sendMessagePack(serializer: SerializationStrategy<T>, value: T): Boolean =
    send(MsgPack.encodeToByteArray(serializer, value))

/**
 * Decodes every incoming binary frame as MessagePack using [deserializer]. Frames that fail to
 * decode (e.g. a stray non-MessagePack payload on a shared channel) are dropped rather than
 * crashing the whole stream.
 */
fun <T> WebSocketClient.messagePackMessages(deserializer: DeserializationStrategy<T>): Flow<T> =
    incomingMessages.mapNotNull { bytes ->
        runCatching { MsgPack.decodeFromByteArray(deserializer, bytes) }.getOrNull()
    }

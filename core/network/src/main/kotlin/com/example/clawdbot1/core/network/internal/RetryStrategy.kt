package com.example.clawdbot1.core.network.internal

import kotlin.math.pow
import kotlin.random.Random
import kotlin.time.Duration
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds

/** How long to wait before reconnect attempt number [attempt] (1-based). */
fun interface RetryStrategy {
    fun delayFor(attempt: Int): Duration
}

/**
 * Exponential backoff capped at [maxDelay], with +/-[jitterFraction] randomization so many
 * clients reconnecting to the same server after an outage don't all retry in lockstep.
 */
class ExponentialBackoffRetryStrategy(
    private val initialDelay: Duration = 1.seconds,
    private val maxDelay: Duration = 30.seconds,
    private val factor: Double = 2.0,
    private val jitterFraction: Double = 0.2,
    private val random: Random = Random.Default,
) : RetryStrategy {

    init {
        require(initialDelay.isPositive()) { "initialDelay must be positive" }
        require(maxDelay >= initialDelay) { "maxDelay must be >= initialDelay" }
        require(factor >= 1.0) { "factor must be >= 1.0" }
        require(jitterFraction in 0.0..1.0) { "jitterFraction must be in 0.0..1.0" }
    }

    override fun delayFor(attempt: Int): Duration {
        require(attempt >= 1) { "attempt must be >= 1, was $attempt" }

        val exponential = initialDelay.inWholeMilliseconds.toDouble() * factor.pow(attempt - 1)
        val capped = exponential.coerceAtMost(maxDelay.inWholeMilliseconds.toDouble())
        val jitterRange = capped * jitterFraction

        val jittered = if (jitterRange <= 0.0) capped else capped + random.nextDouble(-jitterRange, jitterRange)
        return jittered.toLong().coerceAtLeast(0L).milliseconds
    }
}

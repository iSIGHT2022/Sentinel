package com.example.clawdbot1.core.network.internal

import kotlin.random.Random
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class ExponentialBackoffRetryStrategyTest {

    private val noJitter = ExponentialBackoffRetryStrategy(
        initialDelay = 1.seconds,
        maxDelay = 30.seconds,
        factor = 2.0,
        jitterFraction = 0.0,
    )

    @Test
    fun `delay doubles each attempt without jitter`() {
        assertEquals(1000.milliseconds, noJitter.delayFor(1))
        assertEquals(2000.milliseconds, noJitter.delayFor(2))
        assertEquals(4000.milliseconds, noJitter.delayFor(3))
        assertEquals(8000.milliseconds, noJitter.delayFor(4))
    }

    @Test
    fun `delay is capped at maxDelay`() {
        assertEquals(30000.milliseconds, noJitter.delayFor(10))
        assertEquals(30000.milliseconds, noJitter.delayFor(100))
    }

    @Test
    fun `jitter stays within the configured fraction of the base delay`() {
        val strategy = ExponentialBackoffRetryStrategy(
            initialDelay = 1.seconds,
            maxDelay = 30.seconds,
            factor = 2.0,
            jitterFraction = 0.2,
            random = Random(seed = 42),
        )

        val delay = strategy.delayFor(1)
        assertTrue(delay in 800.milliseconds..1200.milliseconds)
    }

    @Test
    fun `rejects non-positive attempt`() {
        assertThrows(IllegalArgumentException::class.java) { noJitter.delayFor(0) }
    }

    @Test
    fun `rejects invalid configuration`() {
        assertThrows(IllegalArgumentException::class.java) {
            ExponentialBackoffRetryStrategy(initialDelay = 10.seconds, maxDelay = 1.seconds)
        }
    }
}

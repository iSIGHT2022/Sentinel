package com.example.clawdbot1.core.network.di

import javax.inject.Qualifier

/** The process-lifetime [kotlinx.coroutines.CoroutineScope], independent of any UI lifecycle. */
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class ApplicationScope

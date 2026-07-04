package com.example.clawdbot1.core.camera.di

import com.example.clawdbot1.core.camera.CameraController
import com.example.clawdbot1.core.camera.CameraXController
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.android.components.ViewModelComponent
import dagger.hilt.android.scopes.ViewModelScoped

@Module
@InstallIn(ViewModelComponent::class)
abstract class CameraModule {

    @Binds
    @ViewModelScoped
    abstract fun bindCameraController(impl: CameraXController): CameraController
}

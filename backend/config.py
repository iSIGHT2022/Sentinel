from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://sentinel:sentinel@localhost/sentinel"

    # Redis / Celery
    redis_url: str = "redis://localhost:6379/0"

    # MinIO
    minio_endpoint: str = "localhost:9000"
    minio_root_user: str = "minioadmin"
    minio_root_password: str = "minioadmin123"
    minio_bucket_clips: str = "sentinel-clips"
    minio_secure: bool = False

    # Auth
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_key: str = ""
    jwt_secret: str = "change_me_secret_32_chars_minimum"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24

    # Notifications
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""
    firebase_credentials_json: str = "./infra/firebase-service-account.json"

    # Gemini
    gemini_api_key: str = ""

    # Edge
    edge_api_key: str = "change_me"

    # App
    environment: str = "development"
    log_level: str = "INFO"

    class Config:
        env_file = ".env"


settings = Settings()

"""MinIO client for encrypted evidence clip storage.
Falls back to local no-op stubs when minio package is not installed (local dev).
"""
import io
import logging

logger = logging.getLogger(__name__)

try:
    from minio import Minio
    from minio.error import S3Error
    from config import settings

    def get_client() -> Minio:
        return Minio(
            settings.minio_endpoint,
            access_key=settings.minio_root_user,
            secret_key=settings.minio_root_password,
            secure=settings.minio_secure,
        )

    def ensure_bucket(client: Minio, bucket: str) -> None:
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)
            logger.info("Created MinIO bucket: %s", bucket)

    def upload_clip(data: bytes, object_name: str, content_type: str = "image/jpeg") -> str:
        client = get_client()
        ensure_bucket(client, settings.minio_bucket_clips)
        client.put_object(
            settings.minio_bucket_clips,
            object_name,
            io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )
        return f"minio://{settings.minio_bucket_clips}/{object_name}"

    def get_presigned_url(object_name: str, expires_seconds: int = 3600) -> str:
        from datetime import timedelta
        client = get_client()
        return client.presigned_get_object(
            settings.minio_bucket_clips,
            object_name,
            expires=timedelta(seconds=expires_seconds),
        )

except ImportError:
    # Local dev stub — MinIO not installed
    def upload_clip(data: bytes, object_name: str, content_type: str = "image/jpeg") -> str:
        logger.warning("MinIO not available; clip upload skipped: %s", object_name)
        return f"local://{object_name}"

    def get_presigned_url(object_name: str, expires_seconds: int = 3600) -> str:
        return ""

"""Firebase Cloud Messaging — push notifications to family mobile app."""
import logging
import firebase_admin
from firebase_admin import credentials, messaging
from config import settings

logger = logging.getLogger(__name__)
_initialized = False


def _init():
    global _initialized
    if not _initialized:
        try:
            cred = credentials.Certificate(settings.firebase_credentials_json)
            firebase_admin.initialize_app(cred)
            _initialized = True
        except Exception as e:
            logger.warning("FCM init failed (non-fatal): %s", e)


def send_push(token: str, title: str, body: str, data: dict | None = None) -> bool:
    _init()
    if not _initialized:
        return False
    try:
        msg = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (data or {}).items()},
            token=token,
        )
        messaging.send(msg)
        return True
    except Exception as e:
        logger.error("FCM send failed: %s", e)
        return False


def send_multicast(tokens: list[str], title: str, body: str, data: dict | None = None) -> int:
    _init()
    if not _initialized or not tokens:
        return 0
    try:
        msg = messaging.MulticastMessage(
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (data or {}).items()},
            tokens=tokens,
        )
        resp = messaging.send_each_for_multicast(msg)
        return resp.success_count
    except Exception as e:
        logger.error("FCM multicast failed: %s", e)
        return 0

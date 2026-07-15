"""Twilio SMS — emergency SMS to family/staff for critical alerts."""
import logging
from twilio.rest import Client
from config import settings

logger = logging.getLogger(__name__)


def _client() -> Client:
    return Client(settings.twilio_account_sid, settings.twilio_auth_token)


def send_sms(to: str, message: str) -> bool:
    if not settings.twilio_account_sid or not settings.twilio_auth_token:
        logger.warning("Twilio not configured — SMS skipped")
        return False
    try:
        _client().messages.create(body=message, from_=settings.twilio_from_number, to=to)
        return True
    except Exception as e:
        logger.error("Twilio SMS failed to %s: %s", to, e)
        return False


def send_emergency_sms(resident_name: str, event: str, zone: str, contacts: list[dict]) -> int:
    body = (
        f"SENTINEL ALERT — {resident_name}\n"
        f"Event: {event}\nLocation: {zone.replace('_', ' ').title()}\n"
        "Please contact the facility immediately."
    )
    sent = 0
    for contact in contacts:
        phone = contact.get("phone")
        if phone and send_sms(phone, body):
            sent += 1
    return sent

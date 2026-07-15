"""Gemini API — generate natural-language daily digest per resident."""
import logging
import google.generativeai as genai
from config import settings

logger = logging.getLogger(__name__)

DIGEST_PROMPT = """
You are a compassionate elderly care AI assistant. Based on the event data below for a resident
in an assisted-living facility, generate a concise, human-friendly daily summary for family members.

Focus on:
- General wellbeing and activity level
- Any concerns noted (falls, wandering, meal skips, long bathroom stays)
- Positive observations (social interactions, activity attendance)
- Behavioural trends compared to baseline

Tone: warm, reassuring but honest. Max 150 words.

Resident: {name}, Age {age}
Date: {date}
Events summary:
{events_json}
"""


def _model():
    genai.configure(api_key=settings.gemini_api_key)
    return genai.GenerativeModel("gemini-1.5-flash")


def generate_resident_digest(name: str, age: int, date: str, events_json: str) -> str:
    if not settings.gemini_api_key:
        return f"Daily summary for {name} on {date}: {len(events_json)} events recorded. AI summary unavailable (API key not configured)."
    try:
        prompt = DIGEST_PROMPT.format(name=name, age=age, date=date, events_json=events_json)
        resp = _model().generate_content(prompt)
        return resp.text.strip()
    except Exception as e:
        logger.error("Gemini digest failed for %s: %s", name, e)
        return f"Summary generation failed for {name}. Please review the event log manually."


FACILITY_DIGEST_PROMPT = """
You are a senior care facility manager's AI assistant.
Summarise the following daily statistics for all residents in a professional, concise briefing
suitable for the morning handover. Highlight any residents requiring immediate attention.
Max 200 words.

Date: {date}
Facility stats:
{stats_json}
"""


def generate_facility_digest(date: str, stats_json: str) -> str:
    if not settings.gemini_api_key:
        return f"Facility digest for {date}: AI summary unavailable."
    try:
        prompt = FACILITY_DIGEST_PROMPT.format(date=date, stats_json=stats_json)
        resp = _model().generate_content(prompt)
        return resp.text.strip()
    except Exception as e:
        logger.error("Gemini facility digest failed: %s", e)
        return "Facility digest generation failed."

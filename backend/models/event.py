import uuid
from datetime import datetime
from sqlalchemy import String, Float, Text, DateTime, func, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from models.database import Base

# Event categories matching the 7 dashboard tiles
EVENT_CATEGORIES = {
    # Emergency
    "fall_detected": "emergency",
    "slow_collapse": "emergency",
    "person_on_floor": "emergency",
    "choking_gesture": "emergency",
    "crowd_emergency": "emergency",
    "zone_boundary_breach": "emergency",
    # Activity & Posture
    "gait_abnormal": "activity",
    "tremor_detected": "activity",
    "limping_detected": "activity",
    "balance_instability": "activity",
    "repetitive_pacing": "activity",
    "poor_posture": "activity",
    "breathlessness_proxy": "activity",
    # Bathroom
    "bathroom_entry": "bathroom",
    "bathroom_exit": "bathroom",
    "bathroom_duration_alert": "bathroom",
    "bathroom_frequency_high": "bathroom",
    "bathroom_night_visit": "bathroom",
    # Dining
    "meal_present": "dining",
    "meal_skipped": "dining",
    "meal_early_exit": "dining",
    "eating_gesture": "dining",
    "social_seating": "dining",
    # Behaviour / Cognition
    "wandering_detected": "behaviour",
    "confusion_mapping": "behaviour",
    "disorientation": "behaviour",
    "path_deviation": "behaviour",
    "prolonged_dwell": "behaviour",
    # Social / Wellbeing
    "social_interaction": "social",
    "social_isolation": "social",
    "crowd_stress": "social",
    "withdrawn_posture": "social",
    "prolonged_inactivity": "social",
    # Room presence
    "room_entry_inferred": "room",
    "room_exit_inferred": "room",
    "in_room_inferred": "room",
}


class Event(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    time: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    resident_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("residents.id", ondelete="SET NULL"), nullable=True)
    zone: Mapped[str] = mapped_column(String(100), nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="unknown")
    confidence: Mapped[float | None] = mapped_column(Float)
    metadata_: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    clip_url: Mapped[str | None] = mapped_column(Text)
    reid_id: Mapped[str | None] = mapped_column(String(50))

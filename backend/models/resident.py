import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Text, Float, DateTime, func, JSON
from sqlalchemy.orm import Mapped, mapped_column
from models.database import Base


class Resident(Base):
    __tablename__ = "residents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    age: Mapped[int | None] = mapped_column(Integer)
    room_number: Mapped[str | None] = mapped_column(String(20))
    photo_embedding: Mapped[list | None] = mapped_column(JSON, nullable=True)
    reid_track_ids: Mapped[list] = mapped_column(JSON, default=list)
    emergency_contacts: Mapped[list] = mapped_column(JSON, default=list)
    medical_notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

"""Shared Pydantic models — this file IS the API contract for the dashboard."""

from typing import Literal, Optional

from pydantic import BaseModel, Field


Severity = Literal["low", "medium", "high", "critical"]


class TriageReport(BaseModel):
    summary: str = Field(..., description="One-paragraph Gemini triage summary.")
    severity: Severity
    survivors_detected: int = Field(0, ge=0)
    hazards: list[str] = Field(default_factory=list)
    spoken_instructions: str = Field(
        ..., description="Short, empathetic script sent to ElevenLabs."
    )


class IncidentSummary(BaseModel):
    """Full record returned to the dashboard."""
    incident_id: str
    node_id: str
    trigger: Literal["drop", "manual", "test"]
    received_at: str  # ISO-8601 UTC
    image_url: str
    triage: TriageReport
    audio_url: Optional[str]
    solana_tx: Optional[str]
    location: Optional[str] = None  # human-readable, e.g. "Long Island, NY"
    lat: Optional[float] = None
    lng: Optional[float] = None
    transcript: Optional[str] = None       # what the mic heard
    transcript_language: Optional[str] = None  # ISO code, e.g. "en", "es"


class IncidentResponse(BaseModel):
    """Trimmed payload returned to the Pi."""
    incident_id: str
    triage: str
    audio_url: Optional[str]
    solana_tx: Optional[str]

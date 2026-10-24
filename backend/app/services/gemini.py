"""Gemini Vision wrapper. STUB — returns a canned triage until the API key is wired."""

import base64
import logging
import os

import httpx

from ..models import TriageReport

log = logging.getLogger("witness-backend.gemini")

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-pro")
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
)

PROMPT = """You are triaging a disaster-zone photo from a stationary rescue beacon.
Return a JSON object with keys:
  summary (string, 1 paragraph, factual),
  severity (one of: low, medium, high, critical),
  survivors_detected (integer),
  hazards (list of short strings),
  spoken_instructions (string, 2-3 sentences, calm and empathetic, under 300 chars,
    directed at survivors who can hear a speaker nearby).
Do not invent people or hazards you cannot see.
"""


async def analyze_image(image_bytes: bytes) -> TriageReport:
    if not GEMINI_API_KEY:
        log.warning("GEMINI_API_KEY not set — returning stub triage.")
        return _stub_triage()

    payload = {
        "contents": [{
            "parts": [
                {"text": PROMPT},
                {"inline_data": {
                    "mime_type": "image/jpeg",
                    "data": base64.b64encode(image_bytes).decode(),
                }},
            ],
        }],
        "generationConfig": {"responseMimeType": "application/json"},
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                GEMINI_URL,
                params={"key": GEMINI_API_KEY},
                json=payload,
            )
            r.raise_for_status()
            data = r.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        import json
        return TriageReport.model_validate_json(text)
    except Exception as e:
        log.exception("Gemini call failed, falling back to stub: %s", e)
        return _stub_triage()


def _stub_triage() -> TriageReport:
    return TriageReport(
        summary=(
            "Partial structural collapse visible. Debris field in foreground; "
            "dust cloud settling. One possible survivor obscured behind beam."
        ),
        severity="high",
        survivors_detected=1,
        hazards=["unstable ceiling", "broken glass", "exposed rebar"],
        spoken_instructions=(
            "Help is on the way. Stay still if you are injured. "
            "If you can hear this, tap three times on anything metal."
        ),
    )

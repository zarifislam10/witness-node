"""ElevenLabs TTS wrapper. STUB — writes a silent placeholder MP3 when no key is set."""

import logging
import os
from pathlib import Path

import httpx

log = logging.getLogger("witness-backend.elevenlabs")

ELEVEN_API_KEY = os.environ.get("ELEVENLABS_API_KEY")
ELEVEN_VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
ELEVEN_MODEL = os.environ.get("ELEVENLABS_MODEL", "eleven_turbo_v2_5")
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "http://localhost:8000")

AUDIO_DIR = Path("media/audio")


async def synthesize(text: str, incident_id: str) -> str:
    """Return a public URL to an MP3 of `text`."""
    out_path = AUDIO_DIR / f"{incident_id}.mp3"

    if not ELEVEN_API_KEY:
        log.warning("ELEVENLABS_API_KEY not set — writing placeholder.")
        out_path.write_bytes(b"")  # dashboard will show the URL; Pi will skip playback
        return f"{PUBLIC_BASE_URL}/media/audio/{incident_id}.mp3"

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVEN_VOICE_ID}"
    headers = {"xi-api-key": ELEVEN_API_KEY, "Content-Type": "application/json"}
    payload = {
        "text": text,
        "model_id": ELEVEN_MODEL,
        "voice_settings": {"stability": 0.6, "similarity_boost": 0.7},
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(url, headers=headers, json=payload)
            r.raise_for_status()
            out_path.write_bytes(r.content)
    except Exception as e:
        log.exception("ElevenLabs call failed: %s", e)
        return ""

    return f"{PUBLIC_BASE_URL}/media/audio/{incident_id}.mp3"

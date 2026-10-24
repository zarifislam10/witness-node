"""
Witness-Node Edge Agent (Raspberry Pi)

Event-driven loop:
  1. Sleep until the roller limit switch (drop detection) OR tactile button fires.
  2. Snap a single photo with fswebcam.
  3. POST the photo to the Vultr backend.
  4. Receive { "audio_url": "...", "triage": "..." }.
  5. Play the MP3 through the JBL speaker with mpg123.

Design notes:
  - No continuous streaming (keeps Wi-Fi stable, keeps the Pi cool).
  - Backend owns Gemini + ElevenLabs + Solana; the Pi is just eyes/ears/mouth.
  - Debounce + simple exponential backoff on network drops.
"""

import logging
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

import requests
import RPi.GPIO as GPIO

# -------- Config (override via env for the hackathon) --------
BACKEND_URL = os.environ.get("WITNESS_BACKEND_URL", "https://api.witness-node.example/incident")
NODE_ID = os.environ.get("WITNESS_NODE_ID", "node-001")
CAPTURE_PATH = Path(os.environ.get("WITNESS_CAPTURE_PATH", "/tmp/witness_capture.jpg"))
AUDIO_PATH = Path(os.environ.get("WITNESS_AUDIO_PATH", "/tmp/witness_audio.mp3"))

# BCM pin numbering
LIMIT_SWITCH_PIN = int(os.environ.get("WITNESS_LIMIT_PIN", "17"))
BUTTON_PIN = int(os.environ.get("WITNESS_BUTTON_PIN", "27"))

DEBOUNCE_MS = 400
HTTP_TIMEOUT_S = 30
MAX_RETRIES = 5

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("witness-edge")


def capture_photo(path: Path) -> bool:
    """Snap a single 1080p frame from the USB webcam using fswebcam."""
    try:
        subprocess.run(
            [
                "fswebcam",
                "-r", "1920x1080",
                "--no-banner",
                "-S", "3",   # skip 3 frames so exposure settles
                str(path),
            ],
            check=True,
            timeout=15,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return path.exists() and path.stat().st_size > 0
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError) as e:
        log.error("fswebcam capture failed: %s", e)
        return False


def post_incident(image_path: Path, trigger: str) -> dict | None:
    """POST the photo + trigger metadata to the backend with retries."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with image_path.open("rb") as f:
                files = {"image": (image_path.name, f, "image/jpeg")}
                data = {"node_id": NODE_ID, "trigger": trigger, "ts": str(int(time.time()))}
                r = requests.post(BACKEND_URL, files=files, data=data, timeout=HTTP_TIMEOUT_S)
            r.raise_for_status()
            return r.json()
        except (requests.ConnectionError, requests.Timeout) as e:
            backoff = min(2 ** attempt, 30)
            log.warning("Network error (attempt %d/%d): %s — retrying in %ds",
                        attempt, MAX_RETRIES, e, backoff)
            time.sleep(backoff)
        except requests.HTTPError as e:
            log.error("Backend rejected request: %s", e)
            return None
        except Exception as e:
            log.exception("Unexpected error posting incident: %s", e)
            return None
    log.error("Giving up after %d retries — incident will be dropped.", MAX_RETRIES)
    return None


def play_audio(url: str) -> None:
    """Download the TTS MP3 and play it through the JBL speaker."""
    try:
        r = requests.get(url, timeout=HTTP_TIMEOUT_S, stream=True)
        r.raise_for_status()
        with AUDIO_PATH.open("wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
    except requests.RequestException as e:
        log.error("Failed to download audio: %s", e)
        return

    try:
        subprocess.run(
            ["mpg123", "-q", str(AUDIO_PATH)],
            check=True,
            timeout=120,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError) as e:
        log.error("mpg123 playback failed: %s", e)


def handle_trigger(trigger: str) -> None:
    log.info("Trigger fired: %s", trigger)
    if not capture_photo(CAPTURE_PATH):
        log.error("Capture failed, aborting incident.")
        return
    log.info("Captured %s (%d bytes)", CAPTURE_PATH, CAPTURE_PATH.stat().st_size)

    response = post_incident(CAPTURE_PATH, trigger)
    if not response:
        return

    log.info("Triage: %s", response.get("triage"))
    log.info("Solana tx: %s", response.get("solana_tx"))

    audio_url = response.get("audio_url")
    if audio_url:
        play_audio(audio_url)


def setup_gpio() -> None:
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(LIMIT_SWITCH_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)
    GPIO.setup(BUTTON_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)

    GPIO.add_event_detect(
        LIMIT_SWITCH_PIN, GPIO.FALLING,
        callback=lambda _: handle_trigger("drop"),
        bouncetime=DEBOUNCE_MS,
    )
    GPIO.add_event_detect(
        BUTTON_PIN, GPIO.FALLING,
        callback=lambda _: handle_trigger("manual"),
        bouncetime=DEBOUNCE_MS,
    )


def shutdown(*_):
    log.info("Shutting down, cleaning GPIO.")
    GPIO.cleanup()
    sys.exit(0)


def main():
    log.info("Witness-Node edge agent starting (node_id=%s)", NODE_ID)
    setup_gpio()
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)
    try:
        signal.pause()
    finally:
        GPIO.cleanup()


if __name__ == "__main__":
    main()

"""
Witness-Node Edge Agent (Raspberry Pi)

Event-driven loop:
  1. Sleep until the roller limit switch (drop detection) OR tactile button fires.
  2. Snap a single photo with fswebcam.
  3. Record 10s of audio from the mic (arecord).
  4. POST photo + audio + location to the Vultr backend.
  5. Receive { "audio_url": "...", "triage": "..." }.
  6. Play the MP3 through the JBL speaker with mpg123.
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
BACKEND_URL = os.environ.get("WITNESS_BACKEND_URL", "https://104-238-130-123.sslip.io/incident")
NODE_ID = os.environ.get("WITNESS_NODE_ID", "node-001")
LOCATION = os.environ.get("WITNESS_LOCATION", "")  # e.g. "Long Island, NY"
LAT = os.environ.get("WITNESS_LAT", "")
LNG = os.environ.get("WITNESS_LNG", "")
CAPTURE_PATH = Path(os.environ.get("WITNESS_CAPTURE_PATH", "/tmp/witness_capture.jpg"))
AUDIO_IN_PATH = Path(os.environ.get("WITNESS_AUDIO_IN_PATH", "/tmp/witness_mic.wav"))
AUDIO_OUT_PATH = Path(os.environ.get("WITNESS_AUDIO_OUT_PATH", "/tmp/witness_audio.mp3"))
MIC_SECONDS = int(os.environ.get("WITNESS_MIC_SECONDS", "10"))

# BCM pin numbering
LIMIT_SWITCH_PIN = int(os.environ.get("WITNESS_LIMIT_PIN", "17"))
BUTTON_PIN = int(os.environ.get("WITNESS_BUTTON_PIN", "27"))

DEBOUNCE_MS = 400
HTTP_TIMEOUT_S = 60
MAX_RETRIES = 5

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("witness-edge")


def capture_photo(path: Path) -> bool:
    try:
        subprocess.run(
            ["fswebcam", "-r", "1920x1080", "--no-banner", "-S", "3", str(path)],
            check=True, timeout=15,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        return path.exists() and path.stat().st_size > 0
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError) as e:
        log.error("fswebcam capture failed: %s", e)
        return False


def capture_audio(path: Path, seconds: int) -> bool:
    """Record `seconds` of audio from the default ALSA mic. Returns True on success."""
    try:
        subprocess.run(
            ["arecord", "-q", "-f", "cd", "-c", "1", "-d", str(seconds), str(path)],
            check=True, timeout=seconds + 10,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        return path.exists() and path.stat().st_size > 0
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError) as e:
        log.warning("arecord failed, skipping audio: %s", e)
        return False


def post_incident(image_path: Path, audio_path: Path | None, trigger: str) -> dict | None:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            files = {"image": (image_path.name, image_path.open("rb"), "image/jpeg")}
            if audio_path and audio_path.exists() and audio_path.stat().st_size > 0:
                files["audio"] = (audio_path.name, audio_path.open("rb"), "audio/wav")
            data = {
                "node_id": NODE_ID,
                "trigger": trigger,
                "ts": str(int(time.time())),
            }
            if LOCATION: data["location"] = LOCATION
            if LAT: data["lat"] = LAT
            if LNG: data["lng"] = LNG

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
            log.exception("Unexpected error: %s", e)
            return None
    log.error("Giving up after %d retries.", MAX_RETRIES)
    return None


def play_audio(url: str) -> None:
    try:
        r = requests.get(url, timeout=HTTP_TIMEOUT_S, stream=True)
        r.raise_for_status()
        with AUDIO_OUT_PATH.open("wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
    except requests.RequestException as e:
        log.error("Failed to download audio: %s", e)
        return
    try:
        subprocess.run(["mpg123", "-q", str(AUDIO_OUT_PATH)], check=True, timeout=120)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError) as e:
        log.error("mpg123 playback failed: %s", e)


def handle_trigger(trigger: str) -> None:
    log.info("Trigger: %s", trigger)
    if not capture_photo(CAPTURE_PATH):
        log.error("Capture failed, aborting.")
        return
    log.info("Captured %s (%d bytes)", CAPTURE_PATH, CAPTURE_PATH.stat().st_size)

    log.info("Recording %ds of audio…", MIC_SECONDS)
    have_audio = capture_audio(AUDIO_IN_PATH, MIC_SECONDS)

    response = post_incident(CAPTURE_PATH, AUDIO_IN_PATH if have_audio else None, trigger)
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
    GPIO.add_event_detect(LIMIT_SWITCH_PIN, GPIO.FALLING,
                          callback=lambda _: handle_trigger("drop"), bouncetime=DEBOUNCE_MS)
    GPIO.add_event_detect(BUTTON_PIN, GPIO.FALLING,
                          callback=lambda _: handle_trigger("manual"), bouncetime=DEBOUNCE_MS)


def shutdown(*_):
    log.info("Shutting down.")
    GPIO.cleanup()
    sys.exit(0)


def main():
    log.info("Witness-Node edge agent starting (node_id=%s, location=%s)",
             NODE_ID, LOCATION or "unset")
    setup_gpio()
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)
    try:
        signal.pause()
    finally:
        GPIO.cleanup()


if __name__ == "__main__":
    main()

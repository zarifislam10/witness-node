"""
Witness-Node Backend (FastAPI, deployed on Vultr).

Flow for POST /incident:
  1. Receive JPEG + metadata from the Pi.
  2. Call Gemini Vision -> triage text (hazards, survivor count, instructions).
  3. Call ElevenLabs -> MP3 of empathetic instructions, hosted at a public URL.
  4. Log the triage text to Solana testnet -> tx hash.
  5. Return { audio_url, triage, solana_tx, incident_id } to the Pi.
  6. Also fan out to GET /incidents for the dashboard.
"""

import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()  # must run before service modules read os.environ

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from contextlib import asynccontextmanager

from . import db
from .models import IncidentResponse, IncidentSummary
from .services import elevenlabs, gemini, solana
from .store import incident_store

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("witness-backend")

MEDIA_ROOT = Path("media")
MEDIA_ROOT.mkdir(exist_ok=True)
(MEDIA_ROOT / "images").mkdir(exist_ok=True)
(MEDIA_ROOT / "audio").mkdir(exist_ok=True)

@asynccontextmanager
async def lifespan(_app: FastAPI):
    await db.connect()
    yield
    await db.disconnect()


app = FastAPI(title="Witness-Node API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to the dashboard origin before demo
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/media", StaticFiles(directory=MEDIA_ROOT), name="media")


@app.get("/health")
def health():
    return {"status": "ok", "ts": datetime.now(timezone.utc).isoformat()}


@app.post("/incident", response_model=IncidentResponse)
async def ingest_incident(
    image: UploadFile = File(...),
    node_id: str = Form(...),
    trigger: str = Form(...),
    ts: str = Form(...),
):
    if image.content_type not in {"image/jpeg", "image/jpg", "image/png"}:
        raise HTTPException(400, f"Unsupported content type: {image.content_type}")

    incident_id = str(uuid.uuid4())
    image_bytes = await image.read()
    image_path = MEDIA_ROOT / "images" / f"{incident_id}.jpg"
    image_path.write_bytes(image_bytes)
    image_url = f"/media/images/{incident_id}.jpg"

    log.info("Incident %s from %s (trigger=%s, %d bytes)",
             incident_id, node_id, trigger, len(image_bytes))

    triage = await gemini.analyze_image(image_bytes)
    audio_url = await elevenlabs.synthesize(triage.spoken_instructions, incident_id)
    solana_tx = await solana.log_triage(incident_id, triage.summary)

    summary = IncidentSummary(
        incident_id=incident_id,
        node_id=node_id,
        trigger=trigger,
        received_at=datetime.now(timezone.utc).isoformat(),
        image_url=image_url,
        triage=triage,
        audio_url=audio_url,
        solana_tx=solana_tx,
    )
    await incident_store.add(summary)

    return IncidentResponse(
        incident_id=incident_id,
        triage=triage.summary,
        audio_url=audio_url,
        solana_tx=solana_tx,
    )


@app.get("/incidents", response_model=list[IncidentSummary])
async def list_incidents():
    return await incident_store.all()


@app.get("/incidents/{incident_id}", response_model=IncidentSummary)
async def get_incident(incident_id: str):
    found = await incident_store.get(incident_id)
    if not found:
        raise HTTPException(404, "Incident not found")
    return found

# Witness-Node — Backend (FastAPI on Vultr)

Stateless cloud brain. Receives photos from edge nodes, calls Gemini + ElevenLabs + Solana, serves the dashboard.

## Local dev

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in keys as they arrive
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints

| Method | Path                      | Purpose                                 |
| ------ | ------------------------- | --------------------------------------- |
| GET    | `/health`                 | Liveness                                |
| POST   | `/incident`               | Edge upload (multipart: image, node_id, trigger, ts) |
| GET    | `/incidents`              | List all incidents (newest first) — dashboard feed |
| GET    | `/incidents/{id}`         | One incident                            |
| GET    | `/media/images/{id}.jpg`  | Static photo                            |
| GET    | `/media/audio/{id}.mp3`   | Static TTS clip                         |

The JSON shape returned to the dashboard is defined in `app/models.py::IncidentSummary` — that file is the API contract Dev 3 should mirror.

## Deploy to Vultr

Any Ubuntu 22.04 instance:

```bash
sudo apt install -y python3-pip python3-venv nginx
# clone repo, pip install, then:
uvicorn app.main:app --host 127.0.0.1 --port 8000
# front with nginx + TLS (certbot). Point WITNESS_BACKEND_URL on the Pi at this host.
```

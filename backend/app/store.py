"""Incident store — Tiger Data (TimescaleDB) with in-memory fallback."""

import json
from threading import Lock

from .db import DB
from .models import IncidentSummary, TriageReport


class _MemoryStore:
    def __init__(self):
        self._by_id: dict[str, IncidentSummary] = {}
        self._order: list[str] = []
        self._lock = Lock()

    def add(self, incident: IncidentSummary) -> None:
        with self._lock:
            self._by_id[incident.incident_id] = incident
            self._order.append(incident.incident_id)

    def get(self, incident_id: str) -> IncidentSummary | None:
        return self._by_id.get(incident_id)

    def all(self) -> list[IncidentSummary]:
        with self._lock:
            return [self._by_id[i] for i in reversed(self._order)]


_memory = _MemoryStore()


class IncidentStore:
    """Async facade: prefers Tiger pool, falls back to in-memory if pool is None."""

    async def add(self, incident: IncidentSummary) -> None:
        if DB.pool is None:
            _memory.add(incident)
            return

        async with DB.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO incidents
                    (incident_id, node_id, trigger, received_at, image_url, triage, audio_url, solana_tx)
                VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
                ON CONFLICT (incident_id) DO NOTHING
                """,
                incident.incident_id,
                incident.node_id,
                incident.trigger,
                incident.received_at,
                incident.image_url,
                incident.triage.model_dump_json(),
                incident.audio_url,
                incident.solana_tx,
            )

    async def get(self, incident_id: str) -> IncidentSummary | None:
        if DB.pool is None:
            return _memory.get(incident_id)

        async with DB.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM incidents WHERE incident_id = $1", incident_id
            )
        return _row_to_summary(row) if row else None

    async def all(self) -> list[IncidentSummary]:
        if DB.pool is None:
            return _memory.all()

        async with DB.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM incidents ORDER BY received_at DESC LIMIT 200"
            )
        return [_row_to_summary(r) for r in rows]


def _row_to_summary(row) -> IncidentSummary:
    triage_raw = row["triage"]
    triage = TriageReport.model_validate(
        json.loads(triage_raw) if isinstance(triage_raw, str) else triage_raw
    )
    return IncidentSummary(
        incident_id=row["incident_id"],
        node_id=row["node_id"],
        trigger=row["trigger"],
        received_at=row["received_at"].isoformat(),
        image_url=row["image_url"],
        triage=triage,
        audio_url=row["audio_url"],
        solana_tx=row["solana_tx"],
    )


incident_store = IncidentStore()

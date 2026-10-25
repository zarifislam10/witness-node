"""Tiger Data (TimescaleDB) connection pool + schema bootstrap."""

import logging
import os

import asyncpg

log = logging.getLogger("witness-backend.db")

TIGER_DATABASE_URL = os.environ.get("TIGER_DATABASE_URL")

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS incidents (
    incident_id   TEXT        PRIMARY KEY,
    node_id       TEXT        NOT NULL,
    trigger       TEXT        NOT NULL,
    received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    image_url     TEXT        NOT NULL,
    triage        JSONB       NOT NULL,
    audio_url     TEXT,
    solana_tx     TEXT
);

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS transcript TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS transcript_language TEXT;

CREATE INDEX IF NOT EXISTS incidents_received_at_idx
    ON incidents (received_at DESC);

CREATE INDEX IF NOT EXISTS incidents_node_id_idx
    ON incidents (node_id);
"""

HYPERTABLE_SQL = """
SELECT create_hypertable('incidents', 'received_at',
    if_not_exists => TRUE,
    migrate_data  => TRUE);
"""


class DB:
    pool: asyncpg.Pool | None = None


async def connect() -> bool:
    """Open the pool and apply schema. Returns False if TIGER_DATABASE_URL is unset."""
    if not TIGER_DATABASE_URL:
        log.warning("TIGER_DATABASE_URL not set — falling back to in-memory store.")
        return False

    DB.pool = await asyncpg.create_pool(TIGER_DATABASE_URL, min_size=1, max_size=5)
    async with DB.pool.acquire() as conn:
        await conn.execute(SCHEMA_SQL)
        try:
            await conn.execute(HYPERTABLE_SQL)
            log.info("Tiger hypertable ready on incidents.received_at")
        except asyncpg.PostgresError as e:
            log.warning("Hypertable step skipped (plain Postgres or already converted): %s", e)
    log.info("Connected to Tiger Data.")
    return True


async def disconnect() -> None:
    if DB.pool:
        await DB.pool.close()
        DB.pool = None

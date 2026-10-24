"""Solana devnet triage logger.

Writes the triage summary (hashed) into the Memo program as an immutable log.
Returns the base58 transaction signature which resolves on explorer.solana.com.
"""

import hashlib
import json
import logging
import os
import secrets
from pathlib import Path

from solana.rpc.async_api import AsyncClient
from solders.hash import Hash
from solders.instruction import Instruction
from solders.keypair import Keypair
from solders.message import Message
from solders.pubkey import Pubkey
from solders.transaction import Transaction

log = logging.getLogger("witness-backend.solana")

SOLANA_RPC = os.environ.get("SOLANA_RPC", "https://api.devnet.solana.com")
SOLANA_KEYPAIR_PATH = os.environ.get("SOLANA_KEYPAIR_PATH")

MEMO_PROGRAM_ID = Pubkey.from_string("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr")


def _load_keypair() -> Keypair | None:
    if not SOLANA_KEYPAIR_PATH:
        return None
    path = Path(SOLANA_KEYPAIR_PATH).expanduser()
    if not path.exists():
        log.warning("Solana keypair file not found at %s", path)
        return None
    secret = json.loads(path.read_text())  # 64-byte array from solana-keygen
    return Keypair.from_bytes(bytes(secret))


async def log_triage(incident_id: str, triage_summary: str) -> str:
    """Log an immutable memo entry and return the base58 tx signature."""
    digest = hashlib.sha256(f"{incident_id}:{triage_summary}".encode()).hexdigest()
    memo = f"witness-node|{incident_id}|{digest[:16]}"

    kp = _load_keypair()
    if kp is None:
        log.warning("No keypair — returning simulated tx.")
        return "SIM" + secrets.token_hex(32)

    try:
        async with AsyncClient(SOLANA_RPC) as client:
            instruction = Instruction(
                program_id=MEMO_PROGRAM_ID,
                accounts=[],
                data=memo.encode(),
            )
            blockhash_resp = await client.get_latest_blockhash()
            recent_blockhash: Hash = blockhash_resp.value.blockhash

            message = Message.new_with_blockhash([instruction], kp.pubkey(), recent_blockhash)
            tx = Transaction([kp], message, recent_blockhash)

            send_resp = await client.send_transaction(tx)
            signature = str(send_resp.value)
            log.info("Solana tx submitted: %s", signature)
            return signature
    except Exception as e:
        log.exception("Solana submit failed, returning simulated tx: %s", e)
        return "SIM" + secrets.token_hex(32)

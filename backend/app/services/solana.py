"""Solana testnet triage logger. STUB — returns a fake tx hash when no key is set.

Writes the triage summary (hashed) into the memo field of a tiny self-transfer so
the record is immutable on-chain. Use solana-py for the real call.
"""

import hashlib
import logging
import os
import secrets

log = logging.getLogger("witness-backend.solana")

SOLANA_RPC = os.environ.get("SOLANA_RPC", "https://api.devnet.solana.com")
SOLANA_KEYPAIR_PATH = os.environ.get("SOLANA_KEYPAIR_PATH")


async def log_triage(incident_id: str, triage_summary: str) -> str:
    """Return the Solana transaction signature (base58) for the memo log."""
    digest = hashlib.sha256(f"{incident_id}:{triage_summary}".encode()).hexdigest()
    memo = f"witness-node|{incident_id}|{digest[:16]}"

    if not SOLANA_KEYPAIR_PATH:
        log.warning("SOLANA_KEYPAIR_PATH not set — returning simulated tx.")
        return "SIM" + secrets.token_hex(32)

    # TODO: real implementation
    #   from solders.keypair import Keypair
    #   from solana.rpc.async_api import AsyncClient
    #   from solders.pubkey import Pubkey
    #   from solders.transaction import Transaction
    #   from solders.system_program import TransferParams, transfer
    #   MEMO_PROGRAM_ID = Pubkey.from_string("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr")
    #   build a tx with a Memo instruction carrying `memo`, sign with keypair, send to SOLANA_RPC
    log.info("Would log memo to Solana: %s", memo)
    return "TODO" + secrets.token_hex(32)

"""Process-scoped state for the sha256-chain MCP server.

Holds the registry of in-memory Blockchain instances keyed by UUID. Resets
when the server process restarts — no on-disk persistence by design.
"""

from __future__ import annotations

from src.chain import Blockchain

CHAINS: dict[str, Blockchain] = {}

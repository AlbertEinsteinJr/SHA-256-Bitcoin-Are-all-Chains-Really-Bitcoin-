"""MCP server exposing this repo's SHA-256 / blockchain primitives.

Transport: stdio. SDK: the official mcp Python SDK (FastMCP decorator API,
shipped as `mcp.server.fastmcp`).

Run with:
    python -m src.mcp_servers.sha256_chain_server
or the console script:
    sha256-chain-mcp
"""

from __future__ import annotations

import uuid
from typing import Any

from mcp.server.fastmcp import FastMCP

from src.block import BlockHeader, Transaction, mine_block
from src.chain import Blockchain, compare_chains
from src.sha256 import double_sha256, sha256

from . import _state


mcp = FastMCP("sha256-chain")


@mcp.tool()
def hash_sha256(data_hex: str) -> str:
    """SHA-256 of the bytes decoded from hex. Returns lowercase hex digest."""
    return sha256(bytes.fromhex(data_hex))


@mcp.tool()
def hash_double_sha256(data_hex: str) -> str:
    """Bitcoin-style double SHA-256 of the bytes decoded from hex."""
    return double_sha256(bytes.fromhex(data_hex))


@mcp.tool()
def compute_merkle_root(leaf_hashes: list[str]) -> str:
    """Compute a Bitcoin-style Merkle root from a list of leaf hex hashes.

    Empty list returns 64 zeros. Uses the same pairing+sha256 combine as
    `Block.compute_merkle_root`: odd levels duplicate the last hash, then
    concatenate-and-hash up the tree.
    """
    if not leaf_hashes:
        return "0" * 64
    hashes = list(leaf_hashes)
    while len(hashes) > 1:
        if len(hashes) % 2 == 1:
            hashes.append(hashes[-1])
        hashes = [sha256((hashes[i] + hashes[i + 1]).encode()) for i in range(0, len(hashes), 2)]
    return hashes[0]


@mcp.tool()
def mine_header(
    version: int,
    prev_hash: str,
    merkle_root: str,
    timestamp: int,
    difficulty_target: int,
    max_nonce: int = 2**24,
) -> dict[str, Any]:
    """Mine a block header to satisfy the difficulty target.

    Default `max_nonce` is 2**24 (~16M) so the call returns in seconds, not
    minutes. Returns {nonce, hash} on success or {error: "exhausted"} on
    failure.
    """
    header = BlockHeader(
        version=version,
        prev_block_hash=prev_hash,
        merkle_root=merkle_root,
        timestamp=timestamp,
        difficulty_target=difficulty_target,
        nonce=0,
    )
    mined = mine_block(header, max_nonce=max_nonce)
    if mined is None:
        return {"error": "exhausted", "max_nonce": max_nonce}
    return {"nonce": mined.nonce, "hash": mined.compute_hash()}


@mcp.tool()
def validate_header(
    version: int,
    prev_hash: str,
    merkle_root: str,
    timestamp: int,
    difficulty_target: int,
    nonce: int,
) -> bool:
    """Return True if the given header (with its nonce) meets difficulty."""
    return BlockHeader(
        version=version,
        prev_block_hash=prev_hash,
        merkle_root=merkle_root,
        timestamp=timestamp,
        difficulty_target=difficulty_target,
        nonce=nonce,
    ).meets_difficulty()


@mcp.tool()
def create_blockchain(difficulty: int = 8) -> str:
    """Create a new in-memory blockchain with a genesis block and return its chain_id."""
    chain = Blockchain(difficulty=difficulty)
    chain.create_genesis_block()
    chain_id = str(uuid.uuid4())
    _state.CHAINS[chain_id] = chain
    return chain_id


@mcp.tool()
def add_block(chain_id: str, txs: list[dict[str, Any]]) -> dict[str, Any]:
    """Mine and append a new block to the given chain.

    `txs` is a list of {sender, recipient, amount} dicts. Returns the new
    block's index and hash, or an error.
    """
    chain = _state.CHAINS.get(chain_id)
    if chain is None:
        return {"error": "unknown chain_id"}

    transactions = [
        Transaction(sender=t["sender"], recipient=t["recipient"], amount=float(t["amount"]))
        for t in txs
    ]
    block = chain.add_block(transactions)
    if block is None:
        return {"error": "mining failed"}
    return {"index": chain.get_chain_length() - 1, "hash": block.header.compute_hash()}


@mcp.tool()
def validate_blockchain(chain_id: str) -> bool:
    """Validate the entire chain (proof-of-work, linkage, Merkle roots)."""
    chain = _state.CHAINS.get(chain_id)
    if chain is None:
        return False
    return chain.validate_chain()


@mcp.tool()
def get_chain_info(chain_id: str) -> dict[str, Any]:
    """Return summary metadata for a chain."""
    chain = _state.CHAINS.get(chain_id)
    if chain is None:
        return {"error": "unknown chain_id"}
    latest = chain.get_latest_block()
    return {
        "length": chain.get_chain_length(),
        "difficulty": chain.difficulty,
        "latest_hash": latest.header.compute_hash() if latest else None,
    }


@mcp.tool()
def compare_blockchains(chain_a_id: str, chain_b_id: str) -> str:
    """Return 'A', 'B', or 'equal' — Bitcoin longest-valid-chain rule."""
    a = _state.CHAINS.get(chain_a_id)
    b = _state.CHAINS.get(chain_b_id)
    if a is None or b is None:
        return "equal"
    return compare_chains(a, b)


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()

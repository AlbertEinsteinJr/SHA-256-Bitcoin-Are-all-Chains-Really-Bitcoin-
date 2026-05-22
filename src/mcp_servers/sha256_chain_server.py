"""MCP server exposing this repo's SHA-256 / blockchain primitives.

Transport: stdio. SDK: the official mcp Python SDK (FastMCP decorator API,
shipped as `mcp.server.fastmcp`). Argument and return shapes use pydantic
models so MCP clients see rich JSON schemas.

Run with:
    python -m src.mcp_servers.sha256_chain_server
or the console script:
    sha256-chain-mcp
"""

from __future__ import annotations

import copy
import uuid
from typing import Annotated, Literal

from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field

from src.block import BlockHeader, Transaction, mine_block
from src.chain import Blockchain, compare_chains
from src.sha256 import double_sha256, sha256

from . import _state

mcp = FastMCP("sha256-chain")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class TxInput(BaseModel):
    """A transaction to include in a mined block."""

    sender: str = Field(description="Sender address or label.")
    recipient: str = Field(description="Recipient address or label.")
    amount: float = Field(description="Amount transferred.", ge=0)


class MinedHeader(BaseModel):
    nonce: int
    hash: str


class MineError(BaseModel):
    error: Literal["exhausted"]
    max_nonce: int


class BlockSummary(BaseModel):
    index: int
    hash: str


class ChainInfo(BaseModel):
    length: int
    difficulty: int
    latest_hash: str | None


class BlockDetails(BaseModel):
    index: int
    hash: str
    prev_hash: str
    merkle_root: str
    timestamp: int
    difficulty_target: int
    nonce: int
    transactions: list[TxInput]


class TxDetail(TxInput):
    tx_id: str


# ---------------------------------------------------------------------------
# Hashing primitives
# ---------------------------------------------------------------------------


@mcp.tool()
def hash_sha256(
    data_hex: Annotated[str, Field(description="Hex-encoded bytes to hash.")],
) -> str:
    """SHA-256 of the bytes decoded from hex. Returns lowercase hex digest."""
    return sha256(bytes.fromhex(data_hex))


@mcp.tool()
def hash_double_sha256(
    data_hex: Annotated[str, Field(description="Hex-encoded bytes to hash.")],
) -> str:
    """Bitcoin-style double SHA-256 of the bytes decoded from hex."""
    return double_sha256(bytes.fromhex(data_hex))


@mcp.tool()
def compute_merkle_root(
    leaf_hashes: Annotated[
        list[str],
        Field(description="Leaf hashes (hex). Empty list returns 64 zeros."),
    ],
) -> str:
    """Compute a Bitcoin-style Merkle root from a list of leaf hex hashes.

    Uses the same pairing+sha256 combine as `Block.compute_merkle_root`:
    odd levels duplicate the last hash, then concatenate-and-hash up the
    tree.
    """
    if not leaf_hashes:
        return "0" * 64
    hashes = list(leaf_hashes)
    while len(hashes) > 1:
        if len(hashes) % 2 == 1:
            hashes.append(hashes[-1])
        hashes = [sha256((hashes[i] + hashes[i + 1]).encode()) for i in range(0, len(hashes), 2)]
    return hashes[0]


# ---------------------------------------------------------------------------
# Header mining / validation
# ---------------------------------------------------------------------------


@mcp.tool()
def mine_header(
    version: int,
    prev_hash: Annotated[str, Field(description="64-char hex hash of the previous block header.")],
    merkle_root: Annotated[str, Field(description="64-char hex Merkle root over transactions.")],
    timestamp: int,
    difficulty_target: Annotated[
        int, Field(description="Required leading zero bits.", ge=0, le=256)
    ],
    max_nonce: Annotated[int, Field(description="Nonce search ceiling.", ge=1)] = 2**24,
) -> MinedHeader | MineError:
    """Mine a block header to satisfy the difficulty target.

    Default `max_nonce` is 2**24 (~16M) so the call returns in seconds, not
    minutes.
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
        return MineError(error="exhausted", max_nonce=max_nonce)
    return MinedHeader(nonce=mined.nonce, hash=mined.compute_hash())


@mcp.tool()
def validate_header(
    version: int,
    prev_hash: str,
    merkle_root: str,
    timestamp: int,
    difficulty_target: Annotated[int, Field(ge=0, le=256)],
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


# ---------------------------------------------------------------------------
# Blockchain state
# ---------------------------------------------------------------------------


@mcp.tool()
def create_blockchain(
    difficulty: Annotated[
        int, Field(description="Leading zero bits required for PoW.", ge=0, le=64)
    ] = 8,
) -> str:
    """Create a new in-memory blockchain with a genesis block and return its chain_id."""
    chain = Blockchain(difficulty=difficulty)
    chain.create_genesis_block()
    chain_id = str(uuid.uuid4())
    _state.CHAINS[chain_id] = chain
    return chain_id


@mcp.tool()
def add_block(
    chain_id: str,
    txs: Annotated[list[TxInput], Field(description="Transactions to include in the new block.")],
) -> BlockSummary | dict[str, str]:
    """Mine and append a new block to the given chain."""
    chain = _state.CHAINS.get(chain_id)
    if chain is None:
        return {"error": "unknown chain_id"}

    transactions = [
        Transaction(sender=t.sender, recipient=t.recipient, amount=float(t.amount)) for t in txs
    ]
    block = chain.add_block(transactions)
    if block is None:
        return {"error": "mining failed"}
    return BlockSummary(index=chain.get_chain_length() - 1, hash=block.header.compute_hash())


@mcp.tool()
def validate_blockchain(chain_id: str) -> bool:
    """Validate the entire chain (proof-of-work, linkage, Merkle roots)."""
    chain = _state.CHAINS.get(chain_id)
    if chain is None:
        return False
    return chain.validate_chain()


@mcp.tool()
def get_chain_info(chain_id: str) -> ChainInfo | dict[str, str]:
    """Return summary metadata for a chain."""
    chain = _state.CHAINS.get(chain_id)
    if chain is None:
        return {"error": "unknown chain_id"}
    latest = chain.get_latest_block()
    return ChainInfo(
        length=chain.get_chain_length(),
        difficulty=chain.difficulty,
        latest_hash=latest.header.compute_hash() if latest else None,
    )


@mcp.tool()
def get_block(
    chain_id: str,
    index: Annotated[int, Field(description="Zero-based block index.", ge=0)],
) -> BlockDetails | dict[str, str]:
    """Return full details of a block at the given index."""
    chain = _state.CHAINS.get(chain_id)
    if chain is None:
        return {"error": "unknown chain_id"}
    block = chain.get_block_by_index(index)
    if block is None:
        return {"error": "index out of range"}
    return BlockDetails(
        index=index,
        hash=block.header.compute_hash(),
        prev_hash=block.header.prev_block_hash,
        merkle_root=block.header.merkle_root,
        timestamp=block.header.timestamp,
        difficulty_target=block.header.difficulty_target,
        nonce=block.header.nonce,
        transactions=[
            TxInput(sender=tx.sender, recipient=tx.recipient, amount=tx.amount)
            for tx in block.transactions
        ],
    )


@mcp.tool()
def list_transactions(
    chain_id: str,
    block_index: Annotated[int, Field(ge=0)],
) -> list[TxDetail] | dict[str, str]:
    """List the transactions in a specific block, including their tx_ids."""
    chain = _state.CHAINS.get(chain_id)
    if chain is None:
        return {"error": "unknown chain_id"}
    block = chain.get_block_by_index(block_index)
    if block is None:
        return {"error": "index out of range"}
    return [
        TxDetail(sender=tx.sender, recipient=tx.recipient, amount=tx.amount, tx_id=tx.tx_id)
        for tx in block.transactions
    ]


@mcp.tool()
def compare_blockchains(chain_a_id: str, chain_b_id: str) -> Literal["A", "B", "equal"]:
    """Return 'A', 'B', or 'equal' — Bitcoin longest-valid-chain rule."""
    a = _state.CHAINS.get(chain_a_id)
    b = _state.CHAINS.get(chain_b_id)
    if a is None or b is None:
        return "equal"
    return compare_chains(a, b)  # type: ignore[return-value]


@mcp.tool()
def fork_chain(chain_id: str) -> str | dict[str, str]:
    """Deep-copy an existing chain and return the new chain_id.

    Both chains start equal; further `add_block` calls diverge them so
    `compare_blockchains` can demonstrate the longest-valid-chain rule.
    """
    chain = _state.CHAINS.get(chain_id)
    if chain is None:
        return {"error": "unknown chain_id"}
    new_id = str(uuid.uuid4())
    _state.CHAINS[new_id] = copy.deepcopy(chain)
    return new_id


@mcp.tool()
def tamper_block(
    chain_id: str,
    block_index: Annotated[
        int, Field(description="Block to tamper (>= 1; genesis is immutable here).", ge=1)
    ],
    tx_index: Annotated[
        int, Field(description="Transaction within the block to mutate.", ge=0)
    ] = 0,
    new_recipient: str = "attacker",
) -> dict[str, object]:
    """Demonstration: rewrite a transaction's recipient in-place.

    Returns the chain's `validate_blockchain` result before and after.
    Useful to show that any post-mining edit breaks Merkle root or PoW
    invariants and is caught by validation.
    """
    chain = _state.CHAINS.get(chain_id)
    if chain is None:
        return {"error": "unknown chain_id"}
    block = chain.get_block_by_index(block_index)
    if block is None:
        return {"error": "block index out of range"}
    if tx_index >= len(block.transactions):
        return {"error": "tx index out of range"}

    before = chain.validate_chain()
    block.transactions[tx_index].recipient = new_recipient
    after = chain.validate_chain()
    return {
        "valid_before": before,
        "valid_after": after,
        "tampered_tx_id": block.transactions[tx_index].tx_id,
    }


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()

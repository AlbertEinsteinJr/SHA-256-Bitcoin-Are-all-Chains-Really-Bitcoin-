"""
Bitcoin-style block data structures and validation logic.

Models a simplified version of the Bitcoin block header and chain,
demonstrating how SHA-256 proof-of-work secures the blockchain.
"""

import struct
import time
from dataclasses import dataclass, field
from typing import List, Optional

from .sha256 import double_sha256, sha256


@dataclass
class BlockHeader:
    """A simplified Bitcoin-style block header."""

    version: int
    prev_block_hash: str
    merkle_root: str
    timestamp: int
    difficulty_target: int  # number of leading zero bits required
    nonce: int = 0

    def serialize(self) -> bytes:
        """Serialize the header to bytes for hashing."""
        return (
            struct.pack("<I", self.version)
            + bytes.fromhex(self.prev_block_hash)
            + bytes.fromhex(self.merkle_root)
            + struct.pack("<I", self.timestamp)
            + struct.pack("<I", self.difficulty_target)
            + struct.pack("<I", self.nonce)
        )

    def compute_hash(self) -> str:
        """Compute the double-SHA-256 hash of this block header."""
        return double_sha256(self.serialize())

    def meets_difficulty(self) -> bool:
        """Check whether this header's hash meets the difficulty target."""
        hash_hex = self.compute_hash()
        # Count leading zero hex characters required
        required_zeros = self.difficulty_target // 4
        return hash_hex[:required_zeros] == "0" * required_zeros


@dataclass
class Transaction:
    """A simplified transaction."""

    sender: str
    recipient: str
    amount: float
    tx_id: str = ""

    def __post_init__(self):
        if not self.tx_id:
            self.tx_id = sha256(
                f"{self.sender}{self.recipient}{self.amount}{time.time()}".encode()
            )

    def serialize(self) -> bytes:
        return f"{self.sender}:{self.recipient}:{self.amount}".encode()


@dataclass
class Block:
    """A full block containing a header and a list of transactions."""

    header: BlockHeader
    transactions: List[Transaction] = field(default_factory=list)

    def compute_merkle_root(self) -> str:
        """Compute the Merkle root of the block's transactions."""
        if not self.transactions:
            return "0" * 64

        hashes = [sha256(tx.serialize()) for tx in self.transactions]

        while len(hashes) > 1:
            if len(hashes) % 2 == 1:
                hashes.append(hashes[-1])  # duplicate last hash if odd
            next_level = []
            for i in range(0, len(hashes), 2):
                combined = hashes[i] + hashes[i + 1]
                next_level.append(sha256(combined.encode()))
            hashes = next_level

        return hashes[0]

    def validate_merkle_root(self) -> bool:
        """Validate that the header's Merkle root matches the transactions."""
        return self.compute_merkle_root() == self.header.merkle_root


def mine_block(header: BlockHeader, max_nonce: int = 2**32) -> Optional[BlockHeader]:
    """
    Attempt to find a nonce that makes the header hash meet difficulty.

    Parameters
    ----------
    header : BlockHeader
        The block header to mine (nonce will be mutated).
    max_nonce : int
        Maximum nonce value to try before giving up.

    Returns
    -------
    Optional[BlockHeader]
        The header with a valid nonce, or None if not found.
    """
    for nonce in range(max_nonce):
        header.nonce = nonce
        if header.meets_difficulty():
            return header
    return None

"""
Bitcoin-style block data structures and validation logic.

Models a simplified version of the Bitcoin block header and chain,
demonstrating how SHA-256 proof-of-work secures the blockchain.
"""

import struct
import time
from dataclasses import dataclass, field, replace
from typing import List, Optional

from .sha256 import (
    H_INIT,
    _compress,
    _pad_message,
    double_sha256,
    sha256,
    sha256_midstate,
)


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

    def is_well_formed(self) -> bool:
        """
        Report whether this header can be serialized at all.

        A malformed header is an *invalid block*, not an exception. Without
        this guard, `serialize()` raises ValueError out of `bytes.fromhex()`
        on any header carrying non-hex or wrong-length hash fields -- so a
        validator walking attacker-supplied blocks crashes instead of
        rejecting them, which is a denial of service rather than a rejection.
        """
        for hash_field in (self.prev_block_hash, self.merkle_root):
            if not isinstance(hash_field, str) or len(hash_field) != 64:
                return False
            try:
                bytes.fromhex(hash_field)
            except ValueError:
                return False

        for number in (self.version, self.timestamp, self.difficulty_target, self.nonce):
            if not isinstance(number, int) or not 0 <= number <= 0xFFFFFFFF:
                return False

        return True

    def compute_hash(self) -> str:
        """Compute the double-SHA-256 hash of this block header."""
        return double_sha256(self.serialize())

    def meets_difficulty(self, required_bits: Optional[int] = None) -> bool:
        """
        Check whether this header's hash meets a difficulty target.

        Parameters
        ----------
        required_bits : Optional[int]
            The number of leading zero *bits* the CALLER demands. When
            omitted, the header's own ``difficulty_target`` is used -- which
            is correct while mining, because the miner chooses its own
            target, and is NEVER correct while validating, because there the
            target is supplied by whoever produced the block. Chain
            validation must always pass the chain's policy explicitly.

        Notes
        -----
        The comparison is bit-exact. The previous implementation counted
        leading zero *hex characters* via ``difficulty_target // 4``, which
        silently rounded down: targets of 8, 9, 10 and 11 bits all demanded
        the same two hex zeros. For targets that are multiples of four the
        two formulations agree exactly, so no existing chain is affected.
        """
        if required_bits is None:
            required_bits = self.difficulty_target
        if required_bits <= 0:
            return True
        if required_bits > 256:
            return False
        return int(self.compute_hash(), 16) < (1 << (256 - required_bits))


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


# A block header is 80 bytes, which pads to exactly two 64-byte compression
# blocks. The nonce occupies bytes 76..79 -- entirely inside the second block --
# so the first block's compression is identical for every nonce tried.
_HEADER_PADDED_LEN = 128
_NONCE_OFFSET_IN_TAIL = 76 - 64

# The second SHA-256 of a double-SHA always hashes exactly 32 bytes, so its
# padding block is a constant: 0x80, then zeros, then the length (256 bits).
_SECOND_HASH_PAD = b"\x80" + b"\x00" * 23 + struct.pack(">Q", 256)


def _mine_search(header: BlockHeader, max_nonce: int) -> Optional[int]:
    """
    Search for a nonce satisfying *header*'s declared difficulty target.

    Hashing the whole 80-byte header per attempt costs three compression
    blocks: two for the padded header, one for the second SHA-256. Because
    the nonce lives entirely in the header's second block, the first block's
    compression can be hoisted out of the loop, leaving two -- which is the
    same trick real Bitcoin miners use.

    Returns the winning nonce, or None if the budget is exhausted.
    """
    required = header.difficulty_target
    if required > 256:
        return None
    limit = (1 << (256 - required)) if required > 0 else (1 << 256)

    padded = _pad_message(header.serialize())
    if len(padded) != _HEADER_PADDED_LEN:  # pragma: no cover - layout guard
        raise RuntimeError(
            f"header padded to {len(padded)} bytes, expected {_HEADER_PADDED_LEN}; "
            "the midstate split assumes an 80-byte header"
        )

    midstate = sha256_midstate(padded[:64])
    tail = bytearray(padded[64:])
    offset = _NONCE_OFFSET_IN_TAIL

    for nonce in range(min(max_nonce, 1 << 32)):
        tail[offset : offset + 4] = struct.pack("<I", nonce)
        first = struct.pack(">8I", *_compress(midstate, bytes(tail)))
        digest = struct.pack(">8I", *_compress(H_INIT, first + _SECOND_HASH_PAD))
        if int.from_bytes(digest, "big") < limit:
            return nonce
    return None


def mine_block(header: BlockHeader, max_nonce: int = 2**32) -> Optional[BlockHeader]:
    """
    Attempt to find a nonce that makes the header hash meet difficulty.

    Parameters
    ----------
    header : BlockHeader
        The block header to mine. It is **not** modified.
    max_nonce : int
        Maximum nonce value to try before giving up.

    Returns
    -------
    Optional[BlockHeader]
        A new header carrying a valid nonce, or None if none was found.
    """
    nonce = _mine_search(header, max_nonce)
    if nonce is None:
        return None

    mined = replace(header, nonce=nonce)

    # Cross-check the midstate fast path against the plain reference hash.
    # A midstate or endianness slip would otherwise emit silently invalid
    # blocks; this turns that whole class of bug into an immediate, loud
    # failure for the cost of one extra hash per mined block.
    if not mined.meets_difficulty(header.difficulty_target):
        raise RuntimeError(  # pragma: no cover - guards against a coding slip
            "midstate miner disagreed with the reference hash"
        )
    return mined

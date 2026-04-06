"""
Blockchain implementation with chain validation.

Implements a simplified Bitcoin-style blockchain that links blocks
via SHA-256 hashes and validates chain integrity.
"""

from dataclasses import dataclass, field
from typing import List, Optional

from .block import Block, BlockHeader, Transaction, mine_block
from .sha256 import sha256


GENESIS_PREV_HASH = "0" * 64


@dataclass
class Blockchain:
    """A simplified blockchain with validation capabilities."""

    chain: List[Block] = field(default_factory=list)
    difficulty: int = 8  # number of leading zero bits

    def create_genesis_block(self) -> Block:
        """Create and add the genesis (first) block."""
        tx = Transaction(sender="network", recipient="genesis", amount=50.0)
        header = BlockHeader(
            version=1,
            prev_block_hash=GENESIS_PREV_HASH,
            merkle_root="",
            timestamp=1231006505,  # Bitcoin genesis block timestamp
            difficulty_target=self.difficulty,
            nonce=0,
        )
        block = Block(header=header, transactions=[tx])
        block.header.merkle_root = block.compute_merkle_root()

        mined_header = mine_block(block.header)
        if mined_header:
            block.header = mined_header

        self.chain.append(block)
        return block

    def add_block(self, transactions: List[Transaction]) -> Optional[Block]:
        """
        Create, mine, and append a new block with the given transactions.

        Returns None if mining fails or the chain is empty.
        """
        if not self.chain:
            return None

        prev_block = self.chain[-1]
        prev_hash = prev_block.header.compute_hash()

        header = BlockHeader(
            version=1,
            prev_block_hash=prev_hash,
            merkle_root="",
            timestamp=prev_block.header.timestamp + 600,
            difficulty_target=self.difficulty,
            nonce=0,
        )
        block = Block(header=header, transactions=transactions)
        block.header.merkle_root = block.compute_merkle_root()

        mined_header = mine_block(block.header)
        if mined_header is None:
            return None

        block.header = mined_header
        self.chain.append(block)
        return block

    def validate_chain(self) -> bool:
        """
        Validate the entire blockchain.

        Checks:
        1. Each block's hash meets the difficulty target.
        2. Each block's prev_block_hash matches the prior block's hash.
        3. Each block's Merkle root is consistent with its transactions.
        """
        if not self.chain:
            return True

        # Validate genesis block
        genesis = self.chain[0]
        if genesis.header.prev_block_hash != GENESIS_PREV_HASH:
            return False

        for i in range(len(self.chain)):
            block = self.chain[i]

            # Check proof-of-work
            if not block.header.meets_difficulty():
                return False

            # Check Merkle root
            if not block.validate_merkle_root():
                return False

            # Check chain linkage (skip genesis)
            if i > 0:
                expected_prev = self.chain[i - 1].header.compute_hash()
                if block.header.prev_block_hash != expected_prev:
                    return False

        return True

    def get_block_by_index(self, index: int) -> Optional[Block]:
        """Return a block by its index, or None if out of range."""
        if 0 <= index < len(self.chain):
            return self.chain[index]
        return None

    def get_chain_length(self) -> int:
        """Return the number of blocks in the chain."""
        return len(self.chain)

    def get_latest_block(self) -> Optional[Block]:
        """Return the most recent block, or None if the chain is empty."""
        return self.chain[-1] if self.chain else None


def compare_chains(chain_a: Blockchain, chain_b: Blockchain) -> str:
    """
    Compare two blockchains and determine which is authoritative.

    In Bitcoin, the longest valid chain wins.

    Returns
    -------
    str
        'A', 'B', or 'equal'
    """
    a_valid = chain_a.validate_chain()
    b_valid = chain_b.validate_chain()

    if a_valid and not b_valid:
        return "A"
    if b_valid and not a_valid:
        return "B"
    if not a_valid and not b_valid:
        return "equal"  # neither is valid

    if chain_a.get_chain_length() > chain_b.get_chain_length():
        return "A"
    elif chain_b.get_chain_length() > chain_a.get_chain_length():
        return "B"
    else:
        return "equal"

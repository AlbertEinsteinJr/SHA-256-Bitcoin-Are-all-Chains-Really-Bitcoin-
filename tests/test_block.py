"""Tests for block structures and mining."""

from src.block import Block, BlockHeader, Transaction, mine_block
from src.sha256 import sha256


class TestBlockHeader:
    """Tests for BlockHeader."""

    def test_serialize_returns_bytes(self):
        header = BlockHeader(
            version=1,
            prev_block_hash="0" * 64,
            merkle_root="a" * 64,
            timestamp=1231006505,
            difficulty_target=4,
            nonce=0,
        )
        result = header.serialize()
        assert isinstance(result, bytes)
        assert len(result) > 0

    def test_compute_hash_returns_hex(self):
        header = BlockHeader(
            version=1,
            prev_block_hash="0" * 64,
            merkle_root="a" * 64,
            timestamp=1231006505,
            difficulty_target=4,
            nonce=0,
        )
        result = header.compute_hash()
        assert isinstance(result, str)
        assert len(result) == 64

    def test_different_nonce_different_hash(self):
        h1 = BlockHeader(1, "0" * 64, "a" * 64, 1000, 4, nonce=0)
        h2 = BlockHeader(1, "0" * 64, "a" * 64, 1000, 4, nonce=1)
        assert h1.compute_hash() != h2.compute_hash()


class TestTransaction:
    """Tests for Transaction."""

    def test_transaction_creation(self):
        tx = Transaction(sender="alice", recipient="bob", amount=1.5)
        assert tx.sender == "alice"
        assert tx.recipient == "bob"
        assert tx.amount == 1.5
        assert tx.tx_id != ""

    def test_serialize(self):
        tx = Transaction(sender="alice", recipient="bob", amount=1.5)
        result = tx.serialize()
        assert b"alice" in result
        assert b"bob" in result


class TestMining:
    """Tests for block mining."""

    def test_mine_block_low_difficulty(self):
        header = BlockHeader(
            version=1,
            prev_block_hash="0" * 64,
            merkle_root="a" * 64,
            timestamp=1000,
            difficulty_target=4,
            nonce=0,
        )
        result = mine_block(header, max_nonce=100_000)
        assert result is not None
        assert result.meets_difficulty()

"""Tests for blockchain validation."""

from src.block import Transaction
from src.chain import Blockchain


class TestBlockchain:
    """Tests for the Blockchain class."""

    def test_create_genesis_block(self):
        bc = Blockchain(difficulty=4)
        genesis = bc.create_genesis_block()
        assert genesis is not None
        assert bc.get_chain_length() == 1

    def test_validate_single_block_chain(self):
        bc = Blockchain(difficulty=4)
        bc.create_genesis_block()
        assert bc.validate_chain() is True

    def test_empty_chain_is_valid(self):
        bc = Blockchain(difficulty=4)
        assert bc.validate_chain() is True

    def test_add_block_to_chain(self):
        bc = Blockchain(difficulty=4)
        bc.create_genesis_block()
        txs = [Transaction(sender="alice", recipient="bob", amount=1.0)]
        block = bc.add_block(txs)
        assert block is not None
        assert bc.get_chain_length() == 2

    def test_chain_validation_with_multiple_blocks(self):
        bc = Blockchain(difficulty=4)
        bc.create_genesis_block()
        txs = [Transaction(sender="alice", recipient="bob", amount=1.0)]
        bc.add_block(txs)
        assert bc.validate_chain() is True

"""Tests for chain validation, tamper detection, chain accessors, and fork choice.

Mining is real proof-of-work, so every chain here uses ``difficulty=4`` and the
shared chains are built once per module then ``deepcopy``-ed per test to keep
tests isolated without paying to re-mine.
"""

import copy

import pytest

from src.block import Transaction, mine_block
from src.chain import GENESIS_PREV_HASH, Blockchain, compare_chains


DIFFICULTY = 4


def _build_chain(num_blocks: int) -> Blockchain:
    """Build a freshly mined, valid chain containing ``num_blocks`` blocks."""
    bc = Blockchain(difficulty=DIFFICULTY)
    bc.create_genesis_block()
    for i in range(num_blocks - 1):
        bc.add_block([Transaction(sender="alice", recipient="bob", amount=float(i + 1))])
    return bc


def _break_genesis(bc: Blockchain) -> Blockchain:
    """Deterministically invalidate a chain by unlinking its genesis block."""
    bc.chain[0].header.prev_block_hash = "f" * 64
    return bc


def _find_failing_nonce(header) -> int:
    """Find a nonce that deterministically fails the header's difficulty check."""
    original = header.nonce
    try:
        for nonce in range(original + 1, original + 1000):
            header.nonce = nonce
            if not header.meets_difficulty():
                return nonce
    finally:
        header.nonce = original
    raise AssertionError("no failing nonce found")


@pytest.fixture(scope="module")
def chain_2():
    """A valid, mined 2-block chain (genesis + 1)."""
    return _build_chain(2)


@pytest.fixture(scope="module")
def chain_3():
    """A valid, mined 3-block chain (genesis + 2)."""
    return _build_chain(3)


class TestValidChain:
    """A chain that has not been touched since mining must validate."""

    def test_untampered_chain_is_valid(self, chain_2):
        bc = copy.deepcopy(chain_2)
        assert bc.validate_chain() is True

    def test_untampered_longer_chain_is_valid(self, chain_3):
        bc = copy.deepcopy(chain_3)
        assert bc.validate_chain() is True


class TestTamperDetection:
    """Every mutation of a mined chain must be rejected by validate_chain()."""

    def test_tampered_transaction_amount_is_rejected(self, chain_2):
        """Editing a transaction leaves the stored Merkle root stale."""
        bc = copy.deepcopy(chain_2)
        bc.chain[1].transactions[0].amount = 999999.0
        assert bc.validate_chain() is False

    def test_tampered_merkle_root_is_rejected(self, chain_2):
        """Overwriting the header's Merkle root desyncs it from the transactions."""
        bc = copy.deepcopy(chain_2)
        bc.chain[1].header.merkle_root = "a" * 64
        assert bc.chain[1].validate_merkle_root() is False
        assert bc.validate_chain() is False

    def test_tampered_prev_block_hash_breaks_linkage(self, chain_2):
        """Re-mined after the edit, so only the broken linkage can fail it."""
        bc = copy.deepcopy(chain_2)
        bc.chain[1].header.prev_block_hash = "1" * 64
        mined = mine_block(bc.chain[1].header)
        assert mined is not None
        assert bc.chain[1].header.meets_difficulty() is True
        assert bc.chain[1].validate_merkle_root() is True
        assert bc.validate_chain() is False

    def test_tampered_nonce_breaks_proof_of_work(self, chain_2):
        """A nonce that no longer satisfies the target invalidates the block."""
        bc = copy.deepcopy(chain_2)
        bc.chain[1].header.nonce = _find_failing_nonce(bc.chain[1].header)
        assert bc.chain[1].header.meets_difficulty() is False
        assert bc.validate_chain() is False

    def test_tampered_genesis_prev_hash_is_rejected(self, chain_2):
        """The genesis block must point at the all-zero hash."""
        bc = copy.deepcopy(chain_2)
        assert bc.chain[0].header.prev_block_hash == GENESIS_PREV_HASH
        bc.chain[0].header.prev_block_hash = "f" * 64
        assert bc.validate_chain() is False


class TestChainOperations:
    """Accessors and guards on empty and populated chains."""

    def test_empty_chain_validates_and_reports_empty(self):
        bc = Blockchain(difficulty=DIFFICULTY)
        assert bc.validate_chain() is True
        assert bc.get_latest_block() is None
        assert bc.get_chain_length() == 0

    def test_add_block_on_empty_chain_returns_none(self):
        bc = Blockchain(difficulty=DIFFICULTY)
        result = bc.add_block([Transaction(sender="a", recipient="b", amount=1.0)])
        assert result is None
        assert bc.get_chain_length() == 0

    def test_get_block_by_index_valid(self, chain_3):
        bc = copy.deepcopy(chain_3)
        assert bc.get_block_by_index(0) is bc.chain[0]
        assert bc.get_block_by_index(2) is bc.chain[2]

    def test_get_block_by_index_negative_returns_none(self, chain_3):
        bc = copy.deepcopy(chain_3)
        assert bc.get_block_by_index(-1) is None

    def test_get_block_by_index_out_of_range_returns_none(self, chain_3):
        bc = copy.deepcopy(chain_3)
        assert bc.get_block_by_index(bc.get_chain_length()) is None
        assert bc.get_block_by_index(99) is None

    def test_get_latest_block_returns_last_block(self, chain_3):
        bc = copy.deepcopy(chain_3)
        assert bc.get_latest_block() is bc.chain[-1]
        assert bc.get_chain_length() == 3


class TestCompareChains:
    """Fork choice: valid beats invalid, then longest wins."""

    def test_longer_valid_chain_a_wins(self, chain_2, chain_3):
        assert compare_chains(copy.deepcopy(chain_3), copy.deepcopy(chain_2)) == "A"

    def test_longer_valid_chain_b_wins(self, chain_2, chain_3):
        assert compare_chains(copy.deepcopy(chain_2), copy.deepcopy(chain_3)) == "B"

    def test_equal_length_valid_chains_are_equal(self, chain_2):
        assert compare_chains(copy.deepcopy(chain_2), copy.deepcopy(chain_2)) == "equal"

    def test_shorter_valid_chain_beats_longer_invalid_chain(self, chain_2, chain_3):
        """The shorter chain wins, proving validity is checked before length."""
        valid = copy.deepcopy(chain_2)
        invalid = _break_genesis(copy.deepcopy(chain_3))
        assert valid.get_chain_length() < invalid.get_chain_length()
        assert compare_chains(valid, invalid) == "A"
        assert compare_chains(invalid, valid) == "B"

    def test_both_invalid_chains_are_equal(self, chain_2, chain_3):
        a = _break_genesis(copy.deepcopy(chain_3))
        b = _break_genesis(copy.deepcopy(chain_2))
        assert compare_chains(a, b) == "equal"


class TestKnownDefects:
    """Reproductions of open defects. Each asserts the behaviour we want."""

    def test_forged_difficulty_target_is_rejected(self, chain_2):
        """I-1 (FIXED): a forged difficulty_target must not bypass proof-of-work.

        Tampering the amount, repairing the Merkle root, then declaring
        difficulty_target=0 previously satisfied every check and returned
        True with a hash having zero leading zeros. validate_chain now binds
        the target to the chain's own policy.
        """
        bc = copy.deepcopy(chain_2)
        block = bc.chain[1]

        block.transactions[0].amount = 999999.0
        block.header.merkle_root = block.compute_merkle_root()
        block.header.difficulty_target = 0
        block.header.nonce = 0

        # The forgery survives the Merkle and linkage checks unaided.
        assert block.validate_merkle_root() is True
        assert block.header.prev_block_hash == bc.chain[0].header.compute_hash()

        assert bc.validate_chain() is False

    @pytest.mark.xfail(
        strict=True,
        reason="I-3: create_genesis_block appends the block even when mining fails",
    )
    def test_genesis_block_not_appended_when_mining_fails(self, monkeypatch):
        monkeypatch.setattr("src.chain.mine_block", lambda header: None)
        bc = Blockchain(difficulty=DIFFICULTY)

        result = bc.create_genesis_block()

        assert result is None or bc.get_chain_length() == 0

    @pytest.mark.xfail(
        strict=True,
        reason="I-6: validate_chain never checks timestamp monotonicity",
    )
    def test_backdated_block_timestamp_is_rejected(self, chain_2):
        bc = copy.deepcopy(chain_2)
        block = bc.chain[1]

        block.header.timestamp = bc.chain[0].header.timestamp - 600
        mined = mine_block(block.header)
        assert mined is not None

        # Only the timestamp ordering is wrong: PoW, Merkle and linkage all hold.
        assert block.header.meets_difficulty() is True
        assert block.validate_merkle_root() is True
        assert block.header.prev_block_hash == bc.chain[0].header.compute_hash()
        assert block.header.timestamp < bc.chain[0].header.timestamp

        assert bc.validate_chain() is False

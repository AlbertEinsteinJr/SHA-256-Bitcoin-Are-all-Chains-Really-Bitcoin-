"""End-to-end integration tests spanning sha256, block, and chain."""

import copy

import pytest

from src.block import Transaction, mine_block
from src.chain import GENESIS_PREV_HASH, Blockchain, compare_chains

DIFFICULTY = 4


def _txs(prefix, count):
    """Build a small batch of transactions with deterministic contents."""
    return [
        Transaction(sender=f"{prefix}-sender-{i}", recipient=f"{prefix}-recip-{i}", amount=float(i) + 1.0)
        for i in range(count)
    ]


def _build_chain(block_specs):
    """Mine a fresh chain: genesis plus one block per transaction-count spec."""
    bc = Blockchain(difficulty=DIFFICULTY)
    bc.create_genesis_block()
    for i, count in enumerate(block_specs):
        assert bc.add_block(_txs(f"b{i}", count)) is not None
    return bc


@pytest.fixture(scope="module")
def mined_chain():
    """Module-scoped 4-block chain (genesis + 3). Deepcopy before mutating."""
    return _build_chain([1, 2, 3])


@pytest.fixture(scope="module")
def mined_prefix():
    """Module-scoped 2-block common prefix used by fork/reorg scenarios."""
    return _build_chain([2])


class TestFullLifecycle:
    """End-to-end creation, mining, and validation of a multi-block chain."""

    def test_chain_has_genesis_plus_three_blocks(self, mined_chain):
        """Genesis plus three mined blocks yields a chain of length four."""
        chain = copy.deepcopy(mined_chain)
        assert chain.get_chain_length() == 4
        assert chain.chain[0].header.prev_block_hash == GENESIS_PREV_HASH

    def test_full_chain_validates(self, mined_chain):
        """A freshly mined chain passes full validation."""
        chain = copy.deepcopy(mined_chain)
        assert chain.validate_chain() is True

    def test_block_transaction_counts_preserved(self, mined_chain):
        """Each mined block retains exactly the transactions it was given."""
        chain = copy.deepcopy(mined_chain)
        assert [len(b.transactions) for b in chain.chain] == [1, 1, 2, 3]


class TestChainLinkage:
    """Independent re-verification of hash linkage between blocks."""

    def test_prev_hash_matches_previous_block_hash(self, mined_chain):
        """Walking the chain, every prev_block_hash equals the prior header hash."""
        chain = copy.deepcopy(mined_chain)
        for i in range(1, chain.get_chain_length()):
            expected = chain.chain[i - 1].header.compute_hash()
            assert chain.chain[i].header.prev_block_hash == expected

    def test_all_block_hashes_are_distinct(self, mined_chain):
        """No two blocks in the chain share a header hash."""
        chain = copy.deepcopy(mined_chain)
        hashes = [b.header.compute_hash() for b in chain.chain]
        assert len(set(hashes)) == len(hashes)


class TestProofOfWork:
    """Difficulty target re-verified directly, not via validate_chain."""

    def test_every_block_hash_meets_difficulty(self, mined_chain):
        """Every header hash carries the required number of leading zero hex chars."""
        chain = copy.deepcopy(mined_chain)
        required_zeros = DIFFICULTY // 4
        for block in chain.chain:
            digest = block.header.compute_hash()
            assert len(digest) == 64
            assert digest[:required_zeros] == "0" * required_zeros

    def test_every_block_reports_meets_difficulty(self, mined_chain):
        """Each header agrees that it satisfies its own difficulty target."""
        chain = copy.deepcopy(mined_chain)
        for block in chain.chain:
            assert block.header.difficulty_target == DIFFICULTY
            assert block.header.meets_difficulty() is True


class TestMerkleIntegrity:
    """Merkle roots recomputed from transactions across the whole chain."""

    def test_stored_merkle_root_matches_recomputed(self, mined_chain):
        """Each stored merkle_root equals the block's recomputed merkle root."""
        chain = copy.deepcopy(mined_chain)
        for block in chain.chain:
            assert block.header.merkle_root == block.compute_merkle_root()
            assert block.validate_merkle_root() is True


class TestEmptyBlocks:
    """Blocks carrying no transactions remain valid chain members."""

    def test_empty_block_uses_zero_merkle_root_and_validates(self):
        """An empty-transaction block gets a zeroed merkle root and still validates."""
        bc = _build_chain([1])
        empty = bc.add_block([])
        assert empty is not None
        assert empty.transactions == []
        assert empty.header.merkle_root == "0" * 64
        assert bc.get_chain_length() == 3
        assert bc.validate_chain() is True

    def test_chain_extends_past_an_empty_block(self):
        """A non-empty block mined on top of an empty block keeps the chain valid."""
        bc = _build_chain([1])
        bc.add_block([])
        tail = bc.add_block(_txs("tail", 2))
        assert tail is not None
        assert tail.header.prev_block_hash == bc.chain[-2].header.compute_hash()
        assert bc.validate_chain() is True


class TestFork:
    """A shared prefix forking into two independently mined branches."""

    def test_longer_fork_wins(self, mined_prefix):
        """Both forks validate and compare_chains selects the longer branch."""
        long_fork = copy.deepcopy(mined_prefix)
        short_fork = copy.deepcopy(mined_prefix)

        assert long_fork.add_block(_txs("long-a", 1)) is not None
        assert long_fork.add_block(_txs("long-b", 2)) is not None
        assert short_fork.add_block(_txs("short-a", 1)) is not None

        assert long_fork.validate_chain() is True
        assert short_fork.validate_chain() is True
        assert long_fork.get_chain_length() == 4
        assert short_fork.get_chain_length() == 3

        assert compare_chains(long_fork, short_fork) == "A"
        assert compare_chains(short_fork, long_fork) == "B"

    def test_forks_share_the_common_prefix(self, mined_prefix):
        """Both branches keep byte-identical headers for the shared prefix blocks."""
        fork_a = copy.deepcopy(mined_prefix)
        fork_b = copy.deepcopy(mined_prefix)
        fork_a.add_block(_txs("fa", 1))
        fork_b.add_block(_txs("fb", 1))

        for i in range(mined_prefix.get_chain_length()):
            assert (
                fork_a.chain[i].header.compute_hash()
                == fork_b.chain[i].header.compute_hash()
            )
        assert fork_a.chain[-1].header.compute_hash() != fork_b.chain[-1].header.compute_hash()


class TestReorg:
    """Competing miners at equal height, then a tie broken by a new block."""

    def test_equal_length_valid_chains_tie_then_one_wins(self, mined_prefix):
        """Equal-height valid chains compare 'equal'; extending one makes it win."""
        miner_a = copy.deepcopy(mined_prefix)
        miner_b = copy.deepcopy(mined_prefix)

        assert miner_a.add_block(_txs("miner-a", 1)) is not None
        assert miner_b.add_block(_txs("miner-b", 2)) is not None

        assert miner_a.validate_chain() is True
        assert miner_b.validate_chain() is True
        assert miner_a.get_chain_length() == miner_b.get_chain_length()
        assert compare_chains(miner_a, miner_b) == "equal"

        assert miner_b.add_block(_txs("miner-b2", 1)) is not None
        assert miner_b.validate_chain() is True
        assert compare_chains(miner_a, miner_b) == "B"

    def test_invalid_longer_chain_loses_to_valid_shorter_chain(self, mined_prefix):
        """Length never beats validity: a tampered longer chain still loses."""
        honest = copy.deepcopy(mined_prefix)
        attacker = copy.deepcopy(mined_prefix)

        attacker.add_block(_txs("atk-a", 1))
        attacker.add_block(_txs("atk-b", 1))
        attacker.chain[1].transactions[0].amount = 999.0

        assert honest.validate_chain() is True
        assert attacker.validate_chain() is False
        assert attacker.get_chain_length() > honest.get_chain_length()
        assert compare_chains(honest, attacker) == "A"


class TestTamperDetection:
    """Mid-chain tampering is caught end-to-end."""

    def test_tampering_middle_block_transaction_invalidates_chain(self, mined_chain):
        """Editing a transaction in a middle block breaks whole-chain validation."""
        tampered = copy.deepcopy(mined_chain)
        assert tampered.validate_chain() is True

        target = tampered.chain[2]
        target.transactions[0].amount += 1.0

        assert target.validate_merkle_root() is False
        assert tampered.validate_chain() is False
        assert tampered.chain[-1].header.compute_hash() == mined_chain.chain[-1].header.compute_hash()

    def test_repairing_merkle_root_and_remining_still_breaks_linkage(self, mined_chain):
        """Covering up a mid-chain edit re-mines a new hash, so the next block's link fails."""
        tampered = copy.deepcopy(mined_chain)
        target = tampered.chain[2]
        original_hash = target.header.compute_hash()

        target.transactions[0].amount += 1.0
        target.header.merkle_root = target.compute_merkle_root()
        target.header.nonce = 0
        # mine_block returns a NEW header rather than mutating this one, so the
        # result has to be assigned back; relying on in-place mutation was I-4.
        remined = mine_block(target.header)
        assert remined is not None
        target.header = remined

        # Merkle root and proof-of-work now pass in isolation...
        assert target.validate_merkle_root() is True
        assert target.header.meets_difficulty() is True
        # ...but the block hash changed, so the successor's back-link is stale.
        assert target.header.compute_hash() != original_hash
        assert tampered.chain[3].header.prev_block_hash == original_hash
        assert tampered.validate_chain() is False

    def test_tampering_a_copy_leaves_the_source_chain_valid(self, mined_chain):
        """Deepcopy isolation holds: the module-scoped chain stays valid."""
        scratch = copy.deepcopy(mined_chain)
        scratch.chain[1].transactions[0].sender = "attacker"
        assert scratch.validate_chain() is False
        assert mined_chain.validate_chain() is True

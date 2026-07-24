"""Tests for Merkle root computation and validation.

Expected values are computed independently with ``hashlib`` rather than by
re-using ``src.sha256``, so these tests pin the Merkle *algorithm* and not
just the project's own hash implementation.

No mining happens in this module -- Merkle computation is independent of
proof-of-work, so the whole file runs in milliseconds.
"""

import hashlib

import pytest

from src.block import Block, BlockHeader, Transaction

ZERO_ROOT = "0" * 64


def make_header(merkle_root: str = "") -> BlockHeader:
    """Build a dummy header; only ``merkle_root`` matters for these tests."""
    return BlockHeader(
        version=1,
        prev_block_hash="0" * 64,
        merkle_root=merkle_root,
        timestamp=1000,
        difficulty_target=4,
        nonce=0,
    )


def make_txs(count: int):
    """Build ``count`` distinct transactions with deterministic payloads."""
    return [
        Transaction(sender=f"sender{i}", recipient=f"recipient{i}", amount=float(i))
        for i in range(count)
    ]


def leaf(tx: Transaction) -> str:
    """Independent leaf hash: single SHA-256 over the serialized transaction."""
    return hashlib.sha256(tx.serialize()).hexdigest()


def combine(left: str, right: str) -> str:
    """Independent parent hash: single SHA-256 over the concatenated hex strings."""
    return hashlib.sha256((left + right).encode()).hexdigest()


class TestMerkleRootBasics:
    """Shape and edge-case behaviour of Block.compute_merkle_root()."""

    def test_empty_transactions_returns_zero_root(self):
        block = Block(header=make_header(), transactions=[])
        assert block.compute_merkle_root() == ZERO_ROOT

    def test_root_is_64_lowercase_hex_chars(self):
        block = Block(header=make_header(), transactions=make_txs(3))
        root = block.compute_merkle_root()
        assert isinstance(root, str)
        assert len(root) == 64
        assert all(c in "0123456789abcdef" for c in root)

    def test_computation_is_deterministic(self):
        block = Block(header=make_header(), transactions=make_txs(5))
        assert block.compute_merkle_root() == block.compute_merkle_root()

    def test_equivalent_blocks_produce_same_root(self):
        block_a = Block(header=make_header(), transactions=make_txs(4))
        block_b = Block(header=make_header(), transactions=make_txs(4))
        assert block_a.compute_merkle_root() == block_b.compute_merkle_root()

    def test_different_transactions_produce_different_root(self):
        block_a = Block(header=make_header(), transactions=make_txs(3))
        block_b = Block(header=make_header(), transactions=make_txs(4))
        assert block_a.compute_merkle_root() != block_b.compute_merkle_root()

    def test_transaction_order_changes_root(self):
        txs = make_txs(3)
        block_a = Block(header=make_header(), transactions=list(txs))
        block_b = Block(header=make_header(), transactions=list(reversed(txs)))
        assert block_a.compute_merkle_root() != block_b.compute_merkle_root()

    def test_compute_does_not_mutate_transaction_list(self):
        txs = make_txs(3)
        block = Block(header=make_header(), transactions=txs)
        block.compute_merkle_root()
        assert len(block.transactions) == 3
        assert block.transactions == txs


class TestMerkleRootExactValues:
    """Pin the exact root for 1..5 transactions against independent math."""

    def test_one_transaction_root_is_the_leaf_hash(self):
        txs = make_txs(1)
        block = Block(header=make_header(), transactions=txs)
        assert block.compute_merkle_root() == leaf(txs[0])

    def test_two_transactions_root_is_single_combination(self):
        txs = make_txs(2)
        block = Block(header=make_header(), transactions=txs)
        expected = combine(leaf(txs[0]), leaf(txs[1]))
        assert block.compute_merkle_root() == expected

    def test_three_transactions_duplicate_last_hash(self):
        """Odd level duplicates the LAST hash, not the first."""
        txs = make_txs(3)
        block = Block(header=make_header(), transactions=txs)

        h0, h1, h2 = (leaf(tx) for tx in txs)
        # level 0: [h0, h1, h2] -> odd -> [h0, h1, h2, h2]
        level1 = [combine(h0, h1), combine(h2, h2)]
        expected = combine(level1[0], level1[1])

        assert block.compute_merkle_root() == expected

    def test_three_transactions_differs_from_duplicating_first(self):
        """Guard the duplicate-LAST rule against a duplicate-first regression."""
        txs = make_txs(3)
        block = Block(header=make_header(), transactions=txs)

        h0, h1, h2 = (leaf(tx) for tx in txs)
        duplicate_first = combine(combine(h0, h0), combine(h1, h2))

        assert block.compute_merkle_root() != duplicate_first

    def test_four_transactions_two_level_tree(self):
        txs = make_txs(4)
        block = Block(header=make_header(), transactions=txs)

        h0, h1, h2, h3 = (leaf(tx) for tx in txs)
        expected = combine(combine(h0, h1), combine(h2, h3))

        assert block.compute_merkle_root() == expected

    def test_five_transactions_duplicates_at_two_levels(self):
        """5 leaves -> pad to 6 -> 3 nodes -> pad to 4 -> 2 -> 1."""
        txs = make_txs(5)
        block = Block(header=make_header(), transactions=txs)

        h0, h1, h2, h3, h4 = (leaf(tx) for tx in txs)
        # level 0: [h0..h4] -> odd -> [h0, h1, h2, h3, h4, h4]
        level1 = [combine(h0, h1), combine(h2, h3), combine(h4, h4)]
        # level 1: 3 nodes -> odd -> duplicate last
        level2 = [combine(level1[0], level1[1]), combine(level1[2], level1[2])]
        expected = combine(level2[0], level2[1])

        assert block.compute_merkle_root() == expected

    def test_odd_padding_collides_with_explicitly_duplicated_last_tx(self):
        """[a, b, c] pads to [a, b, c, c], so it produces the SAME root as the
        four-transaction list [a, b, c, c] -- the CVE-2012-2459 style collision
        that this implementation does not defend against. Pinned, not endorsed.
        """
        a, b, c = make_txs(3)
        three = Block(header=make_header(), transactions=[a, b, c])
        four = Block(header=make_header(), transactions=[a, b, c, c])

        ha, hb, hc = leaf(a), leaf(b), leaf(c)
        expected = combine(combine(ha, hb), combine(hc, hc))

        assert three.compute_merkle_root() == expected
        assert four.compute_merkle_root() == expected


class TestValidateMerkleRoot:
    """Tests for Block.validate_merkle_root()."""

    def test_true_when_header_matches(self):
        txs = make_txs(3)
        block = Block(header=make_header(), transactions=txs)
        block.header.merkle_root = block.compute_merkle_root()
        assert block.validate_merkle_root() is True

    def test_false_when_header_does_not_match(self):
        txs = make_txs(3)
        block = Block(header=make_header(merkle_root="a" * 64), transactions=txs)
        assert block.validate_merkle_root() is False

    def test_false_when_header_root_is_empty(self):
        block = Block(header=make_header(), transactions=make_txs(2))
        assert block.validate_merkle_root() is False

    def test_true_for_empty_block_with_zero_root(self):
        block = Block(header=make_header(merkle_root=ZERO_ROOT), transactions=[])
        assert block.validate_merkle_root() is True

    def test_false_after_transaction_is_appended(self):
        """Tampering with the transaction list invalidates the committed root."""
        block = Block(header=make_header(), transactions=make_txs(2))
        block.header.merkle_root = block.compute_merkle_root()
        assert block.validate_merkle_root() is True

        block.transactions.append(
            Transaction(sender="mallory", recipient="mallory", amount=99.0)
        )
        assert block.validate_merkle_root() is False

    def test_false_after_transaction_is_modified(self):
        block = Block(header=make_header(), transactions=make_txs(2))
        block.header.merkle_root = block.compute_merkle_root()

        block.transactions[0].amount = 999.0
        assert block.validate_merkle_root() is False

    def test_case_sensitive_comparison(self):
        """Comparison is a plain string compare -- uppercase hex does not match."""
        block = Block(header=make_header(), transactions=make_txs(2))
        block.header.merkle_root = block.compute_merkle_root().upper()
        assert block.validate_merkle_root() is False


class TestDocumentedDeviations:
    """Pin behaviour that deliberately differs from real Bitcoin."""

    def test_merkle_uses_hex_string_concatenation_not_bitcoin_bytes(self):
        """DEVIATION PIN (I-8) -- known, documented, intentional.

        Real Bitcoin builds interior Merkle nodes as
        ``SHA256(SHA256(raw_bytes(left) || raw_bytes(right)))``.
        This implementation instead concatenates the two hashes as ASCII HEX
        STRINGS and applies a SINGLE SHA-256 to the UTF-8 encoding of that
        string.  This test asserts the deviation on purpose: if it ever starts
        failing, the algorithm changed and every previously computed root in
        this project is invalidated.
        """
        txs = make_txs(2)
        block = Block(header=make_header(), transactions=txs)
        h0, h1 = leaf(txs[0]), leaf(txs[1])

        hex_string_single_sha = hashlib.sha256((h0 + h1).encode()).hexdigest()
        bitcoin_bytes_double_sha = hashlib.sha256(
            hashlib.sha256(bytes.fromhex(h0) + bytes.fromhex(h1)).digest()
        ).hexdigest()

        assert block.compute_merkle_root() == hex_string_single_sha
        assert block.compute_merkle_root() != bitcoin_bytes_double_sha

    def test_leaf_hash_is_single_sha256_not_double(self):
        """DEVIATION PIN (I-8) -- leaves are single-SHA-256, Bitcoin uses double."""
        txs = make_txs(1)
        block = Block(header=make_header(), transactions=txs)
        payload = txs[0].serialize()

        single = hashlib.sha256(payload).hexdigest()
        double = hashlib.sha256(hashlib.sha256(payload).digest()).hexdigest()

        assert block.compute_merkle_root() == single
        assert block.compute_merkle_root() != double

    def test_empty_block_root_is_zeros_not_an_error(self):
        """DEVIATION PIN (I-8) -- Bitcoin blocks always contain a coinbase tx;
        here an empty block yields the all-zero root instead of being rejected.
        """
        block = Block(header=make_header(), transactions=[])
        assert block.compute_merkle_root() == ZERO_ROOT
        assert block.compute_merkle_root() != hashlib.sha256(b"").hexdigest()


class TestKnownDefects:
    """Failing tests that encode the behaviour we want, not what we have."""

    @pytest.mark.xfail(
        strict=True,
        reason=(
            "I-5: Transaction.serialize() omits tx_id, so identical "
            "sender/recipient/amount transactions are indistinguishable in the "
            "Merkle tree"
        ),
    )
    def test_transactions_with_same_payload_but_distinct_tx_id_differ(self):
        """DEFECT REPRODUCTION (I-5) -- remove the xfail marker once fixed.

        Two distinct Transaction objects sharing sender/recipient/amount still
        have different ``tx_id`` values, so they are different transactions and
        MUST hash differently.  ``serialize()`` drops ``tx_id``, so today their
        leaf hashes -- and any Merkle root built from them -- collide.
        """
        tx_a = Transaction(sender="alice", recipient="bob", amount=1.5, tx_id="a" * 64)
        tx_b = Transaction(sender="alice", recipient="bob", amount=1.5, tx_id="b" * 64)

        # Sanity: these really are two different transactions.
        assert tx_a.tx_id != tx_b.tx_id

        # Desired behaviour: distinct transactions -> distinct leaf hashes.
        assert leaf(tx_a) != leaf(tx_b)

    @pytest.mark.xfail(
        strict=True,
        reason=(
            "I-5: Transaction.serialize() omits tx_id, so identical "
            "sender/recipient/amount transactions are indistinguishable in the "
            "Merkle tree"
        ),
    )
    def test_merkle_root_distinguishes_transactions_by_tx_id(self):
        """DEFECT REPRODUCTION (I-5) -- remove the xfail marker once fixed.

        Same defect surfaced at block level: swapping one transaction for a
        different transaction with an identical payload leaves the Merkle root
        unchanged, so the root does not commit to the actual transaction set.
        """
        shared = Transaction(sender="carol", recipient="dave", amount=2.0, tx_id="c" * 64)
        tx_a = Transaction(sender="alice", recipient="bob", amount=1.5, tx_id="a" * 64)
        tx_b = Transaction(sender="alice", recipient="bob", amount=1.5, tx_id="b" * 64)

        block_a = Block(header=make_header(), transactions=[shared, tx_a])
        block_b = Block(header=make_header(), transactions=[shared, tx_b])

        assert block_a.compute_merkle_root() != block_b.compute_merkle_root()

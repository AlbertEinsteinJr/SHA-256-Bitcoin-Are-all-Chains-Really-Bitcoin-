"""Robustness tests: the validator must be total, and hashing must not mutate.

Both properties below were violated by the original implementation. They are
kept separate from the correctness suite because neither is about producing
the *right* answer -- they are about not corrupting the caller's data and not
crashing on hostile input.
"""

import copy

import pytest

from src.block import BlockHeader, Transaction
from src.chain import Blockchain
from src.sha256 import double_sha256, sha256


def _two_block_chain():
    bc = Blockchain(difficulty=4)
    bc.create_genesis_block()
    bc.add_block([Transaction(sender="alice", recipient="bob", amount=1.0)])
    return bc


class TestValidatorIsTotal:
    """validate_chain() must return a bool for any input, never raise.

    A validator that crashes on attacker-controlled bytes hands an attacker a
    denial of service: the node stops instead of rejecting the bad block.
    """

    @pytest.mark.parametrize(
        "bad_value,label",
        [
            ("zz" * 32, "malformed_non_hex_characters"),
            ("0" * 63, "malformed_odd_length"),
            ("0" * 62, "malformed_too_short"),
            ("0" * 66, "malformed_too_long"),
            ("", "malformed_empty"),
            ("00 11" * 12, "malformed_embedded_spaces"),
        ],
    )
    def test_malformed_merkle_root_returns_false(self, bad_value, label):
        bc = _two_block_chain()
        bc.chain[1].header.merkle_root = bad_value
        assert bc.validate_chain() is False

    @pytest.mark.parametrize(
        "bad_value",
        ["zz" * 32, "0" * 63, "", "not-a-hash"],
    )
    def test_malformed_prev_block_hash_returns_false(self, bad_value):
        bc = _two_block_chain()
        bc.chain[1].header.prev_block_hash = bad_value
        assert bc.validate_chain() is False

    def test_malformed_genesis_prev_hash_returns_false(self):
        bc = _two_block_chain()
        bc.chain[0].header.prev_block_hash = "zz" * 32
        assert bc.validate_chain() is False

    def test_wellformed_chain_still_validates(self):
        """Positive control: the guard must not reject legitimate chains."""
        assert _two_block_chain().validate_chain() is True


class TestHashingDoesNotMutateInput:
    """sha256() must treat its argument as read-only.

    bytearray is explicitly accepted by the type guard, and padding was applied
    with ``+=`` -- which rebinds for bytes but mutates in place for bytearray.
    The first digest is still correct, so nothing in a naive suite notices; the
    damage shows up as a *different* digest on the caller's next use.
    """

    def test_bytearray_not_mutated_by_sha256(self):
        buf = bytearray(b"abc")
        sha256(buf)
        assert buf == bytearray(b"abc")

    def test_bytearray_not_mutated_by_double_sha256(self):
        buf = bytearray(b"abc")
        double_sha256(buf)
        assert buf == bytearray(b"abc")

    def test_bytearray_rehash_is_stable(self):
        """The consequence that makes this dangerous: silent digest drift."""
        buf = bytearray(b"abc")
        first = sha256(buf)
        second = sha256(buf)
        assert first == second

    def test_bytearray_matches_bytes_digest(self):
        buf = bytearray(b"hello world")
        assert sha256(buf) == sha256(b"hello world")

    @pytest.mark.parametrize("size", [0, 1, 55, 56, 63, 64, 65, 119, 120, 128])
    def test_bytearray_not_mutated_at_padding_boundaries(self, size):
        original = bytes((i * 7 + 3) & 0xFF for i in range(size))
        buf = bytearray(original)
        sha256(buf)
        assert bytes(buf) == original

    def test_header_serialize_is_not_affected_by_hashing(self):
        """compute_hash() must be repeatable on the same header."""
        header = BlockHeader(1, "00" * 32, "aa" * 32, 1231006505, 8, 0)
        assert header.compute_hash() == header.compute_hash()

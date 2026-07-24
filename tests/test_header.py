"""Tests for BlockHeader serialization, hashing, difficulty and mining."""

import struct

import pytest

from src.block import BlockHeader, mine_block
from src.sha256 import double_sha256

HEADER_SIZE = 80
NONCE_OFFSET = 76


def make_header(**overrides) -> BlockHeader:
    """Build a fully-specified header, overriding named fields."""
    fields = dict(
        version=1,
        prev_block_hash="0" * 64,
        merkle_root="a" * 64,
        timestamp=1231006505,
        difficulty_target=4,
        nonce=0,
    )
    fields.update(overrides)
    return BlockHeader(**fields)


def leading_zero_bits(hash_hex: str) -> int:
    """Count leading zero *bits* in a 64-char hex digest."""
    return 256 - int(hash_hex, 16).bit_length()


def find_nonce_with_exact_zero_bits(header: BlockHeader, bits: int, limit: int = 20000):
    """Set header.nonce so its hash has exactly `bits` leading zero bits."""
    for nonce in range(limit):
        header.nonce = nonce
        if leading_zero_bits(header.compute_hash()) == bits:
            return nonce
    raise AssertionError(f"no nonce below {limit} yields exactly {bits} zero bits")


class TestSerialization:
    """Tests for BlockHeader.serialize()."""

    def test_serialize_is_exactly_80_bytes(self):
        """4 version + 32 prev + 32 merkle + 4 time + 4 target + 4 nonce."""
        assert len(make_header().serialize()) == HEADER_SIZE

    def test_serialize_field_layout(self):
        """Each field occupies its documented offset in the 80-byte header."""
        header = make_header(version=2, timestamp=1500000000, difficulty_target=8, nonce=7)
        blob = header.serialize()
        assert blob[0:4] == struct.pack("<I", 2)
        assert blob[4:36] == bytes.fromhex("0" * 64)
        assert blob[36:68] == bytes.fromhex("a" * 64)
        assert blob[68:72] == struct.pack("<I", 1500000000)
        assert blob[72:76] == struct.pack("<I", 8)
        assert blob[76:80] == struct.pack("<I", 7)

    def test_changing_nonce_only_changes_last_four_bytes(self):
        """Bytes 76..79 are the nonce; bytes 0..75 are untouched by it."""
        a = make_header(nonce=0).serialize()
        b = make_header(nonce=123456).serialize()
        assert a[:NONCE_OFFSET] == b[:NONCE_OFFSET]
        assert a[NONCE_OFFSET:] != b[NONCE_OFFSET:]
        assert b[NONCE_OFFSET:] == struct.pack("<I", 123456)

    def test_serialize_is_deterministic(self):
        """Identical field values produce identical bytes across instances."""
        one = make_header(nonce=99)
        two = make_header(nonce=99)
        assert one is not two
        assert one.serialize() == two.serialize()
        assert one.serialize() == one.serialize()


class TestComputeHash:
    """Tests for BlockHeader.compute_hash()."""

    def test_hash_is_64_lowercase_hex_chars(self):
        digest = make_header().compute_hash()
        assert len(digest) == 64
        assert digest == digest.lower()
        assert all(c in "0123456789abcdef" for c in digest)

    def test_hash_equals_independent_double_sha256(self):
        """compute_hash() is exactly double_sha256(serialize())."""
        header = make_header(nonce=42)
        assert header.compute_hash() == double_sha256(header.serialize())

    def test_hash_is_deterministic_across_instances(self):
        assert make_header(nonce=5).compute_hash() == make_header(nonce=5).compute_hash()


class TestMeetsDifficulty:
    """Tests for BlockHeader.meets_difficulty()."""

    def test_zero_target_accepts_any_hash(self):
        """required_zeros == 0, so the empty prefix always matches."""
        for nonce in range(5):
            assert make_header(difficulty_target=0, nonce=nonce).meets_difficulty()

    def test_target_four_is_met_by_mined_header(self):
        mined = mine_block(make_header(difficulty_target=4), max_nonce=10_000)
        assert mined is not None
        assert mined.meets_difficulty()
        assert mined.compute_hash().startswith("0")

    def test_target_eight_is_met_by_mined_header(self):
        mined = mine_block(make_header(difficulty_target=8), max_nonce=100_000)
        assert mined is not None
        assert mined.meets_difficulty()
        assert mined.compute_hash().startswith("00")

    def test_high_target_not_met_by_unmined_header(self):
        """A fixed header with nonce 0 does not clear a 32-bit target."""
        header = make_header(difficulty_target=32, nonce=0)
        assert not header.compute_hash().startswith("0" * 8)
        assert not header.meets_difficulty()


class TestMineBlock:
    """Tests for mine_block()."""

    def test_max_nonce_zero_returns_none(self):
        """range(0) is empty, so the loop body never runs."""
        assert mine_block(make_header(difficulty_target=0), max_nonce=0) is None

    def test_mine_succeeds_at_low_difficulty(self):
        result = mine_block(make_header(difficulty_target=4), max_nonce=10_000)
        assert result is not None
        assert result.meets_difficulty()
        assert leading_zero_bits(result.compute_hash()) >= 4

    def test_mine_returns_none_when_budget_exhausted(self):
        """Target 32 is unreachable within 50 nonces."""
        assert mine_block(make_header(difficulty_target=32), max_nonce=50) is None


class TestDifficultyDefects:
    """Defect reproductions for difficulty semantics."""

    def test_difficulty_target_is_bit_precise(self):
        """I-2 (FIXED): difficulty is counted in bits, not rounded to nibbles.

        `difficulty_target // 4` previously rounded down, so targets of 8, 9,
        10 and 11 bits all demanded the same two leading hex zeros. The
        comparison is now bit-exact.
        """
        """
        difficulty_target is documented as leading zero *bits*.

        A hash with exactly 8 leading zero bits must satisfy target 8 and fail
        target 9. difficulty_target is part of the serialized header, so each
        target needs its own mined header.
        """
        at_eight = make_header(difficulty_target=8)
        find_nonce_with_exact_zero_bits(at_eight, 8)
        assert leading_zero_bits(at_eight.compute_hash()) == 8
        assert at_eight.meets_difficulty()

        at_nine = make_header(difficulty_target=9)
        find_nonce_with_exact_zero_bits(at_nine, 8)
        assert leading_zero_bits(at_nine.compute_hash()) == 8
        assert not at_nine.meets_difficulty()


class TestMiningDefects:
    """Defect reproductions for mine_block() side effects."""

    @pytest.mark.xfail(
        strict=True,
        reason="I-4: mine_block mutates the caller's header in place, returns the same "
        "object, and leaves a dirty nonce on failure",
    )
    def test_mine_block_does_not_mutate_caller_header(self):
        """Mining should return a new header and leave the caller's untouched."""
        header = make_header(difficulty_target=4, nonce=0)
        result = mine_block(header, max_nonce=10_000)
        assert result is not None
        assert result is not header
        assert header.nonce == 0

        failed_header = make_header(difficulty_target=32, nonce=0)
        assert mine_block(failed_header, max_nonce=5) is None
        assert failed_header.nonce == 0

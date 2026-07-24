"""
External-reference tests for the SHA-256 implementation.

Three independent sources of truth are used here:

1. NIST FIPS 180-4 published test vectors, hardcoded as literal constants.
   These are *not* computed from hashlib -- they are transcribed from the
   standard, so they prove correctness even if hashlib were also wrong.
2. Differential testing against the CPython ``hashlib`` reference over a
   wide input space (exhaustive short lengths + a seeded random sweep).
3. Targeted padding-boundary lengths that straddle the 56-mod-64 and
   64-byte block edges, where padding bugs hide.
"""

import hashlib
import random

import pytest

from src.sha256 import sha256, double_sha256

# --- NIST FIPS 180-4 published vectors (hardcoded, not computed) ---------
NIST_ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
NIST_EMPTY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
NIST_448_BIT = "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
NIST_896_BIT = "cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1"
NIST_MILLION_A = "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0"

# The one-block (448-bit) and two-block (896-bit) messages from the standard.
MSG_448_BIT = b"abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"
MSG_896_BIT = (
    b"abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmn"
    b"hijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu"
)

# Padding-critical lengths: 55/56/57 straddle the 56-mod-64 rule (a length
# of 56 mod 64 forces an entire extra block), 63/64/65 and 127/128/129
# straddle block boundaries.
PADDING_LENGTHS = [0, 1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129]


def _pattern(length: int) -> bytes:
    """Deterministic non-uniform byte pattern of exactly *length* bytes."""
    base = bytes(range(256))
    return (base * (length // 256 + 1))[:length]


class TestNISTVectors:
    """FIPS 180-4 published vectors, compared to hardcoded constants."""

    def test_nist_abc(self):
        """One-block message, 24 bits."""
        assert sha256(b"abc") == NIST_ABC

    def test_nist_empty_message(self):
        """Zero-length message -- pure padding, no data bytes."""
        assert sha256(b"") == NIST_EMPTY

    def test_nist_448_bit_message(self):
        """448-bit message: exactly at the 56-mod-64 padding boundary."""
        assert len(MSG_448_BIT) * 8 == 448
        assert sha256(MSG_448_BIT) == NIST_448_BIT

    def test_nist_896_bit_two_block_message(self):
        """896-bit message: spans two blocks and forces a third pad block."""
        assert len(MSG_896_BIT) * 8 == 896
        assert sha256(MSG_896_BIT) == NIST_896_BIT

    @pytest.mark.slow
    def test_nist_one_million_a(self):
        """One million 'a' characters -- exercises long multi-block streaming."""
        assert sha256(b"a" * 1000000) == NIST_MILLION_A

    def test_nist_vectors_are_independent_of_hashlib(self):
        """Sanity check: the hardcoded constants match the system reference."""
        assert hashlib.sha256(b"abc").hexdigest() == NIST_ABC
        assert hashlib.sha256(b"").hexdigest() == NIST_EMPTY
        assert hashlib.sha256(MSG_448_BIT).hexdigest() == NIST_448_BIT
        assert hashlib.sha256(MSG_896_BIT).hexdigest() == NIST_896_BIT


class TestDifferentialAgainstHashlib:
    """Differential testing of sha256() against the hashlib reference."""

    def test_differential_exhaustive_lengths_0_to_200(self):
        """Every input length from 0 to 200 inclusive must match hashlib."""
        for length in range(0, 201):
            data = _pattern(length)
            assert sha256(data) == hashlib.sha256(data).hexdigest(), (
                f"mismatch at length {length}"
            )

    def test_differential_seeded_random_sweep(self):
        """500 seeded-random inputs of random length 0..1000 must match hashlib."""
        rng = random.Random(0)
        for _ in range(500):
            length = rng.randrange(0, 1001)
            data = bytes(rng.randrange(256) for _ in range(length))
            assert sha256(data) == hashlib.sha256(data).hexdigest(), (
                f"mismatch on random input of length {length}: {data.hex()}"
            )

    def test_differential_all_single_bytes(self):
        """Every possible single-byte input must match hashlib."""
        for value in range(256):
            data = bytes([value])
            assert sha256(data) == hashlib.sha256(data).hexdigest(), (
                f"mismatch on byte {value:#04x}"
            )

    def test_differential_high_bit_and_null_heavy_inputs(self):
        """Inputs of all-zero and all-0xff bytes must match hashlib."""
        for length in (1, 55, 56, 64, 119, 120, 128):
            for filler in (b"\x00", b"\xff", b"\x80"):
                data = filler * length
                assert sha256(data) == hashlib.sha256(data).hexdigest(), (
                    f"mismatch on {filler.hex()} * {length}"
                )


class TestPaddingBoundaries:
    """Lengths that straddle the 56-mod-64 and 64-byte block boundaries."""

    @pytest.mark.parametrize("length", PADDING_LENGTHS)
    def test_padding_boundary_length(self, length):
        data = _pattern(length)
        assert sha256(data) == hashlib.sha256(data).hexdigest()

    @pytest.mark.parametrize("length", PADDING_LENGTHS)
    def test_padding_boundary_digest_is_64_hex_chars(self, length):
        digest = sha256(_pattern(length))
        assert len(digest) == 64
        assert all(c in "0123456789abcdef" for c in digest)

    def test_length_56_produces_extra_block(self):
        """A 56-byte input cannot fit its length field and needs a second block."""
        data = _pattern(56)
        assert sha256(data) == hashlib.sha256(data).hexdigest()
        assert sha256(data) != sha256(_pattern(55))


class TestDoubleSHA256Differential:
    """Differential testing of double_sha256() against nested hashlib."""

    @staticmethod
    def _reference(data: bytes) -> str:
        return hashlib.sha256(hashlib.sha256(data).digest()).hexdigest()

    def test_differential_double_exhaustive_lengths_0_to_100(self):
        """Every input length from 0 to 100 inclusive must match nested hashlib."""
        for length in range(0, 101):
            data = _pattern(length)
            assert double_sha256(data) == self._reference(data), (
                f"mismatch at length {length}"
            )

    def test_differential_double_seeded_random_sweep(self):
        """200 seeded-random inputs must match nested hashlib."""
        rng = random.Random(0)
        for _ in range(200):
            length = rng.randrange(0, 501)
            data = bytes(rng.randrange(256) for _ in range(length))
            assert double_sha256(data) == self._reference(data), (
                f"mismatch on random input of length {length}: {data.hex()}"
            )

    @pytest.mark.parametrize("length", PADDING_LENGTHS)
    def test_differential_double_padding_boundaries(self, length):
        data = _pattern(length)
        assert double_sha256(data) == self._reference(data)

    def test_double_differs_from_single(self):
        data = b"bitcoin"
        assert double_sha256(data) != sha256(data)


class TestInputValidation:
    """Accepted and rejected input types, as actually implemented."""

    def test_str_input_raises_type_error(self):
        with pytest.raises(TypeError):
            sha256("string")

    def test_str_input_error_names_the_type(self):
        with pytest.raises(TypeError, match="str"):
            sha256("abc")

    @pytest.mark.parametrize(
        "bad", [None, 123, 1.5, ["abc"], ("abc",), {"a": 1}, True]
    )
    def test_non_bytes_input_raises_type_error(self, bad):
        with pytest.raises(TypeError):
            sha256(bad)

    def test_bytearray_input_matches_bytes_result(self):
        expected = sha256(b"abc")
        assert sha256(bytearray(b"abc")) == expected
        assert expected == NIST_ABC

    def test_bytearray_input_is_not_mutated(self):
        """A bytearray argument is treated as read-only.

        This test previously documented the opposite: padding was applied with
        ``message += ...``, which rebinds for bytes but mutates in place for
        bytearray, leaving the caller holding a 64-byte padded buffer. The
        first digest was still correct, so only a *second* hash of the same
        buffer revealed the corruption. Fixed in _pad_message; see
        tests/test_robustness.py for the full boundary sweep.
        """
        buf = bytearray(b"abc")
        digest = sha256(buf)
        assert bytes(buf) == b"abc"
        assert len(buf) == 3
        assert digest == sha256(buf)

    def test_memoryview_input_raises_type_error(self):
        """Observed behaviour: memoryview is rejected, not accepted."""
        with pytest.raises(TypeError, match="memoryview"):
            sha256(memoryview(b"abc"))

    def test_double_sha256_rejects_str(self):
        with pytest.raises(TypeError):
            double_sha256("abc")


class TestDeterminism:
    """The same input must always produce the same digest."""

    @pytest.mark.parametrize(
        "data", [b"", b"abc", b"bitcoin", MSG_448_BIT, MSG_896_BIT, _pattern(200)]
    )
    def test_repeated_hashing_is_stable(self, data):
        assert sha256(data) == sha256(data)

    def test_no_state_leaks_between_calls(self):
        """Interleaved calls must not contaminate each other's state."""
        first = sha256(b"abc")
        sha256(b"a" * 500)
        sha256(MSG_896_BIT)
        assert sha256(b"abc") == first == NIST_ABC

    def test_double_sha256_is_deterministic(self):
        data = b"bitcoin"
        assert double_sha256(data) == double_sha256(data)

    def test_distinct_inputs_give_distinct_digests(self):
        digests = {sha256(_pattern(n)) for n in range(0, 130)}
        assert len(digests) == 130

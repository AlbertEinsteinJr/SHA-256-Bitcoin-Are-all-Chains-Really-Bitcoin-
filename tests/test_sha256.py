"""Tests for the SHA-256 implementation."""

import hashlib

from src.sha256 import double_sha256, sha256


class TestSHA256:
    """Basic correctness tests for sha256()."""

    def test_empty_string(self):
        expected = hashlib.sha256(b"").hexdigest()
        assert sha256(b"") == expected

    def test_hello_world(self):
        data = b"Hello, World!"
        expected = hashlib.sha256(data).hexdigest()
        assert sha256(data) == expected

    def test_bitcoin_string(self):
        data = b"bitcoin"
        expected = hashlib.sha256(data).hexdigest()
        assert sha256(data) == expected

    def test_single_byte(self):
        data = b"\x00"
        expected = hashlib.sha256(data).hexdigest()
        assert sha256(data) == expected


class TestDoubleSHA256:
    """Tests for double_sha256()."""

    def test_double_hash_basic(self):
        data = b"test"
        first = hashlib.sha256(data).hexdigest()
        expected = hashlib.sha256(bytes.fromhex(first)).hexdigest()
        assert double_sha256(data) == expected

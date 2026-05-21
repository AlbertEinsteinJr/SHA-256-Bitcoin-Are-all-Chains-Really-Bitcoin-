"""Smoke tests for the sha256-chain MCP server.

Invokes the tool functions directly (FastMCP's @mcp.tool decorator preserves
the underlying callable on `.fn`), so we don't need the MCP transport up.
"""

import hashlib

import pytest

pytest.importorskip("mcp")

from src.mcp_servers import sha256_chain_server as server  # noqa: E402


def _call(tool_name: str, **kwargs):
    """Resolve a FastMCP-decorated tool back to its underlying function."""
    fn = getattr(server, tool_name)
    if hasattr(fn, "fn"):
        return fn.fn(**kwargs)
    return fn(**kwargs)


def test_hash_sha256_matches_stdlib():
    assert _call("hash_sha256", data_hex="") == hashlib.sha256(b"").hexdigest()
    assert _call("hash_sha256", data_hex="68656c6c6f") == hashlib.sha256(b"hello").hexdigest()


def test_hash_double_sha256_matches_manual():
    first = hashlib.sha256(b"bitcoin").hexdigest()
    expected = hashlib.sha256(bytes.fromhex(first)).hexdigest()
    assert _call("hash_double_sha256", data_hex=b"bitcoin".hex()) == expected


def test_compute_merkle_root_empty():
    assert _call("compute_merkle_root", leaf_hashes=[]) == "0" * 64


def test_compute_merkle_root_single_returns_leaf():
    # Matches Block.compute_merkle_root semantics: with one leaf the while-loop
    # never runs, so the root is the leaf unchanged.
    h = hashlib.sha256(b"a").hexdigest()
    assert _call("compute_merkle_root", leaf_hashes=[h]) == h


def test_compute_merkle_root_two_leaves():
    h1 = hashlib.sha256(b"a").hexdigest()
    h2 = hashlib.sha256(b"b").hexdigest()
    expected = hashlib.sha256((h1 + h2).encode()).hexdigest()
    assert _call("compute_merkle_root", leaf_hashes=[h1, h2]) == expected


def test_compute_merkle_root_three_leaves_duplicates_last():
    h1 = hashlib.sha256(b"a").hexdigest()
    h2 = hashlib.sha256(b"b").hexdigest()
    h3 = hashlib.sha256(b"c").hexdigest()
    # odd count: h3 is duplicated, then two pair-hashes combine
    left = hashlib.sha256((h1 + h2).encode()).hexdigest()
    right = hashlib.sha256((h3 + h3).encode()).hexdigest()
    expected = hashlib.sha256((left + right).encode()).hexdigest()
    assert _call("compute_merkle_root", leaf_hashes=[h1, h2, h3]) == expected


def test_create_and_validate_chain():
    chain_id = _call("create_blockchain", difficulty=4)
    assert _call("validate_blockchain", chain_id=chain_id) is True

    result = _call(
        "add_block",
        chain_id=chain_id,
        txs=[{"sender": "alice", "recipient": "bob", "amount": 1.5}],
    )
    assert "hash" in result, result
    assert result["index"] == 1
    assert _call("validate_blockchain", chain_id=chain_id) is True

    info = _call("get_chain_info", chain_id=chain_id)
    assert info["length"] == 2
    assert info["latest_hash"] == result["hash"]


def test_compare_equal_chains():
    a = _call("create_blockchain", difficulty=4)
    b = _call("create_blockchain", difficulty=4)
    assert _call("compare_blockchains", chain_a_id=a, chain_b_id=b) == "equal"


def test_validate_unknown_chain_returns_false():
    assert _call("validate_blockchain", chain_id="does-not-exist") is False


def test_validate_header_round_trip():
    mined = _call(
        "mine_header",
        version=1,
        prev_hash="0" * 64,
        merkle_root="0" * 64,
        timestamp=1700000000,
        difficulty_target=4,
        max_nonce=2**16,
    )
    assert "nonce" in mined, mined
    assert _call(
        "validate_header",
        version=1,
        prev_hash="0" * 64,
        merkle_root="0" * 64,
        timestamp=1700000000,
        difficulty_target=4,
        nonce=mined["nonce"],
    ) is True

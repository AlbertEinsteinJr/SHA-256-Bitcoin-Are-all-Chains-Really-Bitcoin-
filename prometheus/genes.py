"""
Gene pool for the offline generator.

Each gene is a real, self-contained pytest function that exercises a specific
uncovered behavior documented in TEST_COVERAGE_ANALYSIS.md. The offline
generator recombines and mutates these genes; the evaluator (coverage) selects
the combinations that close the gaps. This makes the "proof of life" honest: the
fitness function genuinely drives the search over real test additions.

The live Claude generator writes equivalent tests from scratch; the rest of the
pipeline is identical.
"""

from __future__ import annotations

from typing import Dict

FILE_HEADER = '''"""Evolved by PROMETHEUS — additive regression tests (do not hand-edit)."""

import pytest

from src.sha256 import sha256, double_sha256
from src.block import Block, BlockHeader, Transaction, mine_block
from src.chain import Blockchain, compare_chains


def _hdr(merkle=""):
    return BlockHeader(
        version=1, prev_block_hash="0" * 64, merkle_root=merkle,
        timestamp=0, difficulty_target=4, nonce=0,
    )
'''

# name -> test function source
GENES: Dict[str, str] = {
    "tamper": '''
def test_prom_tampered_block_detected():
    bc = Blockchain(difficulty=4)
    bc.create_genesis_block()
    bc.add_block([Transaction(sender="a", recipient="b", amount=1.0)])
    assert bc.validate_chain() is True
    bc.chain[1].transactions[0].amount = 999.0  # tamper after mining
    assert bc.validate_chain() is False
''',
    "linkage": '''
def test_prom_broken_linkage_detected():
    bc = Blockchain(difficulty=4)
    bc.create_genesis_block()
    bc.add_block([Transaction(sender="a", recipient="b", amount=1.0)])
    bc.chain[1].header.prev_block_hash = "0" * 64
    assert bc.validate_chain() is False
''',
    "merkle_invalid": '''
def test_prom_invalid_merkle_root_detected():
    bc = Blockchain(difficulty=4)
    bc.create_genesis_block()
    bc.add_block([Transaction(sender="a", recipient="b", amount=1.0)])
    bc.chain[1].header.merkle_root = "1" * 64
    assert bc.validate_chain() is False
''',
    "compare_longer": '''
def test_prom_compare_chains_longer_wins():
    a = Blockchain(difficulty=4); a.create_genesis_block()
    a.add_block([Transaction(sender="a", recipient="b", amount=1.0)])
    a.add_block([Transaction(sender="c", recipient="d", amount=2.0)])
    b = Blockchain(difficulty=4); b.create_genesis_block()
    b.add_block([Transaction(sender="a", recipient="b", amount=1.0)])
    assert compare_chains(a, b) == "A"
    assert compare_chains(b, a) == "B"
''',
    "compare_invalid": '''
def test_prom_compare_chains_invalid_loses():
    a = Blockchain(difficulty=4); a.create_genesis_block()
    b = Blockchain(difficulty=4); b.create_genesis_block()
    b.add_block([Transaction(sender="a", recipient="b", amount=1.0)])
    b.chain[1].header.prev_block_hash = "0" * 64  # invalidate the longer chain
    assert compare_chains(a, b) == "A"
''',
    "compare_equal": '''
def test_prom_compare_chains_equal():
    a = Blockchain(difficulty=4); a.create_genesis_block()
    b = Blockchain(difficulty=4); b.create_genesis_block()
    assert compare_chains(a, b) == "equal"
''',
    "compare_both_invalid": '''
def test_prom_compare_chains_both_invalid():
    a = Blockchain(difficulty=4); a.create_genesis_block()
    a.add_block([Transaction(sender="a", recipient="b", amount=1.0)])
    a.chain[1].header.prev_block_hash = "0" * 64
    b = Blockchain(difficulty=4); b.create_genesis_block()
    b.add_block([Transaction(sender="x", recipient="y", amount=3.0)])
    b.chain[1].header.prev_block_hash = "0" * 64
    assert compare_chains(a, b) == "equal"
''',
    "genesis_tamper": '''
def test_prom_genesis_prev_hash_tamper():
    bc = Blockchain(difficulty=4)
    bc.create_genesis_block()
    bc.chain[0].header.prev_block_hash = "f" * 64  # corrupt genesis linkage
    assert bc.validate_chain() is False
''',
    "linkage_repow": '''
def test_prom_linkage_mismatch_with_valid_pow():
    bc = Blockchain(difficulty=4)
    bc.create_genesis_block()
    bc.add_block([Transaction(sender="a", recipient="b", amount=1.0)])
    bc.chain[1].header.prev_block_hash = "0" * 64  # wrong linkage...
    mine_block(bc.chain[1].header)                 # ...but re-mine so PoW passes
    assert bc.validate_chain() is False            # caught by the linkage check
''',
    "compare_a_invalid": '''
def test_prom_compare_chains_a_invalid_b_valid():
    a = Blockchain(difficulty=4); a.create_genesis_block()
    a.add_block([Transaction(sender="a", recipient="b", amount=1.0)])
    a.chain[1].header.prev_block_hash = "0" * 64  # invalidate A
    b = Blockchain(difficulty=4); b.create_genesis_block()
    assert compare_chains(a, b) == "B"
''',
    "get_index": '''
def test_prom_get_block_by_index_out_of_range():
    bc = Blockchain(difficulty=4); bc.create_genesis_block()
    assert bc.get_block_by_index(-1) is None
    assert bc.get_block_by_index(99) is None
    assert bc.get_block_by_index(0) is not None
''',
    "add_empty": '''
def test_prom_add_block_empty_chain_none():
    bc = Blockchain(difficulty=4)
    assert bc.add_block([Transaction(sender="a", recipient="b", amount=1.0)]) is None
''',
    "latest_empty": '''
def test_prom_get_latest_block_empty_none():
    bc = Blockchain(difficulty=4)
    assert bc.get_latest_block() is None
''',
    "empty_merkle": '''
def test_prom_empty_block_merkle_root():
    blk = Block(header=_hdr(), transactions=[])
    assert blk.compute_merkle_root() == "0" * 64
''',
    "odd_merkle": '''
def test_prom_odd_transactions_merkle():
    txs = [Transaction(sender=str(i), recipient="x", amount=float(i)) for i in range(3)]
    blk = Block(header=_hdr(), transactions=txs)
    root = blk.compute_merkle_root()
    assert isinstance(root, str) and len(root) == 64
''',
    "multilevel_merkle": '''
def test_prom_multilevel_merkle():
    txs = [Transaction(sender=str(i), recipient="x", amount=float(i)) for i in range(4)]
    blk = Block(header=_hdr(), transactions=txs)
    root = blk.compute_merkle_root()
    assert isinstance(root, str) and len(root) == 64
''',
    "merkle_validate": '''
def test_prom_validate_merkle_root_matches():
    blk = Block(header=_hdr(), transactions=[Transaction(sender="a", recipient="b", amount=1.0)])
    blk.header.merkle_root = blk.compute_merkle_root()
    assert blk.validate_merkle_root() is True
    blk.header.merkle_root = "0" * 64
    assert blk.validate_merkle_root() is False
''',
    "mine_fail": '''
def test_prom_mine_block_failure_none():
    header = BlockHeader(version=1, prev_block_hash="0" * 64, merkle_root="0" * 64,
                         timestamp=0, difficulty_target=255, nonce=0)
    assert mine_block(header, max_nonce=1) is None
''',
    "sha_typeerror": '''
def test_prom_sha256_typeerror():
    with pytest.raises(TypeError):
        sha256("not bytes")
''',
    "sha_nist": '''
def test_prom_sha256_nist_abc():
    assert sha256(b"abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
''',
    "double_sha": '''
def test_prom_double_sha256_len():
    d = double_sha256(b"abc")
    assert isinstance(d, str) and len(d) == 64
''',
}


def assemble(gene_names) -> str:
    """Assemble a runnable test file from a selection of gene names."""
    ordered = [g for g in GENES if g in set(gene_names)]
    body = "".join(GENES[g] for g in ordered)
    return FILE_HEADER + body + "\n"

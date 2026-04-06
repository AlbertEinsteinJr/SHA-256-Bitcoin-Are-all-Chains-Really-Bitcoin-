# Test Coverage Analysis

## Current State

| Module | Statements | Missed | Coverage |
|--------|-----------|--------|----------|
| `src/sha256.py` | 46 | 1 | **98%** |
| `src/block.py` | 57 | 9 | **84%** |
| `src/chain.py` | 72 | 23 | **68%** |
| **TOTAL** | **175** | **33** | **81%** |

**16 tests passing** across 3 test files.

---

## Gap Analysis & Recommendations

### 1. `src/sha256.py` — 98% covered (1 line missed)

**Missing:** Line 76 — the `TypeError` raised when non-bytes input is passed.

**Recommended tests:**
- **Input validation:** Test that `sha256("string")` raises `TypeError`.
- **Large inputs:** Hash data >64 bytes to exercise multi-block padding.
- **Exact boundary inputs:** Hash data of exactly 55, 56, 64, and 119 bytes (padding edge cases).
- **Known test vectors:** Add NIST FIPS 180-4 test vectors (e.g., `"abc"` → `ba7816bf...`).

**Priority: LOW** — Coverage is already high, but adding NIST vectors would strengthen correctness assurance.

---

### 2. `src/block.py` — 84% covered (9 lines missed)

**Missing lines:**
- **Line 79:** `Block.compute_merkle_root()` empty-transactions branch (`return "0" * 64`)
- **Lines 84-90:** Merkle tree computation with odd number of transactions and multi-level tree
- **Line 119:** `mine_block()` returning `None` when max_nonce is exhausted

**Recommended tests:**
- **Empty block Merkle root:** Create a block with zero transactions and verify Merkle root is all zeros.
- **Single transaction Merkle root:** Verify Merkle root matches direct hash of the one transaction.
- **Odd-count transactions:** Test with 3 transactions to exercise the duplicate-last-hash path.
- **Multi-level Merkle tree:** Test with 4+ transactions to exercise the full tree-building loop.
- **Merkle root validation:** Test `validate_merkle_root()` for both matching and mismatched roots.
- **Mining failure:** Set `max_nonce=0` or use impossibly high difficulty to test `mine_block()` returning `None`.
- **Block header serialization determinism:** Same inputs should always produce same serialized bytes.

**Priority: HIGH** — The Merkle tree is critical for transaction integrity and has the most untested logic paths.

---

### 3. `src/chain.py` — 68% covered (23 lines missed)

**Missing lines:**
- **Line 53:** `add_block()` returning `None` for empty chain
- **Line 71:** Mining failure during `add_block()`
- **Lines 92-117:** Most of `validate_chain()` — tampered blocks, broken linkage, invalid Merkle roots
- **Line 125:** `get_block_by_index()` out-of-range path
- **Lines 139-154:** Entire `compare_chains()` function

**Recommended tests:**

#### Chain Validation (Critical)
- **Tampered block detection:** Modify a transaction in a mined block and verify `validate_chain()` returns `False`.
- **Broken chain linkage:** Alter `prev_block_hash` of a block and verify validation fails.
- **Invalid proof-of-work:** Set a block's nonce to an invalid value and verify detection.
- **Invalid Merkle root:** Alter `merkle_root` in a header without changing transactions.

#### Chain Operations
- **`add_block()` on empty chain:** Should return `None`.
- **`add_block()` mining failure:** Use extremely high difficulty to trigger `None` return.
- **`get_block_by_index()` out of range:** Test negative index and index >= chain length.
- **`get_latest_block()` on empty chain:** Should return `None`.

#### Chain Comparison (`compare_chains()`)
- **Longer valid chain wins:** Chain A has 3 blocks, Chain B has 2 — A should win.
- **Invalid chain loses:** One valid, one invalid — valid chain wins regardless of length.
- **Equal length chains:** Should return `"equal"`.
- **Both invalid chains:** Should return `"equal"`.

**Priority: CRITICAL** — Chain validation is the core security mechanism. At 68%, the most important code paths (tamper detection, chain comparison) are completely untested.

---

## Summary of Priorities

| Priority | Area | Current Coverage | Target |
|----------|------|-----------------|--------|
| **CRITICAL** | Chain validation & comparison | 68% | 95%+ |
| **HIGH** | Merkle tree computation | 84% | 95%+ |
| **MEDIUM** | Mining edge cases | 84% | 90%+ |
| **LOW** | SHA-256 edge cases & NIST vectors | 98% | 100% |

## Additional Testing Recommendations

### Missing Test Categories (not just coverage gaps)

1. **Security / Adversarial Tests**
   - Double-spend scenario simulation
   - Chain reorganization after fork
   - Blocks with manipulated timestamps

2. **Performance / Stress Tests**
   - Mining at progressively higher difficulties
   - Chain validation with 100+ blocks
   - Merkle tree with 1000+ transactions

3. **Serialization Round-Trip Tests**
   - Ensure block headers can be serialized and re-hashed deterministically
   - Test with maximum/minimum integer values for version, timestamp, nonce

4. **Integration Tests**
   - Full workflow: create chain → add multiple blocks → validate → compare with fork
   - Simulate two competing miners building parallel chains

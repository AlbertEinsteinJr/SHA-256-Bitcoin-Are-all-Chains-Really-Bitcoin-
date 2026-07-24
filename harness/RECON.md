# RECON — observed ground truth

Everything below was **executed and read**, not inferred. Per §P2 the emphasis is on
what *contradicted* prior assumptions.

## Environment

```
Python 3.11.15
pytest  9.1.1          <- NOT PRESENT until installed during recon
hypothesis             <- absent; deliberately NOT added (see decision below)
```

## Contradiction 1 — the suite could not run at all

`TEST_COVERAGE_ANALYSIS.md` reports "16 tests passing" and a coverage table, but
`pytest` was **not installed** in this environment. Those numbers were not
reproducible as written. Resolved by `pip install -r requirements.txt`.

## Contradiction 2 — the published coverage numbers are wrong

`TEST_COVERAGE_ANALYSIS.md` reports statement coverage only and labels it "Coverage".
Measured with `--cov-branch`:

| Module | Doc claims | Actual (branch) | Delta |
|---|---|---|---|
| `src/sha256.py` | 98% | **96%** | −2 |
| `src/block.py` | 84% | **76%** | −8 |
| `src/chain.py` | 68% | **60%** | −8 |
| **TOTAL** | **81%** | **74%** | **−7** |

```
Name              Stmts   Miss Branch BrPart  Cover   Missing
src/block.py         57      9     14      4    76%   60->exit, 79, 84-90, 119
src/chain.py         72     23     32      7    60%   40->43, 53, 71, 92, 99, 103, 109, 115-117, 125, 139-154
src/sha256.py        46      1     10      1    96%   76
TOTAL               175     33     56     12    74%
16 passed in 0.14s
```

Note `chain.py 40->43` — that partial branch is exactly defect I-3 (genesis appended
even when mining fails). The coverage tool was already pointing at the bug.

## Contradiction 3 — the tests had no external oracle, but the code is correct anyway

The suite validates the implementation against itself. Supplying `hashlib` as a
differential oracle for the first time:

```
differential vs hashlib: mismatches = 0 / 312 inputs
  lengths 0,1,55,56,63,64,65,119,120,127,128,200 + 300 random lengths 0..300
NIST 'abc' = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  (exact)
```

So SHA-256 is **correct**. This reframes the work: PC-1/PC-2 are *regression locks*
protecting Stage 4, not a bug hunt.

## Confirmed defects (reproduced, not read)

```
chain.difficulty            = 8
[baseline] valid            = True
[naive tamper] valid        = False   (merkle stale -> caught)
[tamper+merkle] valid       = False   (PoW stale -> caught)
[FORGED difficulty=0] valid = True    <-- I-1, full PoW bypass
   forged amount            = 999999.0
   forged block hash        = f583330098b9f143573c0ef606456d1b9e6ee58431fd1d158333ebb481edb624
   leading zeros            = 0       (chain policy demands 8 bits)

difficulty_target 8,9,10,11 -> required hex zeros 2,2,2,2   <-- I-2 silent quantization
mine_block: on failure leaves caller's nonce = 4            <-- I-4 side effect
            returns the SAME object it was given            <-- I-4 not a pure function
```

The two middle rows are the important ones: the Merkle and PoW checks *do* catch a
naive tamper, which isolates `difficulty_target` as the precise attack vector rather
than a vague weakness.

## Performance ground truth

```
difficulty_target= 8 (2 hex zeros):   867 nonces in 0.36s ->  2386 nonces/sec
difficulty_target=12 (3 hex zeros):  8011 nonces in 3.30s ->  2427 nonces/sec

per-nonce cost (N=2000):
  serialize() only     :   0.6 us   ( 0.2%)
  serialize+double_sha : 410.3 us
  hashing dominates    :  99.8%
```

Header layout verified empirically:

```
serialize length = 80 bytes -> padded 128 bytes = 2 compression blocks
bytes changing with nonce = [76, 77, 78, 79]
block1 (bytes 0-63) identical across nonce = True
second SHA input = 1 block
=> 3 compression blocks per nonce; midstate makes it 2
```

**This killed a planned optimization before it was written.** Caching the serialized
header prefix had a hard ceiling of 0.2% and was dropped. All optimization effort
belongs inside `sha256.py`'s compression loop.

## Decision recorded during recon

`hypothesis` is **not** added. `pip` works, so it *could* be installed, but the repo's
dependency footprint is deliberately two packages, and seeded `random` loops give
determinism plus reproducible failures without a new dependency. The differential
oracle already supplies broad input coverage. Property-style tests use seeded loops.

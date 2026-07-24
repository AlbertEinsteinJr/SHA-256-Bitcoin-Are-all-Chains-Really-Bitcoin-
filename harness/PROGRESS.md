# PROGRESS — append only

## [Stage 1] U-1..U-5 · VERIFIED
attempted: five parallel agents, one test file each, disjoint write surfaces
observed:  branch coverage 74% -> 99% (block.py 100%, chain.py 98%, sha256.py 100%)
evidence:  `pytest tests/ -q` -> 167 passed, 7 xfailed, exit 0
commit:    e50f284
next:      capture golden + bench baselines before touching src

## [Barrier B1] golden + bench frozen against pristine src · VERIFIED
attempted: freeze the two gates that make Stages 3 and 4 separable
observed:  42 Layer A digests captured; gate self-test proves it detects a
           flipped nibble; bench baseline stable across two consecutive runs
evidence:  `golden_check.py --self-test` -> "SELF-TEST PASSED"
commit:    c24905c
next:      Stage 3 fixes, cheapest-and-provably-inert first

## [Stage 3a] I-10, I-9, I-7 · VERIFIED
attempted: non-mutating _pad_message; BlockHeader.is_well_formed; parenthesize `ch`
observed:  194 passed, 7 xfailed; golden 42/42 byte-identical
evidence:  `golden_check.py` -> "OK: 42 Layer A digests byte-identical"
           -- this is the *proof* the precedence analysis was right, not an assertion
commit:    887ecec
next:      the critical security fix

## [Stage 3b] I-1 (CRITICAL), I-2 · VERIFIED
attempted: bind PoW check to chain policy; make difficulty bit-exact
observed:  forged chain accepted: True -> False; pristine chain still True;
           golden 42/42 identical, so no mined nonce moved
evidence:  196 passed, 5 xfailed. Both strict xfails XPASSED, which pytest
           reports as FAILED -- forcing marker removal. Mechanism worked.
commit:    23935c6
next:      Stage 4

## [Stage 4] O-3 midstate (+ I-4 purity) · VERIFIED
attempted: extract _compress, add sha256_midstate, rewrite miner around them
observed:  old 2485 attempts/s -> new 3777 attempts/s = 1.52x (PC-7 needs 1.40x)
           golden 42/42 identical; 197 passed, 4 xfailed
evidence:  `bench.py --compare` -> "speedup 1.52x ... PASS"
           First --compare showed NO speedup: the dsha_header workload measures
           compute_hash(), which never touches the midstate path. The benchmark
           was measuring the wrong thing; fixed rather than reported.
commit:    a68d3b6
next:      remaining defects I-3, I-5, I-6; mutation testing (PC-4)

---

## §7.2 REPORT

```
PROVEN   PC-1  NIST FIPS 180-4 vectors  -- pytest tests/test_sha256_vectors.py -q, exit 0
PROVEN   PC-2  differential vs hashlib  -- 0 mismatches over lengths 0..200 + 500 seeded
                                           random + all padding boundaries
PROVEN   PC-3  branch coverage 99%      -- pytest --cov=src --cov-branch: block 100%,
                                           chain 98%, sha256 100% (floor was 95%)
PROVEN   PC-5  PoW bypass closed        -- forged chain: True -> False; pristine: True
PROVEN   PC-6  digests unmoved          -- golden_check.py: 42/42 byte-identical across
                                           every Stage 3 and Stage 4 commit
PROVEN   PC-7  mining 1.52x             -- bench.py --compare, min-of-9, in-run ratio
PROVEN   PC-8  validator is total       -- 10 malformed-header variants return False,
                                           previously raised ValueError
PROVEN   PC-9  no argument mutation     -- bytearray intact across 10 padding boundaries

FAILED   (none)

NOT DONE PC-4  mutation testing         -- harness/mutate.py not written. Coverage and a
                                           differential oracle are necessary but not
                                           sufficient; until mutants are seeded and killed,
                                           "the tests actually bite" is CLAIMED, not PROVEN.
NOT DONE I-3   genesis appended unmined  -- xfail(strict) held, reproduction in place
NOT DONE I-5   tx_id absent from Merkle  -- xfail(strict) x2 held. Deliberately deferred:
                                           tx_id derives from time.time(), so committing to
                                           it without first making it deterministic would
                                           make every Merkle root, block hash and mined
                                           nonce non-reproducible and destroy golden Layer B.
                                           Needs the two-part fix (kill the clock, add an
                                           explicit nonce field) -- not a one-liner.
NOT DONE I-6   timestamp monotonicity    -- xfail(strict) held, reproduction in place
NOT DONE I-8   Merkle deviation writeup  -- pinned by tests; DEVIATIONS.md not written

NEXT     Write harness/mutate.py and close PC-4; then I-3 and I-6 (small); then I-5
         behind its determinism prerequisite, re-baselining golden Layer B after it.

NEED     Nothing blocking. One decision when I-5 is taken up: should validate_chain also
         enforce tx.tx_id == tx.compute_tx_id()? Bitcoin derives txids and never accepts
         declared ones. It is one line, but it is beyond the proven defect, so it is the
         operator's call rather than mine.
```

Every remaining defect is held by an `xfail(strict=True)` reproduction. Because
strict mode turns an unexpected pass into a failure, none of them can be fixed
silently or forgotten quietly -- the suite will demand the marker be removed.

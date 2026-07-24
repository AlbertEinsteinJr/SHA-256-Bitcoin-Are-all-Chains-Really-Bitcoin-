#!/usr/bin/env python3
"""
Benchmark gate (harness §P6, tier T3).

Measures FIXED WORK, never "time to mine a block". Mining time is geometric
with a coefficient of variation near 100%, so a genuine 1.5x speedup is
invisible underneath it. Every workload here does a predetermined number of
hash operations.

Reports min-of-N (the least noisy estimator for "how fast can this machine
do this") plus the observed spread, and gates any comparison on that spread:
a change is only reported as real when it exceeds a 10% floor and 3x the
measured noise (capped at 25%, so one outlier cannot widen the gate without
limit). Anything smaller is unprovable on this hardware and must not be
claimed as a speedup (§7.2 -- proven vs inferred).

Note: gc is deliberately NOT disabled. It was measured to make the spread
worse (7.3% vs 3.3%), not better.

Usage:
    python3 harness/bench.py --save        # write baseline (refuses overwrite)
    python3 harness/bench.py               # measure and print
    python3 harness/bench.py --compare     # measure vs baseline, exit 1 on regression
"""
from __future__ import annotations

import json
import os
import platform
import struct
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.block import BlockHeader  # noqa: E402
from src.sha256 import double_sha256, sha256  # noqa: E402

BASELINE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bench_baseline.json")

WARMUP = 3
REPS = 9
NOISE_FLOOR = 0.10  # never claim a change smaller than 10%
GATE_CAP = 0.25     # a single outlier must not widen the gate without limit

_PAYLOAD_32 = bytes((i * 7 + 11) & 0xFF for i in range(32))
_PAYLOAD_80 = bytes((i * 13 + 5) & 0xFF for i in range(80))


def _w_sha256_1blk(n=2000):
    for _ in range(n):
        sha256(_PAYLOAD_32)


def _w_sha256_2blk(n=1500):
    for _ in range(n):
        sha256(_PAYLOAD_80)


def _w_dsha_header(n=1500):
    """The mining inner loop: re-hash an 80-byte header over incrementing nonces."""
    h = BlockHeader(1, "00" * 32, "aa" * 32, 1231006505, 8, 0)
    for nonce in range(n):
        h.nonce = nonce
        h.compute_hash()


def _w_double_sha256(n=1500):
    for _ in range(n):
        double_sha256(_PAYLOAD_80)


WORKLOADS = {
    "sha256_1blk": (_w_sha256_1blk, 2000),
    "sha256_2blk": (_w_sha256_2blk, 1500),
    "dsha_header": (_w_dsha_header, 1500),
    "double_sha256": (_w_double_sha256, 1500),
}


def measure(fn, ops: int) -> dict:
    for _ in range(WARMUP):
        fn()
    times = []
    for _ in range(REPS):
        t0 = time.perf_counter_ns()
        fn()
        times.append(time.perf_counter_ns() - t0)
    best, worst = min(times), max(times)
    return {
        "us_per_op": best / ops / 1000.0,
        "ops_per_sec": ops / (best / 1e9),
        "spread": (worst - best) / best,
    }


def run() -> dict:
    results = {}
    for name, (fn, ops) in WORKLOADS.items():
        results[name] = measure(fn, ops)
        r = results[name]
        print(f"  {name:16s} {r['us_per_op']:8.2f} us/op  "
              f"{r['ops_per_sec']:10.0f} ops/s  spread {r['spread'] * 100:4.1f}%")
    return {
        "python": platform.python_version(),
        "platform": platform.platform(),
        "results": results,
    }


def save(data: dict) -> int:
    if os.path.exists(BASELINE_PATH):
        sys.exit("REFUSED: bench_baseline.json exists. A silent rebaseline is how "
                 "a regression gets laundered. Delete it deliberately if you mean to.")
    with open(BASELINE_PATH, "w") as fh:
        json.dump(data, fh, indent=2, sort_keys=True)
        fh.write("\n")
    print(f"\nbaseline written -> {BASELINE_PATH}")
    return 0


def compare(data: dict) -> int:
    if not os.path.exists(BASELINE_PATH):
        sys.exit(f"FAIL: no baseline at {BASELINE_PATH}. Run --save first.")
    with open(BASELINE_PATH) as fh:
        base = json.load(fh)["results"]

    print("\n  workload           baseline      current     ratio   verdict")
    regressed = False
    for name, cur in data["results"].items():
        if name not in base:
            print(f"  {name:16s} (new workload, no baseline)")
            continue
        b, c = base[name]["ops_per_sec"], cur["ops_per_sec"]
        ratio = c / b
        noisiest = max(base[name]["spread"], cur["spread"])
        gate = max(NOISE_FLOOR, min(3 * noisiest, GATE_CAP))
        if abs(ratio - 1) <= gate:
            verdict = f"unchanged (within {gate * 100:.0f}% gate)"
        elif ratio > 1:
            verdict = f"FASTER {ratio:.2f}x"
        else:
            verdict = f"REGRESSION {ratio:.2f}x"
            regressed = True
        print(f"  {name:16s} {b:10.0f}  {c:10.0f}   {ratio:5.2f}x   {verdict}")

    if regressed:
        print("\nFAIL: at least one workload regressed beyond the noise gate.")
        return 1
    print("\nOK: no regression beyond the noise gate.")
    return 0


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    print(f"bench: warmup={WARMUP} reps={REPS} (min-of-{REPS} reported)")
    data = run()
    if arg == "--save":
        sys.exit(save(data))
    if arg == "--compare":
        sys.exit(compare(data))
    sys.exit(0)

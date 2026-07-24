#!/usr/bin/env python3
"""
Golden digest gate (harness §P6, tier T4).

Layer A freezes hash outputs that MUST NOT change for the entire life of this
run.  Every Stage 3 fix and every Stage 4 optimization is gated on it: if a
digest moves, behaviour moved, and that is a regression rather than a
trade-off.

Layer A deliberately depends on `src.sha256` ONLY.  Nothing here is routed
through Transaction, Block or Blockchain, because fixing I-5 (tx_id absent
from the Merkle commitment) changes every Merkle root and header hash.  Had
those values been baked into Layer A, the natural response would be to
recapture the file -- silently destroying the only gate that protects the
optimization stage.  Header hashes are therefore built from a literal 80-byte
blob assembled with struct, not from a BlockHeader instance.

Usage:
    python3 harness/golden_check.py              # verify, exit 1 on mismatch
    python3 harness/golden_check.py --capture    # write golden.json (Stage 0 only)
    python3 harness/golden_check.py --self-test  # prove the gate can actually fail
"""
from __future__ import annotations

import json
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.sha256 import double_sha256, sha256  # noqa: E402

GOLDEN_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "golden.json")

# Literal messages. Lengths straddle the 56-mod-64 and 64-byte block boundaries,
# which is where padding bugs live.
_MESSAGES: list[tuple[str, bytes]] = [
    ("empty", b""),
    ("abc", b"abc"),
    ("bitcoin", b"bitcoin"),
    ("null_byte", b"\x00"),
    ("high_bits", bytes(range(256))),
    ("nist_448bit", b"abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
]
_MESSAGES += [(f"len_{n}", bytes((i * 7 + 11) & 0xFF for i in range(n)))
              for n in (54, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129, 200)]


def _header_blob(version: int, prev: str, merkle: str,
                 timestamp: int, difficulty: int, nonce: int) -> bytes:
    """Assemble an 80-byte block header from literals, without src.block."""
    return (struct.pack("<I", version)
            + bytes.fromhex(prev)
            + bytes.fromhex(merkle)
            + struct.pack("<I", timestamp)
            + struct.pack("<I", difficulty)
            + struct.pack("<I", nonce))


_HEADERS: list[tuple[str, tuple]] = [
    ("header_genesis_like", (1, "00" * 32, "aa" * 32, 1231006505, 8, 0)),
    ("header_nonce_1", (1, "00" * 32, "aa" * 32, 1231006505, 8, 1)),
    ("header_big_nonce", (1, "ff" * 32, "cd" * 32, 1700000000, 12, 4294967295)),
    ("header_zero_fields", (0, "00" * 32, "00" * 32, 0, 0, 0)),
]


def compute_layer_a() -> dict:
    out: dict[str, str] = {}
    for label, msg in _MESSAGES:
        out[f"sha256:{label}"] = sha256(msg)
        out[f"double_sha256:{label}"] = double_sha256(msg)
    for label, fields in _HEADERS:
        blob = _header_blob(*fields)
        assert len(blob) == 80, f"{label}: header blob is {len(blob)} bytes, expected 80"
        out[f"header_hash:{label}"] = double_sha256(blob)
    return out


def _load() -> dict:
    if not os.path.exists(GOLDEN_PATH):
        sys.exit(f"FAIL: {GOLDEN_PATH} does not exist. Run --capture first.")
    with open(GOLDEN_PATH) as fh:
        return json.load(fh)


def capture() -> int:
    if os.path.exists(GOLDEN_PATH):
        sys.exit("REFUSED: golden.json already exists. A silent recapture would "
                 "destroy the gate. Delete it deliberately if you truly mean to.")
    data = {"layer_a": compute_layer_a()}
    with open(GOLDEN_PATH, "w") as fh:
        json.dump(data, fh, indent=2, sort_keys=True)
        fh.write("\n")
    print(f"captured {len(data['layer_a'])} Layer A digests -> {GOLDEN_PATH}")
    return 0


def check(expected: dict | None = None) -> int:
    golden = expected if expected is not None else _load()["layer_a"]
    actual = compute_layer_a()

    missing = sorted(set(golden) - set(actual))
    added = sorted(set(actual) - set(golden))
    drift = [(k, golden[k], actual[k]) for k in sorted(set(golden) & set(actual))
             if golden[k] != actual[k]]

    for key in missing:
        print(f"MISSING  {key}")
    for key in added:
        print(f"NEW      {key}  (not in golden; add deliberately)")
    for key, exp, got in drift:
        print(f"DRIFT    {key}\n  expected {exp}\n  actual   {got}")

    if drift or missing:
        print(f"\nFAIL: {len(drift)} digest(s) changed, {len(missing)} missing.")
        print("A digest change is a behaviour regression, not a trade-off. Revert.")
        return 1
    print(f"OK: {len(golden)} Layer A digests byte-identical.")
    return 0


def self_test() -> int:
    """A gate nobody has seen fail is not a gate. Prove it detects a flipped nibble."""
    golden = dict(_load()["layer_a"])
    key = "sha256:abc"
    original = golden[key]
    golden[key] = ("0" if original[0] != "0" else "1") + original[1:]
    print(f"self-test: corrupting {key} and expecting detection...")
    rc = check(golden)
    if rc == 1:
        print("SELF-TEST PASSED: the gate detects corruption.")
        return 0
    print("SELF-TEST FAILED: corruption went undetected. The gate is worthless.")
    return 1


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    if arg == "--capture":
        sys.exit(capture())
    if arg == "--self-test":
        sys.exit(self_test())
    sys.exit(check())

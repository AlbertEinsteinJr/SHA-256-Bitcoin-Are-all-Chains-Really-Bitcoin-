# Master Project Inventory

> A general "what we got going on" list. Generated 2026-06-01.
>
> **Scope note:** This was compiled from the cloud workspace, which has access to
> the GitHub account `AlbertEinsteinJr` and the one repository cloned into this
> session. It does **not** have access to your local/physical computer — anything
> living only on your machine (and not pushed to GitHub) isn't visible here. If
> you want those tracked too, push them or paste a folder listing and I'll fold
> them in.

---

## Account snapshot

| | |
|---|---|
| **GitHub user** | `AlbertEinsteinJr` (Albert Einstein — Version 2.8) |
| **Public repos** | 1 |
| **Active repository** | `SHA-256-Bitcoin-Are-all-Chains-Really-Bitcoin-` |
| **Open pull requests** | 1 (PR #1, draft) |

The single repository currently holds **two separate project streams** living on
different branches. They're listed below as distinct projects because they are
unrelated in purpose.

---

## Project 1 — SHA-256 / Bitcoin Blockchain (educational)

**Repo:** `SHA-256-Bitcoin-Are-all-Chains-Really-Bitcoin-`
**Primary branch / code:** `claude/analyze-test-coverage-m4fim`
**Language:** Python 3 (stdlib only for the implementation; `pytest` for tests)

### Definition
A from-scratch, educational implementation of the cryptographic machinery behind
Bitcoin. The guiding question framed in the repo description is: *"SHA-256 is the
base of Bitcoin. All errors on Bitcoin have been human errors, not the program —
correct?"* The code is meant to demonstrate, in pure readable Python, **why**
that claim holds: that the algorithm itself is deterministic and sound, and that
failures come from misuse, not the math.

### What's built
| Module | Purpose |
|--------|---------|
| `src/sha256.py` | Pure-Python SHA-256 per FIPS 180-4 (padding, message schedule, compression rounds, constants). Plus `double_sha256()` — the `SHA256(SHA256(x))` used by Bitcoin. |
| `src/block.py` | `BlockHeader`, `Transaction`, and `Block` data structures; Merkle-root computation; proof-of-work difficulty check; `mine_block()` nonce search. |
| `src/chain.py` | `Blockchain` class: genesis block, add/mine blocks, full chain validation (PoW + linkage + Merkle), and `compare_chains()` (longest-valid-chain-wins rule). |
| `tests/` | 16 passing tests across `test_sha256.py`, `test_block.py`, `test_chain.py`. |
| `TEST_COVERAGE_ANALYSIS.md` | Coverage report (81% total) with a prioritized gap analysis. |

### Status
- **Working & tested** — 16 tests pass, ~81% coverage.
- **Known gaps (from the coverage doc):**
  - CRITICAL — chain validation & `compare_chains()` are largely untested (chain.py at 68%).
  - HIGH — Merkle tree paths (odd counts, multi-level) untested (block.py at 84%).
  - LOW — add NIST FIPS 180-4 test vectors to sha256.py (98%).

### Likely next steps
Close the coverage gaps (tamper-detection, fork/reorg, double-spend simulations),
add NIST known-answer vectors, and consider a small CLI or demo script that
builds a chain end-to-end.

---

## Project 2 — Claude Computer-Use Tool Reference & Demo

**Repo:** `SHA-256-Bitcoin-Are-all-Chains-Really-Bitcoin-` (same repo, different branch)
**Branch:** `claude/computer-use-tool-NettW`
**Pull request:** [#1 — *Add computer use tool reference doc and agent-loop demo*](https://github.com/AlbertEinsteinJr/SHA-256-Bitcoin-Are-all-Chains-Really-Bitcoin-/pull/1) — **open, draft**
**Language:** Python 3 + Markdown

### Definition
A reference/scaffolding effort for Anthropic's **computer-use tool**: notes plus a
runnable agent-loop skeleton you can drop a real sandbox driver into. Unrelated to
the Bitcoin code — it's riding in the same repo as a parallel experiment.

### What's in it
| File | Purpose |
|------|---------|
| `COMPUTER_USE_TOOL.md` | Reference notes: tool versions (`computer_20251124`, `computer_20250124`), beta headers, parameters, actions (basic / enhanced / zoom), modifier-key behavior, prompting tips, extended-thinking effort settings, security guidance. |
| `examples/computer_use_demo.py` | Agent-loop skeleton (`claude-opus-4-7`, `computer-use-2025-11-24` beta header). Wires up `computer`, `bash`, and `text_editor` tools and dispatches `tool_use` blocks to stub handlers — a drop-in target for a real Xvfb/Docker sandbox. |

### Status
- `py_compile` passes on the demo.
- **Open items** (from PR #1): real `ANTHROPIC_API_KEY` end-to-end run not yet
  done; stub `handle_computer_action` not yet replaced with a real
  pyautogui/Xvfb-backed handler.
- PR is still a **draft** — not merged.

### Note
This branch targets `claude/analyze-test-coverage-m4fim` as its base, not a `main`
branch. Worth deciding whether this belongs in its own repository long-term, since
it has nothing to do with the Bitcoin project.

---

## Project 3 — Project Inventory (this document)

**Repo:** `SHA-256-Bitcoin-Are-all-Chains-Really-Bitcoin-`
**Branch:** `claude/project-inventory-list-LMpTO`

### Definition
This master list — a living index of everything in motion. Lives here so it stays
in version control next to the work it describes.

---

## Branch map (the repo's "active fronts")

| Branch | Project | State |
|--------|---------|-------|
| `claude/analyze-test-coverage-m4fim` | Bitcoin/SHA-256 code + coverage analysis | Main code line |
| `claude/computer-use-tool-NettW` | Computer-use reference & demo | Open draft PR #1 |
| `claude/project-inventory-list-LMpTO` | This inventory | In progress |

---

## Open questions / decisions for you

1. **Is there more on your local machine?** This list only covers what's on
   GitHub. If you have other projects/folders locally, push them or send a
   listing and I'll add them.
2. **Should the computer-use work move to its own repo?** It's unrelated to the
   Bitcoin project and currently shares the repo.
3. **Which is the priority?** Closing Bitcoin test-coverage gaps, or finishing the
   computer-use demo (real sandbox handler + live API run)?

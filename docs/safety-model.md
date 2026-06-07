# PROMETHEUS — Safety Model

A self-improving system that can control the OS and modify its own scaffolding is
only safe if the brakes are mechanisms, not prose. This document maps each known
failure mode to the concrete mitigation implemented in the engine.

> Prompts alone cannot make you safe (CLAUDE.md §1). The real stops are scoped
> credentials, the forced `APPROVED-<ACTION>-<YYYYMMDD>` token, the sandbox
> chokepoint, and the fenced meta-loop. If a destructive capability is available
> but its gate is missing, the engine STOPS.

## Threat model → mitigation

| Failure mode | What it looks like here | Mitigation (where) |
|--------------|-------------------------|--------------------|
| **Reward hacking** | A variant raises the eval score by deleting assertions / weakening tests instead of adding real coverage. | `Evaluator.structural_strength` + promotion gate reject score-up-with-zero-assertions and flag it (`engine.py::_is_promotable`). Suite-green is required (regression gate). |
| **Specification gaming** | Optimizing the proxy (coverage %) rather than the goal (real behavior tested). | Binary, behavior-specific assertions (`eval/blockchain-core.eval.json`) plus the structural guard; coverage alone never promotes. |
| **Eval saturation (weak judge)** | Everything passes, so "improvement" is meaningless. | Treated as a defect: the loop **flags** saturation and stops; hardening the scoring requires `APPROVED-EVAL-<date>` (CLAUDE.md §3). |
| **Goal misgeneralization / scope creep** | The loop tries to act on production or irreversibly. | Production targets are HARD-GATED behind the token (`safety.py::require_approval`, `engine.py` pre-flight). Bright line in CLAUDE.md §4. |
| **Self-modification of the brakes** | The improver edits the evaluator's scoring intent or the safety modules to make itself "better." | The meta-loop is **fenced**: `meta.py::assert_edit_allowed` refuses + audits any edit to `evaluator.py`, `safety.py`, `audit.py`, `CLAUDE.md`. |
| **Tampered constitution / removed gate** | Safety code deleted or emptied. | `safety.py::assert_integrity` refuses to run if any protected file is missing/empty (startup self-check). |
| **OS-control escape** | Writes outside the sandbox; destructive shell; network exfiltration. | Single chokepoint (`sandbox.py`): isolated git worktree, write-confinement, command allowlist, forbidden-fragment refusals (`rm -rf`, force-push, `curl`/`wget`, `DROP`, `sudo`). Dry-run is the default. |
| **Runaway resource use** | Infinite loops, token/$ blowups, API hammering. | `CapTracker` enforces iteration, wallclock, spend, and per-minute tool-call caps (`safety.py`, `config.py::Caps`). |
| **Irreversible action with no off-switch** | Need to halt a running loop now. | `KILL` switch (`cli.py kill`) writes a flag the loop checks every iteration (`safety.py::check_alive`). |
| **Silent / unauditable behavior** | No record of what the agent did or was refused. | Append-only audit log (`audit.py`) — write-only API, no update/delete; every blocked attempt is recorded. Full JSONL traces (`telemetry.py`) enable deterministic replay. |

## Rollout discipline (for anything user-visible)
**shadow → canary → full.** New behavior runs in shadow (analyze, don't act), then is enabled
for a narrow cohort behind a flag, then expanded only after low-risk runs stay stable. Before
promotion, replay a representative trace corpus and confirm identical behavior; captured
adversarial traces become permanent regression cases.

## The one bright line that matters most
The meta-loop (STOP) makes the system *self*-improving. The single rule that keeps a
self-improver from optimizing away its own safety is the **fence**: it may tune the generator /
topology, and nothing else. Verified by `tests_meta/test_engine_offline.py::TestMetaFence`.

## What is intentionally NOT autonomous
- Deleting anything. Production DB writes. Live-site changes. Payments. DOT-compliance changes.
- These require an explicit, dated approval token in the operator's own message (CLAUDE.md §4).

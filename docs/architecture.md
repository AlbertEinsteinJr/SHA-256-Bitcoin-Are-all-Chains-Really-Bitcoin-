# PROMETHEUS — Architecture

A live, self-applying recursive self-improvement (RSI) engine. It evolves the
*scaffolding around a frozen model* — code, tests, prompts, topology, skills —
**never model weights** — gated by a real fitness function (this repo's pytest +
coverage), archived for lineage, sandboxed for safety, and able to turn itself on
its own improver (STOP-style recursion).

> The evaluator is the moat and is built first: you can only safely auto-improve
> what you can automatically score.

## The eight layers, one loop

```
                          ┌────────────────────────────────────────────┐
                          │  L0 CONSTITUTION  (CLAUDE.md — immutable)    │
                          │  safety floor · reliability law · eval-gate  │
                          └───────────────────────┬──────────────────────┘
                                                  │ governs everything
   ┌──────────────┐   generate   ┌───────────────▼───────────────┐   score   ┌─────────────┐
   │ L3 GENERATOR │─────────────▶│      L1 EVOLUTION ENGINE        │──────────▶│ L2 EVALUATOR│
   │ Claude SDK / │   variants   │  MAP-Elites + island archive    │  fitness  │ pytest+cov  │
   │ offline genes│◀─────────────│  (Darwin Gödel lineage)         │◀──────────│ binary gate │
   └──────────────┘   reflect    └───────┬───────────────┬─────────┘  promote  └─────────────┘
            ▲                            │ retrieve      │ act (sandboxed)
            │ skills                      ▼               ▼
   ┌────────┴────────┐         ┌──────────────────┐  ┌──────────────────────┐
   │ L5 SKILL LIBRARY│         │ L6 ORCHESTRATOR  │  │ L4 OS-CONTROL SANDBOX │
   │ Voyager (sqlite)│         │ 1→workers, vote  │  │ gated worktree, replay│
   └─────────────────┘         └──────────────────┘  └──────────────────────┘
            ▲                            ▲                     ▲
            └──────────── L7 OBSERVABILITY (traces · scorecards · lineage graph) ─────────┘
                          L8 META-LOOP (STOP): improve the improver, meta-eval-gated, fenced
```

The orchestrator (L6) retrieves relevant skills (L5), asks the generator (L3) for
diverse variants, each variant is enacted in the OS-control sandbox (L4) and
scored by the evaluator (L2); the evolution engine (L1) keeps an elite/diverse
archive and promotes-if-better; observability (L7) records every trace;
periodically the meta-loop (L8) turns the apparatus on its own improver — all
under the constitution (L0).

## Layer map

| Layer | Module(s) | Responsibility |
|-------|-----------|----------------|
| L0 | `CLAUDE.md` | Immutable laws: safety floor, reliability law, eval-gating, prod bright line, archive. Engine self-checks integrity at startup. |
| L1 | `prometheus/engine.py`, `prometheus/archive.py` | Eval-gated loop; MAP-Elites + island model; promote-if-better; sqlite lineage. |
| L2 | `prometheus/evaluator.py`, `eval/*.eval.json` | The moat. Runs `pytest --cov`, scores binary assertions → scalar + behavior descriptor. Reward-hacking guard. |
| L3 | `prometheus/generator.py`, `prometheus/genes.py` | Offline gene recombination (no network) **and** live Claude generator (Anthropic SDK). |
| L4 | `prometheus/sandbox.py` | Single chokepoint: isolated git worktree, allowlist, dry-run default, escape/forbidden-command refusals, replay. |
| L5 | `prometheus/skills.py`, `skills/` | Voyager library on sqlite. Admission requires self-verify + passing eval. Pluggable embedder. |
| L6 | `prometheus/orchestrator.py`, `prometheus/reliability.py` | Isolated workers, DAG parallelism, verification/voting pass. The reliability law as code. |
| L7 | `prometheus/telemetry.py`, `prometheus/tui.py` | JSONL traces, scorecards, sparklines, lineage-graph export (DOT/JSON). |
| L8 | `prometheus/meta.py` | STOP: optimize the improver's policy. Fenced from the evaluator + safety modules. |
| — | `prometheus/safety.py`, `prometheus/audit.py` | Token gate, KILL switch, caps, integrity check; append-only audit. |

## The loop, precisely

1. **Pre-flight (L0):** integrity check; KILL check; production targets hard-gated.
2. **Baseline (L2):** evaluate the target in a fresh sandbox → baseline score/coverage.
3. **Per generation, per island:**
   - **Generate (L3):** N diverse variants (directed mutation of the current best + exploration).
   - **Enact (L4):** write each variant into an isolated worktree.
   - **Score (L2):** run pytest+coverage; compute scalar + behavior descriptor.
   - **Gate + archive (L1):** promote-if-better **and** suite-green **and** reward-hack-clean; store every variant in its MAP-Elites niche.
4. **Stop** when all assertions pass, the iteration/wallclock/spend caps hit, or the eval saturates (flagged: harden the judge).
5. **Promote** the best to the live tree (additive test file — non-production per §4), archive the previous with its score, and **admit the winning strategy as a verified skill (L5)**.

## Why these choices

- **MAP-Elites + islands** (AlphaEvolve / Darwin Gödel Machine): diversity beats greedy
  hill-climbing and escapes local optima; the *lineage* is the asset, not just HEAD.
- **Binary evals** (CLAUDE.md §3): clarity over fuzzy scores; a saturating eval is treated
  as a defect (the judge is too weak), not a victory.
- **Sandbox chokepoint** (CLAUDE.md §1): an OS-controlling, self-modifying loop is only safe
  if every action passes one gated, isolated, replayable point.
- **Fenced meta-loop** (CLAUDE.md §0/§3): the improver may tune generation policy but never
  edit the evaluator's scoring intent or the safety modules — the one rule that stops a
  self-improver from optimizing away its own brakes.

See `docs/safety-model.md` for the threat model and `docs/recursive-self-improvement-playbook.md`
for the research this is built on.

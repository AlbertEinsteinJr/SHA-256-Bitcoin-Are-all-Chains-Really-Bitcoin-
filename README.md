# PROMETHEUS — The Unstoppable Operator OS

A **live, self-applying recursive self-improvement (RSI) engine** built on top of a
small educational SHA-256 / Bitcoin-style blockchain (`src/`). PROMETHEUS evolves the
*scaffolding around a frozen model* — code, tests, prompts, topology, skills —
**never model weights** — gated by a real fitness function (this repo's `pytest` +
coverage), archived for lineage, sandboxed for safety, and able to turn itself on its
own improver.

> The evaluator is the moat and is built first: you can only safely auto-improve what
> you can automatically score.

## Easiest start: one command

```bash
pip install -r requirements.txt
python -m prometheus verify        # checks the code, improves it, explains the result in plain English
```

Output:
```
  Before :  4% of checks passed   (81% of the code was tested)
  After  :  100% of checks passed   (99% of the code was tested)
  Result :  It improved the code and saved the new tests to tests/test_prometheus_evolved.py
  Gain   :  a 96% jump, done automatically.
```

## Proof of life (no API key needed)

```bash
python -m prometheus run --eval blockchain-core      # the gate: baseline ~4% (real headroom)
python -m prometheus improve --target blockchain-core # the loop: autonomously closes the gaps
```

On a fresh tree the gate reports **1/23 assertions, 81% coverage**. The offline
evolutionary loop drives it to **23/23, ~99% coverage** — promoting only variants that
beat the current best and keep the suite green, archiving the lineage, and admitting the
winning strategy as a verified skill.

```
  baseline : score 4%   coverage 81.1%
  final    : score 100% coverage 99.4%
  PROMOTED : v100101-explore-21 -> tests/test_prometheus_evolved.py
```

## The eight layers

| Layer | Module | Role |
|------:|--------|------|
| L0 | `CLAUDE.md` | Constitution: safety floor, reliability law, eval-gating, prod bright line |
| L1 | `prometheus/engine.py`, `archive.py` | Eval-gated evolution: MAP-Elites + island model + lineage |
| L2 | `prometheus/evaluator.py` | The moat: pytest+coverage → binary score + behavior descriptor |
| L3 | `prometheus/generator.py`, `genes.py` | Offline gene recombination **and** live Claude generator |
| L4 | `prometheus/sandbox.py` | Gated OS-control: isolated git worktree, dry-run, replay, refusals |
| L5 | `prometheus/skills.py` | Voyager skill library (verified admission) |
| L6 | `prometheus/orchestrator.py`, `reliability.py` | Isolated workers, DAG, verification/voting |
| L7 | `prometheus/telemetry.py`, `tui.py` | Traces, scorecards, lineage-graph export |
| L8 | `prometheus/meta.py` | STOP: improve the improver — fenced from the evaluator + safety |

Full design in [`docs/architecture.md`](docs/architecture.md). The research it's built on:
[`docs/recursive-self-improvement-playbook.md`](docs/recursive-self-improvement-playbook.md).

## Commands

```bash
python -m prometheus run        --eval blockchain-core      # score the repo against the gate
python -m prometheus improve    --target blockchain-core    # run the self-improvement loop
python -m prometheus dashboard                              # live scorecards + niche map
python -m prometheus lineage    --target blockchain-core    # export the evolutionary lineage (DOT/JSON)
python -m prometheus meta                                   # the STOP meta-loop (fenced, dry-run)
python -m prometheus kill                                   # arm the KILL switch (clear with --clear)
python -m prometheus replay                                 # replay recorded traces
```

## Safety is the point, not the afterthought

An OS-controlling, self-modifying loop is only safe if the brakes are *mechanisms*:
- **Token gate** — destructive / production actions require `APPROVED-<ACTION>-<YYYYMMDD>`.
- **Sandbox chokepoint** — every action runs in an isolated git worktree; escapes and
  destructive commands are refused; dry-run is the default.
- **Append-only audit** + **KILL switch** + enforced **iteration/spend/rate caps**.
- **Fenced meta-loop** — the improver may tune generation policy but **never** edit the
  evaluator's scoring intent or the safety modules.
- **Reward-hacking guard** — a higher score with weakened tests is rejected and flagged.

Threat-model → mitigation mapping: [`docs/safety-model.md`](docs/safety-model.md).

## Tests

```bash
python -m pytest            # 16 original + evolved blockchain tests + 26 engine tests
```

The blockchain suite (`tests/`) is the engine's fitness substrate; the engine's own tests live
in `tests_meta/` (kept out of `tests/` so the evaluator never recurses into them).

## Live brain (optional)

PROMETHEUS runs fully offline by default. To use Claude as the generator:

```bash
pip install anthropic
export ANTHROPIC_API_KEY=sk-...
PROMETHEUS_ONLINE=1 python -m prometheus improve --target blockchain-core --online
```

## Layout

```
CLAUDE.md            # L0 constitution
prometheus/          # the engine (L1–L8 + safety)
eval/                # the gate: binary assertions, best.json, regression/
skills/              # Voyager library registry
archive/             # lineage convention (snapshots are runtime artifacts)
loop/                # generator drop-zone
docs/                # playbook, architecture, safety model, bootstrap & loop prompts, flywheel
src/  tests/         # the SHA-256/blockchain fitness substrate (unchanged by the engine)
tests_meta/          # the engine's own test suite
```

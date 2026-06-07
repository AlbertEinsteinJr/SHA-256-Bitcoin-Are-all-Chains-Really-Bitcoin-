# eval/ — the gating function (the moat)

> You can only safely auto-improve what you can automatically score. The evaluator
> is built first and is a protected asset (CLAUDE.md §3).

## Files
- `blockchain-core.eval.json` — ≥20 **binary** assertions for the SHA-256/blockchain core,
  seeded from `TEST_COVERAGE_ANALYSIS.md`. Several FAIL on a fresh tree — that is the real
  headroom the engine closes.
- `meta-improver.eval.json` — criteria that gate the *improver's own* quality (the L8 meta-loop).
- `best.json` — current best score per component. A change ships only if it beats this and
  passes regression.
- `regression/` — past-failure cases that must always stay green (captured adversarial traces).

## Assertion types
| type | shape | passes when |
|------|-------|-------------|
| `coverage` | `{"module": "src/chain.py", "min": 95}` | module coverage ≥ min |
| `invariant` | `{"min_total": 95}` | total coverage ≥ min |
| `suite_green` | `{}` | every collected test passes |
| `test_passes` | `{"name": "test_..."}` | that test exists and passed |

Binary only — no fuzzy scoring (CLAUDE.md §3). A saturating eval (everything passes) is treated
as a defect: the judge is too weak; hardening it requires `APPROVED-EVAL-<date>`.

## Run it
```bash
python -m prometheus run --eval blockchain-core
```
Prints a per-case PASS/FAIL table, a scalar score (`passed/total`), and total coverage.
Exits nonzero until every assertion passes.

## Add real cases
Grow the suite from real production failures: add a binary assertion describing the *correct
outcome* (generator-independent), drop any reproducing trace into `regression/`, and let the
loop optimize toward it.

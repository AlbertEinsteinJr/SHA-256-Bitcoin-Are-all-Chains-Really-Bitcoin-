# Artifact 3 — Self-Improvement Loop (reusable master prompt)

The eval-gated loop to re-run on any non-production component. Its executable
counterpart in this repo is `prometheus/engine.py` (`python -m prometheus improve
--target <name>`). Preserved here as the portable prompt.

---

```
Obey CLAUDE.md. Run the eval-gated self-improvement loop on this target ONLY:
<SKILL_OR_AGENT_NAME>.

Preconditions (refuse if any fail):
- The target is non-production and not behind a safety gate.
- An eval suite exists at eval/<target>.eval.json with ≥20 binary cases, plus the
  regression set.
- eval/best.json has (or will initialize) a current best score for this target.

Loop, max <N=20> iterations (respect spend/rate caps):
1. Run the eval suite on the CURRENT version. Record score. If first run, this is the
   baseline best.
2. Read every FAILING case. Write a short, specific failure analysis (root cause per
   case — no vague language).
3. Generate 3 DISTINCT candidate variants that aim to fix the failures without breaking
   passing cases. Genuinely different approaches, not cosmetic edits.
4. Run the FULL eval suite + the regression suite on each candidate. Strict binary scoring.
5. Pick the best candidate.
   - If it BEATS the current best AND passes 100% of regression: PROMOTE it. Archive the
     previous version as */archive/<target>.v<n>.score<NN>.<timestamp>.<ext>. Update
     best.json. Add any newly-fixed-then-regressed case to the regression set.
   - Else: do NOT promote. Log why.
6. Reward-hacking check: if a candidate passes the eval but is obviously worse in reality,
   do NOT promote — add a regression case that catches the exploit, and flag me.
7. If improved, repeat. If two consecutive iterations yield no improvement, STOP and
   report: the eval may be saturating (judge too weak) — recommend hardening it (requires
   APPROVED-EVAL-<date>).

Output: starting score → final score, what changed and why, the archive entries created,
any regression cases added, and any flags. Never delete. Never touch production. Never
change eval scoring logic without my approval token.
```

## How the engine implements each step

| Prompt step | Engine |
|-------------|--------|
| Preconditions / refuse gated targets | `engine.py::improve` pre-flight; `safety.py` |
| 1. Baseline eval | `_eval_variant(target, None)` in a sandbox |
| 2. Failure analysis | `_failures()` → passed into the generator |
| 3. Generate 3+ variants | `generator.py` (offline genes or live Claude) |
| 4. Full eval + regression | `evaluator.py` (suite-green = regression gate) |
| 5. Promote-if-better + archive | `_is_promotable`, `_promote_to_repo`, `archive.py` |
| 6. Reward-hacking check | `Evaluator.structural_strength` + promotion gate |
| 7. Saturation stop | "no improvement for 2 generations" flag |

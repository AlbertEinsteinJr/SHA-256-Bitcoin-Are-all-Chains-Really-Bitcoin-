# Artifact 2 — Phase 1 Bootstrap (reusable master prompt)

This is the one-time scaffolding prompt from the Operator OS spec. In **this**
repository the Bootstrap is already realized in Python as the `prometheus/`
package (see `docs/architecture.md`); the prompt is preserved here as the
portable, stack-agnostic template you can paste into a fresh project. Where the
original assumed TypeScript/Supabase, the Python realization in this repo is noted
in brackets.

---

```
Read CLAUDE.md fully and obey it. We are building the Phase 1 scaffolding for a
recursive-self-improvement operator OS. Work in small, verifiable steps. After each
numbered section, STOP, show me what you built, and wait for "next". Do not touch
production. Do not delete anything.

Build these, in order:

1. EVAL SUBSTRATE (do this first — nothing else compounds without it)
   - eval/<component>.eval.json : an array of cases { id, input, assert (binary
     true/false), why }. Seed with ≥20 real cases drawn from production failures.
   - a runner that loads the cases, runs the component, scores each assertion as
     strictly binary pass/fail, prints score (passed/total) + a per-case table, and
     exits nonzero if score < current best.
   - eval/best.json : current best score per component.
   - eval/regression/ : past-failure cases that must always pass.
   Use binary assertions only. One command to run it.
   [Python realization: eval/blockchain-core.eval.json + prometheus/evaluator.py;
    `python -m prometheus run`.]

2. SKILL LIBRARY (Voyager pattern)
   - a skills store with: name (unique), description, embedding, code, language,
     verified (bool), eval_score, version, parent_id (lineage), archived, created_at.
   - addSkill (refuses unless verified=true AND eval_score present), searchSkills
     (top-k by similarity), archiveSkill (never deletes), promoteSkill (version+1).
   Rule, enforced in code: admit a skill ONLY after self-verification + a passing eval.
   [Python realization: prometheus/skills.py on stdlib sqlite3; pluggable embedder.]

3. RELIABILITY WRAPPERS
   - validate(schema, value) : structured-output validation at boundaries.
   - withReflection(fn, {maxRetries=1}) : retry-with-reflection.
   - chain(steps[]) : ≤5 steps; verification checkpoint at step 3 and step 5.
   - parallel(branches[]) : run independent branches concurrently (DAG).
   Every agent/tool boundary passes through validate.
   [Python realization: prometheus/reliability.py.]

4. SAFETY GATES (back the constitution with mechanism, not words)
   - requireApproval(action, token?) : true ONLY if token === APPROVED-<action>-<today>;
     else throws and logs the blocked attempt.
   - wrap every destructive/production capability so it calls requireApproval first.
   - append-only audit log (timestamp, actor, action, args_hash, result_hash, approved);
     writers may append but NEVER update/delete.
   - hard caps on any loop: max iterations, max spend (USD), max tool-calls/min.
   - a KILL switch that halts loops.
   [Python realization: prometheus/safety.py + prometheus/audit.py; `python -m prometheus kill`.]

5. FLYWHEEL — the shared data spine (the moat)
   - a shared schema where each product emits proprietary data that improves the others.
   [In THIS repo the trucking Breakdown/Repair Graph has no analog and is documented as a
    pattern in docs/flywheel.md. The repo's real spine is the eval + archive data: every
    improvement enriches them and they gate every promotion.]

6. SELF-IMPROVEMENT LOOP (wire it; never run on prod)
   - a runnable loop on a named NON-production component: generate 3 variants → run eval
     on each → promote best IF it beats best.json → archive previous with score → repeat
     up to the iteration cap. It must refuse anything behind a safety gate.
   [Python realization: prometheus/engine.py; `python -m prometheus improve --target ...`.]

7. SANITY PASS
   - verify: every boundary validates, every destructive op is gated, the audit log is
     append-only, the eval runner works, and the loop refuses production targets. Show a
     checklist with pass/fail and fix any fail before declaring done.
   [Python realization: tests_meta/test_meta_system.py + tests_meta/test_engine_offline.py.]

Constraints: ≤5-step chains with verification at 3 and 5; binary evals only;
promote-if-better-and-archive; never delete; never touch production without
APPROVED-<ACTION>-<date>. Keep everything simple and runnable. Stop after each section.
```

# Operator OS

A war-room-hardened **recursive self-improvement operator platform** — a kernel +
7 subsystems + a human control plane (CLI · HTTP API · Next.js dashboard), built on
the spec's actual stack (Next.js / Supabase + pgvector / Anthropic / Voyage).

This is the "Unstoppable Operator OS" spec built for real: the constitution
(`CLAUDE.md`) is enforced by mechanism, not vibes.

## What's real (verified)
- **Append-only, hash-chained audit** — enforced on the live Postgres by a
  `BEFORE UPDATE OR DELETE` trigger (verified: `UPDATE` on `audit_log` is rejected,
  the chain links genesis→entry). `service_role` can't quietly tamper.
- **Safety kernel** — `requireApproval` (`APPROVED-<ACTION>-<YYYYMMDD>`, single-use
  nonce) + `guard()` wrapping every destructive capability; refuses without a token.
- **Reliability runtime** (§2) — `validate` (zod), `withReflection` (1 retry ≈
  99.75%), `chain` (≤5 steps, verify at index 2 & 4), `parallel`.
- **Eval engine** (§3) — strictly binary; deterministic predicates + a secret gold
  **holdout** gate promotion; an LLM-judge (opus, temp 0, k-of-n majority,
  channel-separated) informs; rational integer scoring (strict `>`, ties don't
  promote); `suite_hash` stamping; reward-hack + saturation detection.
- **Skill library** (Voyager) — pgvector HNSW + Voyage embeddings; admission only
  after verified + passing eval; lineage/versioning; never deletes (archive).
- **Flywheel** — Breakdown/Repair graph + `intent_corrections` (the moat signal) +
  a backtestable predictor; seeded with realistic data.
- **Self-improvement loop** — Artifact 3, eval-gated, archive-on-promote, refuses
  production / safety-gated targets. Runs as **idempotent steps on a durable queue**
  (no serverless daemon), kicked by Vercel Cron, drained by a separate worker.
- **Control plane** — `operator` CLI, HTTP API, and a cockpit dashboard.

## Run it
```bash
npm install
npm run typecheck      # strict, clean
npm test               # vitest (reliability, safety, eval)
npm run sanity         # constitution invariants (10/10)
npm run eval           # binary eval over the seed suite
npm run build          # Next.js production build
npm run dev            # dashboard at http://localhost:3000
operator status|eval|loop|kill|audit   # via: npx tsx src/cli/operator.ts
```

## Architecture
`src/contracts` (frozen ports/schemas/ids/errors/fakes) ← `src/core` (infra +
safety/caps/kill/kernel) ← subsystems (`eval`, `skills`, `flywheel`, `loop`,
`agents`) ← `src/app` (dashboard + API + the single composition root `container.ts`).
Dependencies flow one way; concrete clients are built only in `container.ts`.

## Honest boundary (per CLAUDE.md §1)
Real & operational now: everything above, on a live Supabase project.
**Tier-2 hardening** (interfaces in place, refuses loudly if the gate is missing —
not faked): external WORM audit sink in a separate account; offline/HSM token
signing key; a fully separate approval-service host; live Vapi/Twilio/Stripe
(currently honest, labeled SIMULATED). And: enable **RLS** + use `service_role`
server-side (the demo grants the anon role read + minimal control writes).

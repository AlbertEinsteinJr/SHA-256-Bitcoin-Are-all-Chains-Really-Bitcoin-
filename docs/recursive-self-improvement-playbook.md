# The Unstoppable Operator: A Recursive Self-Improvement Playbook

*Reference document for the PROMETHEUS engine. The engine in `prometheus/` is the
buildable, safe subset of the ideas below, wired to this repo's real fitness
function (pytest + coverage).*

## Contents
- [TL;DR](#tldr)
- [Key Findings](#key-findings)
- [A) The State of the Art in Applied RSI (Buildable Today)](#a-the-state-of-the-art-in-applied-rsi-buildable-today)
- [B) Reliability Engineering for Compounding Agent Systems](#b-reliability-engineering-for-compounding-agent-systems)
- [C) Business / Market Dominance — The Flywheel Layer](#c-business--market-dominance--the-flywheel-layer)
- [D) Personal Operating System — Human-in-the-Loop Compounding](#d-personal-operating-system--human-in-the-loop-compounding)
- [E) Failure Modes & The Safety Floor](#e-failure-modes--the-safety-floor)
- [References](#references)
- [How this maps to the PROMETHEUS engine](#how-this-maps-to-the-prometheus-engine)

---

## TL;DR
- **"Unstoppable" is buildable, but only as a disciplined loop, not a leap.** The durable
  advantage comes from wiring together four things: tight self-improvement loops (generate →
  evaluate → keep-if-better), rigorous automated evaluation as the gating function, reliability
  engineering that fights compound decay, and hard safety gates. The frontier research (STOP,
  Voyager, AlphaEvolve, ADAS, Darwin Gödel Machine) converges on one lesson: **the evaluator
  is the bottleneck and the moat** — improvement is only as safe and as fast as the eval that
  gates it.
- **Your real competitive moat is a closed feedback loop no competitor can replicate**, not
  your code or your data pile. Wire products into ONE proprietary dataset where each product's
  usage improves the others. That cross-product learning loop is how a one-person operator
  out-executes incumbents.
- **The same RSI principles apply to the human.** A personal "seed improver" (brainstorm →
  plan → execute → self-assess → critique → repeat) with knowledge capture and deliberate
  practice compounds capability the way a Voyager skill library compounds an agent's. The
  binding constraint everywhere is the safety floor: never delete, never touch production
  without approval — which you keep by letting the system self-improve aggressively only on
  non-production components.

## Key Findings
1. **Self-improvement that works today does NOT modify the model** — it modifies the
   scaffolding around a frozen model. STOP recursively improves a "seed improver" scaffold;
   Voyager grows a skill library; AlphaEvolve evolves code; the Darwin Gödel Machine rewrites
   its own agent code. None retrain the LLM. This is exactly the lane to build in with Claude +
   Claude Code + MCP today.
2. **Every working self-improvement system has the same three parts: a generator, an
   evaluator, and an archive/memory.** The evaluator is load-bearing: AlphaEvolve only works
   on "machine-verifiable tasks," and that is its explicit limitation.
3. **Compound reliability decay is real math, and a ~5-step cap is correct.** At 95% per step,
   5 steps = 77%, 10 = 60%, 20 = 36%. At 99% per step, 10 = 90%, 100 = 37%. The fixes are
   proven: shorten chains, insert verification checkpoints, retry-with-reflection,
   structured-output validation at every boundary, voting/consensus.
4. **Proprietary data alone is NOT a moat — a closed feedback loop is.** The defensible asset
   is the flywheel: every customer action makes the model better; inference quality + trust
   compound over time.
5. **The one-person company that scales is now empirically demonstrated — with a named failure
   mode:** the founder becomes "the sole human backstop for every system failure, at any hour
   and at any scale." Mitigate with reliability + safety engineering so systems fail safe.
6. **Self-improving systems have concrete, measured failure modes.** Reward hacking,
   specification gaming, and goal misgeneralization are well-formalized; Anthropic's June 2025
   Agentic-Misalignment study found frontier models taking harmful instrumental actions under
   goal-conflict + threat-of-replacement. The lesson: never let a self-improvement loop
   optimize against a metric it can game, and never give it the means to act irreversibly
   without a gate.

## A) The State of the Art in Applied RSI (Buildable Today)

**The core pattern: seed improver + eval-gated iteration.** **STOP** (Self-Taught Optimizer,
Zelikman et al., 2023) formalizes the buildable version of RSI: write a small scaffolding
program that calls the LLM to improve a solution according to a utility function, then run that
improver on its own code. The model is unchanged — so the safe, real RSI you can build is
*scaffold* self-improvement (prompts, workflows, tool-selection, agent code), not model
self-improvement.

**Voyager** (2023) — the skill-library substrate. A frozen GPT-4 agent in Minecraft with three
parts: an automatic curriculum, an ever-growing skill library of executable code indexed by
embeddings, and iterative prompting with self-verification before a skill is admitted.
Ablations: removing the curriculum dropped discovered items ~93%; removing self-verification
dropped performance ~73%; the skill library matters most in later stages. **Takeaway:** build a
retrieval-indexed, verified skill library that grows over time; self-verification before
admission is non-negotiable; the payoff compounds late, so start now.

**AlphaEvolve** (Google DeepMind, 2025) — evolution gated by automated evaluators. An
evolutionary coding agent pairing an LLM ensemble with automated evaluators that return scalar
metrics, maintaining an evolutionary database (MAP-Elites / island model). Its stated
limitation: it requires "an evaluation function with metrics to optimize" and is best suited to
"machine-verifiable tasks." **This is THE constraint that governs everything: you can only
safely auto-improve what you can automatically score.**

**Darwin Gödel Machine** (Sakana AI + UBC, 2025) — a coding agent that rewrites its own code,
maintaining an expanding archive/lineage of agent variants (open-ended exploration, not greedy
hill-climbing), empirically validating each change. **Takeaway:** keep an archive of past agent
versions, don't just keep the latest; evolutionary diversity beats greedy improvement and
avoids local optima.

**ADAS** (Automated Design of Agentic Systems, 2024/2025) — a meta-agent programs new agents in
code, evaluates them, archives them, and uses the archive to design better ones. **Takeaway:**
the design of your agent hierarchy is itself an optimizable artifact.

**The optimization toolkit to adopt:** DSPy (prompts as compilable parameters), TextGrad
(textual gradients), Reflexion (verbal reinforcement into episodic memory — the cheapest
self-improvement loop), Self-Rewarding / Meta-Rewarding LMs (invest as much in the judge as in
the generator, because a gameable judge caps the whole loop).

**Applying this with Claude + Claude Code + MCP:** create an `eval/` folder with binary
assertions and a runner; point a coding loop at a spec that reads failing cases → writes a
failure analysis → generates variants → runs the eval → promotes if better and archives the
previous version with its score → repeats under an iteration cap. Treat each MCP tool as a
verified skill with a contract. Keep a skill library admitted only after self-verification + a
passing eval.

## B) Reliability Engineering for Compounding Agent Systems

**The compound reliability problem, quantified.** Independent per-step success multiplies:
P = ∏(1 − pᵢ). At 95%/step: 5 → 77.4%, 10 → 59.9%, 20 → 35.8%. The correct engineering
response is to cap chains under ~5 sequential steps and insert verification between them.

**Proven mitigations (stack them — defense in depth):**
- **Shorten the chain.** Every removed step improves reliability more than optimizing any
  single component.
- **Verification checkpoints as circuit breakers.** A validation gate at each boundary resets
  the failure probability — converting multiplicative decay into something bounded. Use
  schema-enforced generation; reject/regenerate invalid output within a bounded retry budget.
- **Retry-with-reflection.** A single retry at 95% per attempt lifts an effective step to
  ~99.75%. Highest-leverage cheap fix.
- **DAG/graph orchestration over linear chains.** Parallel independent branches don't compound
  each other's errors.
- **Voting / self-consistency / ensembling** on critical tasks.
- **Explicit input/output contracts between every agent pair** — no implicit shared state.

**Architectures that get MORE reliable as they get more capable** (Anthropic, "Building
Effective Agents"): prompt chaining, routing, parallelization, orchestrator-workers, and
evaluator-optimizer. Core principles: maintain simplicity, prioritize transparency, craft the
agent-computer interface carefully. Enforce strict isolation between workers; add a dedicated
verification pass as the final step.

**Safely letting a system modify its own prompts/code/config:** version everything (keep the
lineage, not just HEAD); promote only if it beats the eval; shadow → canary → full; record
traces for deterministic replay; human-approval gates on irreversible actions.

## C) Business / Market Dominance — The Flywheel Layer

The 2026 consensus: incremental data has diminishing returns; the durable, compounding asset is
**inference quality built on proprietary data over time, plus the trust relationship that
generates more proprietary (zero-party) data**. Wire products into ONE reinforcing flywheel
around a shared graph, where each product emits proprietary data that improves the others. Every
turn widens a gap a larger incumbent (who lacks the integrated loop) cannot close by spending.

The small-operator-beats-incumbent playbook layers moats: proprietary data + switching costs
(embedded workflows, historical operational data) + network economies. Single moats rarely
suffice; the defensible play is layering.

*(The trucking-specific instantiation of this flywheel is in `docs/flywheel.md`. It is
operator-OS scope and intentionally not built into this repository.)*

## D) Personal Operating System — Human-in-the-Loop Compounding

Build a personal "seed improver": brainstorm → plan → execute → self-assess → critical thinking
→ repeat. Make it compounding by adding the two parts that make agent loops work: an
**evaluator** (explicit success criteria you score yourself against) and an **archive** (a
knowledge-capture system / personal skill library). The Voyager ablation maps directly: without
self-verification, performance drops ~73%; without an accumulating library, you plateau.

Deliberate practice (Ericsson): well-defined tasks at the edge of ability, immediate
informative feedback, repetition with progressively harder goals — identical to AlphaEvolve's
"harder problems gated by a sharp evaluator." Keep a "human-in-the-loop on the judgment,
automation on the toil" split: remain the author of the evals and the architecture (the
high-leverage, skill-building work) while delegating execution. This keeps your metacognitive
skill — knowing what "good" looks like — sharp, which is exactly the skill that caps how good
your automated systems can get.

## E) Failure Modes & The Safety Floor

Self-modifying, tool-using agents have concrete failure modes: **reward hacking** (optimizing
the metric, not the goal), **specification gaming**, **goal misgeneralization**, and — under
goal-conflict plus threat-of-replacement — **harmful instrumental behavior** (Anthropic's June
2025 Agentic-Misalignment study). The builder's response:

- **Never let a self-improvement loop optimize against a metric it can game.** Treat a
  saturating eval as a defect; harden the judge.
- **Never give the loop the means to act irreversibly without a gate.** Scoped credentials +
  a forced approval token, not prompts alone.
- **Fence the meta-loop:** the improver may tune generation policy but never edit the
  evaluator's scoring intent or the safety modules.

See `docs/safety-model.md` for the concrete threat-model → mitigation mapping implemented in the
engine.

## References
- Zelikman et al., *Self-Taught Optimizer (STOP): Recursively Self-Improving Code Generation*, arXiv:2310.02304.
- Wang et al., *Voyager: An Open-Ended Embodied Agent with Large Language Models*, arXiv:2305.16291.
- Novikov et al. (Google DeepMind), *AlphaEvolve: A coding agent for scientific and algorithmic discovery*, arXiv:2506.13131.
- Zhang et al. (Sakana AI + UBC), *Darwin Gödel Machine: Open-Ended Evolution of Self-Improving Agents*, arXiv:2505.22954.
- Hu et al., *Automated Design of Agentic Systems (ADAS)*, ICLR 2025, arXiv:2408.08435.
- Shinn et al., *Reflexion: Language Agents with Verbal Reinforcement Learning*, NeurIPS 2023, arXiv:2303.11366.
- Yuan et al. (Meta FAIR), *Self-Rewarding / Meta-Rewarding Language Models*, arXiv:2407.19594.
- Anthropic, *Building Effective Agents* (2024) and *Agentic Misalignment* (June 2025).
- DSPy (Stanford); TextGrad (Stanford Zou group, *Nature*, arXiv:2406.07496).
- Mouton et al. / a16z, *The Empty Promise of Data Moats* (Casado & Lauten).

## How this maps to the PROMETHEUS engine
| Playbook idea | Engine realization |
|---------------|--------------------|
| STOP seed-improver recursion | `prometheus/meta.py` (L8), fenced |
| Voyager skill library + verified admission | `prometheus/skills.py` (L5) |
| AlphaEvolve eval-gated evolution + MAP-Elites/islands | `prometheus/engine.py`, `archive.py` (L1) |
| AlphaEvolve "machine-verifiable tasks" constraint | `prometheus/evaluator.py` (L2) over pytest+coverage |
| Darwin Gödel lineage archive | sqlite archive, never overwritten |
| Reliability law (≤5 steps, retry, DAG, vote) | `prometheus/reliability.py`, `orchestrator.py` (L6) |
| Safety floor (token gate, KILL, append-only audit) | `prometheus/safety.py`, `audit.py` |
| Reward-hacking guard | `Evaluator.structural_strength` + promotion gate |

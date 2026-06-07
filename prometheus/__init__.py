"""
PROMETHEUS — The Unstoppable Operator OS.

A live, self-applying recursive self-improvement (RSI) engine. It evolves the
*scaffolding around a frozen model* (code, tests, prompts, topology, skills) —
never model weights — gated by a real fitness function (this repo's pytest +
coverage), archived for lineage, sandboxed for safety, and capable of turning
itself on its own improver (STOP-style recursion).

The eight layers (see docs/architecture.md):
    L0  Constitution        CLAUDE.md (immutable laws)
    L1  Evolution Engine    engine.py / archive.py  (MAP-Elites + island model)
    L2  Evaluator           evaluator.py            (the moat; built first)
    L3  Generator           generator.py            (Claude SDK / offline stub)
    L4  OS-Control Sandbox  sandbox.py              (gated, dry-run, replay)
    L5  Skill Library       skills.py               (Voyager pattern)
    L6  Orchestrator        orchestrator.py         (1->workers, verify, vote)
    L7  Observability       telemetry.py / tui.py
    L8  Meta-Loop (STOP)    meta.py
    --  Safety envelope     safety.py / audit.py

The evaluator is the moat and is built first: you can only safely auto-improve
what you can automatically score.
"""

__version__ = "0.1.0"
__all__ = ["__version__"]

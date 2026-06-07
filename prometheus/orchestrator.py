"""
L6 — Orchestrator: orchestrator-workers with context isolation, parallel DAG
fan-out, and a dedicated verification/voting pass (Anthropic "Building Effective
Agents").

Workers are isolated: each receives a self-contained task, an explicit output
schema, and a fresh context. They do not share state or talk to each other.
A final verification pass votes over critical results (self-consistency). This is
the literal encoding of the reliability law (CLAUDE.md §2).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Sequence

from .reliability import parallel, validate, vote

# Every worker must return this shape — validated at the boundary (no implicit state).
WORKER_SCHEMA: Dict[str, Any] = {
    "task_id": str,
    "ok": bool,
    "output": lambda v: v is not None,
}


@dataclass
class Task:
    task_id: str
    fn: Callable[[], Dict[str, Any]]


@dataclass
class OrchestrationResult:
    results: List[Dict[str, Any]] = field(default_factory=list)
    verified: Any = None
    consensus: bool = False


class Orchestrator:
    """A lead that decomposes work, runs isolated workers, then verifies."""

    def run(self, tasks: Sequence[Task], *, critical_key: str = "output") -> OrchestrationResult:
        # Fan out as a parallel DAG — independent branches do not compound errors.
        branches = [self._isolated(t) for t in tasks]
        raw = parallel(branches)

        # Boundary validation: reject malformed worker outputs.
        clean = []
        for r in raw:
            validate(WORKER_SCHEMA, r)
            clean.append(r)

        # Verification pass: vote over the critical field for self-consistency.
        critical_values = [r[critical_key] for r in clean if r.get("ok")]
        verified = vote(critical_values) if critical_values else None
        consensus = bool(critical_values) and all(v == verified for v in critical_values)
        return OrchestrationResult(results=clean, verified=verified, consensus=consensus)

    @staticmethod
    def _isolated(task: Task) -> Callable[[], Dict[str, Any]]:
        """Wrap a worker so a failure is captured, not propagated (isolation)."""

        def run_one() -> Dict[str, Any]:
            try:
                out = task.fn()
                if not isinstance(out, dict):
                    out = {"output": out}
                out.setdefault("task_id", task.task_id)
                out.setdefault("ok", True)
                return out
            except Exception as exc:  # noqa: BLE001 - isolate worker failure
                return {"task_id": task.task_id, "ok": False, "output": f"error: {exc}"}

        return run_one

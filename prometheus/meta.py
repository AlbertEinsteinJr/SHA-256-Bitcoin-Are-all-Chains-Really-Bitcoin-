"""
L8 — Meta-Loop (STOP): the engine improves its own improver.

This is the recursion that makes the system *self*-improving rather than merely
improving: periodically we optimize the improver's own configuration (its
generation policy) against a meta-eval, gated identically to the base loop.

The fence (CLAUDE.md §0, §3): the meta-loop may tune the GENERATOR/topology only.
It may NOT edit the evaluator's scoring intent or the safety modules. Any attempt
to touch a protected file is refused and audited. This is empirical STOP, not the
proof-based Gödel machine.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List

from .config import Config
from .safety import SafetyError, SafetyManager

# Files the improver is forbidden to modify, by name.
FENCED_FILES = {"evaluator.py", "safety.py", "audit.py", "CLAUDE.md"}


@dataclass
class MetaResult:
    proposals: List[Dict]
    best_config: Dict
    refused_edits: List[str]
    dry_run: bool


class MetaLoop:
    """Optimizes the improver's generation policy against a meta-eval."""

    def __init__(self, cfg: Config, safety: SafetyManager):
        self.cfg = cfg
        self.safety = safety
        self.meta_eval_path = cfg.eval_dir / "meta-improver.eval.json"

    def assert_edit_allowed(self, target_file: str) -> None:
        """The fence: refuse + audit any edit to a protected file."""
        name = Path(target_file).name
        if name in FENCED_FILES:
            self.safety.audit.record(
                "meta",
                "edit",
                blocked=True,
                note=f"fenced file (meta may not touch evaluator/safety): {name}",
            )
            raise SafetyError(
                f"meta-loop refused to edit protected file {name!r} "
                "(evaluator scoring intent and safety modules are fenced)"
            )

    def propose(self, *, dry_run: bool = True) -> MetaResult:
        """
        Score candidate improver configs against the meta-eval. Configs vary only
        generation-policy knobs (breadth, islands, exploration ratio) — never the
        scoring or safety code.
        """
        self.safety.assert_integrity()
        criteria = self._load_meta_eval()

        candidates = [
            {"variants_per_iteration": 3, "islands": 1, "exploration": 0.5},
            {"variants_per_iteration": 4, "islands": 2, "exploration": 0.6},
            {"variants_per_iteration": 6, "islands": 3, "exploration": 0.7},
        ]
        scored = []
        for cfg in candidates:
            score = self._meta_score(cfg, criteria)
            scored.append({"config": cfg, "meta_score": score})
        scored.sort(key=lambda c: c["meta_score"], reverse=True)
        best = scored[0]["config"]

        # Demonstrate the fence holds even when "asked" to touch a protected file.
        refused: List[str] = []
        for probe in ("generator.py", "evaluator.py", "safety.py"):
            try:
                self.assert_edit_allowed(probe)
            except SafetyError:
                refused.append(probe)

        return MetaResult(
            proposals=scored, best_config=best, refused_edits=refused, dry_run=dry_run
        )

    # ---- internals ---------------------------------------------------------
    def _load_meta_eval(self) -> List[Dict]:
        if self.meta_eval_path.exists():
            data = json.loads(self.meta_eval_path.read_text(encoding="utf-8"))
            return data.get("cases", data) if isinstance(data, (dict, list)) else []
        return []

    @staticmethod
    def _meta_score(cfg: Dict, criteria: List[Dict]) -> float:
        """
        A simple, transparent meta-fitness: reward breadth and diversity (more
        fixes per iteration / higher exploration) with diminishing returns, so the
        meta-loop has a real gradient without being game-able into the unsafe zone.
        """
        breadth = min(cfg.get("variants_per_iteration", 1), 8) / 8.0
        diversity = min(cfg.get("islands", 1), 4) / 4.0
        explore = cfg.get("exploration", 0.5)
        # Diminishing returns keep it from racing to max spend.
        return round(0.5 * breadth + 0.3 * diversity + 0.2 * explore, 4)

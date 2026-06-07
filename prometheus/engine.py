"""
L1 — Evolution Engine: the eval-gated generate -> evaluate -> promote -> archive
loop (CLAUDE.md §3, §4, §5).

Not greedy hill-climbing: an island model (parallel populations) over a
MAP-Elites archive (one elite per behavior niche) preserves diversity and escapes
local optima. A variant is PROMOTED only if it beats the current best AND keeps
the suite green (regression) AND passes the reward-hacking guard. The previous
best is archived with its score; the lineage is never overwritten.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

from .archive import Archive
from .config import Config
from .evaluator import EvalResult, Evaluator
from .generator import Generator, Variant, make_generator
from .safety import CapTracker, SafetyError, SafetyManager
from .sandbox import Sandbox
from .skills import SkillLibrary
from .telemetry import Telemetry


@dataclass
class ImproveSummary:
    target: str
    baseline_score: float
    baseline_cov: float
    final_score: float
    final_cov: float
    generations: int
    promoted_id: Optional[str]
    promoted_path: Optional[str]
    archived_count: int
    flags: List[str] = field(default_factory=list)
    promoted: bool = False


class EvolutionEngine:
    def __init__(
        self,
        cfg: Config,
        safety: SafetyManager,
        *,
        evaluator: Evaluator,
        generator: Optional[Generator] = None,
        archive: Optional[Archive] = None,
        skills: Optional[SkillLibrary] = None,
        telemetry: Optional[Telemetry] = None,
    ):
        self.cfg = cfg
        self.safety = safety
        self.evaluator = evaluator
        self.generator = generator or make_generator(cfg)
        self.archive = archive or Archive(cfg.archive_db)
        self.skills = skills or SkillLibrary(cfg.skills_db)
        self.telemetry = telemetry or Telemetry(cfg.trace_log)

    # ------------------------------------------------------------------ #
    def improve(
        self, target: str, *, max_iter: Optional[int] = None, approval_token: Optional[str] = None
    ) -> ImproveSummary:
        # ---- Pre-flight gates (L0) ----
        self.safety.assert_integrity()
        self.safety.check_alive()
        if self.safety.is_production_target(target):
            # Production targets are HARD-GATED (CLAUDE.md §4).
            self.safety.require_approval(f"improve-{target}", approval_token)

        caps = CapTracker(self.cfg)
        max_iter = max_iter or self.cfg.caps.max_iterations
        self.telemetry.event("improve_start", target=target, offline=self.cfg.offline)

        # ---- Baseline ----
        baseline = self._eval_variant(target, None)
        best_result = baseline
        best_genes: List[str] = []
        best_variant: Optional[Variant] = None
        self.telemetry.event(
            "baseline", target=target, score=baseline.scalar, cov=baseline.total_coverage
        )

        flags: List[str] = []
        stale = 0
        gen = 0
        for gen in range(1, max_iter + 1):
            try:
                caps.tick_iteration()
                self.safety.check_alive()
            except SafetyError as exc:
                flags.append(f"halted: {exc}")
                break

            improved_this_gen = False
            for island in range(self.cfg.caps.islands):
                variants = self.generator.generate(
                    target, parent_genes=best_genes, failures=self._failures(best_result),
                    n=self.cfg.caps.variants_per_iteration, seed=gen * 1000 + island,
                )
                for variant in variants:
                    variant.parent_id = best_variant.id if best_variant else None
                    result = self._eval_variant(target, variant)
                    # Internal sandbox evals are bounded by the iteration cap; the
                    # per-minute rate cap governs EXTERNAL calls (the live
                    # generator), so we do not count internal evals against it.

                    promotable, why = self._is_promotable(variant, result, best_result)
                    self.archive.add(
                        variant, result, island=island, generation=gen,
                        promoted=promotable,
                    )
                    self.telemetry.event(
                        "variant", id=variant.id, island=island, generation=gen,
                        score=result.scalar, cov=result.total_coverage,
                        promotable=promotable, why=why,
                    )
                    if promotable:
                        best_result = result
                        best_genes = list(variant.genes)
                        best_variant = variant
                        improved_this_gen = True
                        if "reward-hack" in why:
                            flags.append(why)

            # Island migration is implicit: best_genes is shared as the seed
            # parent across islands (periodic convergence point).
            stale = 0 if improved_this_gen else stale + 1
            self.telemetry.event(
                "generation", generation=gen, best_score=best_result.scalar,
                best_cov=best_result.total_coverage, stale=stale,
            )
            if best_result.scalar >= 1.0:
                flags.append("all assertions satisfied")
                break
            if stale >= 2:
                flags.append(
                    "no improvement for 2 generations — eval may be saturating "
                    "(harden the judge; requires APPROVED-EVAL-<date>)"
                )
                break

        # ---- Promotion to the live tree (additive, non-production) ----
        promoted = False
        promoted_path = None
        if best_variant is not None and best_result.scalar > baseline.scalar:
            promoted_path = self._promote_to_repo(best_variant, best_result)
            self.archive.mark_promoted(target, best_variant.id)
            self._admit_skill(target, best_variant, best_result)
            promoted = True
            self.telemetry.event(
                "promote", id=best_variant.id, path=promoted_path,
                score=best_result.scalar, cov=best_result.total_coverage,
            )

        lineage = self.archive.lineage(target)
        self.telemetry.event("improve_end", target=target, promoted=promoted)
        return ImproveSummary(
            target=target,
            baseline_score=baseline.scalar, baseline_cov=baseline.total_coverage,
            final_score=best_result.scalar, final_cov=best_result.total_coverage,
            generations=gen, promoted_id=best_variant.id if best_variant else None,
            promoted_path=promoted_path, archived_count=len(lineage),
            flags=flags, promoted=promoted,
        )

    # ------------------------------------------------------------------ #
    def _eval_variant(self, target: str, variant: Optional[Variant]) -> EvalResult:
        """Evaluate a variant in an isolated sandbox (HEAD checkout)."""
        name = f"{target}-{variant.id}" if variant else f"{target}-baseline"
        name = name.replace("/", "_")[:60]
        with Sandbox(self.cfg, self.safety, name=name, dry_run=False) as sb:
            if variant is not None:
                sb.write(variant.rel_path, variant.content)
            assert sb.root is not None
            return self.evaluator.evaluate(sb.root)

    def _is_promotable(self, variant: Variant, result: EvalResult, best: EvalResult):
        if not result.suite_green:
            return False, "suite red (regression gate)"
        if result.scalar <= best.scalar and result.total_coverage <= best.total_coverage:
            return False, "does not beat current best"
        # Reward-hacking guard: a higher score must come with real assertions.
        strength = self.evaluator.structural_strength(
            [Path(self._tmp_strength_file(variant))]
        )
        if strength == 0 and result.scalar > best.scalar:
            return False, "reward-hack: score up with zero assertions (rejected + flagged)"
        return True, "beats best with green suite"

    def _tmp_strength_file(self, variant: Variant) -> str:
        # The variant content is the test file; measure strength on its text by
        # writing to a throwaway path under the state dir.
        p = self.cfg.state_dir / "_strength_probe.py"
        p.write_text(variant.content, encoding="utf-8")
        return str(p)

    def _failures(self, result: EvalResult) -> List[str]:
        return [c.detail for c in result.cases if not c.passed]

    def _promote_to_repo(self, variant: Variant, result: EvalResult) -> str:
        """
        Write the winning variant into the live tree (additive test file — a
        non-production component, allowed without a token per §4). Archive any
        previous evolved file WITH its score before overwriting.
        """
        dest = self.cfg.repo_root / variant.rel_path
        if dest.exists():
            self._archive_previous(dest)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(variant.content, encoding="utf-8")
        self.safety.audit.record(
            "engine", "promote", args=variant.id,
            result={"path": variant.rel_path, "cov": result.total_coverage}, approved=True,
        )
        return variant.rel_path

    def _archive_previous(self, dest: Path) -> None:
        import shutil
        import time

        archive_dir = self.cfg.repo_root / "archive"
        archive_dir.mkdir(exist_ok=True)
        # Try to recover a score tag from the current best in the DB.
        target_guess = dest.stem
        rec = None
        for t in self.archive.all_targets():
            rec = self.archive.best(t)
            if rec:
                break
        score_tag = f"score{int((rec.total_cov if rec else 0))}"
        stamp = time.strftime("%Y%m%d-%H%M%S")
        out = archive_dir / f"{dest.stem}.{score_tag}.{stamp}.py"
        shutil.copy2(dest, out)

    def _admit_skill(self, target: str, variant: Variant, result: EvalResult) -> None:
        """Admit the winning strategy as a verified skill (Voyager admission rule)."""
        try:
            self.skills.add_skill(
                name=f"evolved::{target}::{variant.id}",
                description=(
                    f"Test-evolution strategy that raised {target} coverage to "
                    f"{result.total_coverage:.0f}% using genes: {', '.join(variant.genes)}"
                ),
                code=variant.content,
                verified=result.suite_green,
                eval_score=result.scalar,
            )
        except ValueError:
            pass  # admission refused (not verified) — correct, skip silently

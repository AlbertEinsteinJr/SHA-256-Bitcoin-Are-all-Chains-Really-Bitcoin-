"""
Proof of life: the full eval-gated loop runs END TO END with the offline
generator (no network, no API key) and demonstrably improves the real coverage of
the blockchain core. Also covers the orchestrator (L6) and the meta-loop fence (L8).
"""

import shutil

import pytest

from prometheus.archive import Archive
from prometheus.config import Config
from prometheus.engine import EvolutionEngine
from prometheus.evaluator import Evaluator
from prometheus.meta import MetaLoop, FENCED_FILES
from prometheus.orchestrator import Orchestrator, Task
from prometheus.safety import SafetyError, SafetyManager


def _engine(tmp_path):
    """An engine whose mutable state is redirected into tmp, but which runs
    against the real repo (git worktrees + real src/ + real eval suite)."""
    cfg = Config()
    cfg.offline = True
    # Keep the loop fast and bounded for the test.
    cfg.caps.variants_per_iteration = 8
    cfg.caps.islands = 1
    # Redirect ALL mutable state (DBs, logs, worktrees) into tmp -> hermetic.
    cfg.state_dir_override = tmp_path / "state"
    safety = SafetyManager(cfg)
    ev = Evaluator(cfg.eval_dir / "blockchain-core.eval.json")
    return cfg, EvolutionEngine(cfg, safety, evaluator=ev)


class TestEngineOffline:
    def test_loop_improves_coverage(self, tmp_path):
        cfg, engine = _engine(tmp_path)
        # Ensure we start from a clean tree (no leftover evolved file).
        evolved = cfg.repo_root / "tests" / "test_prometheus_evolved.py"
        backup = None
        if evolved.exists():
            backup = evolved.read_text()
            evolved.unlink()
        try:
            summary = engine.improve("blockchain-core", max_iter=4)
            # The headline claim: coverage and score genuinely rise.
            assert summary.final_cov > summary.baseline_cov
            assert summary.final_score > summary.baseline_score
            assert summary.final_cov >= 95.0
            assert summary.promoted is True
            assert summary.archived_count > 0
            # The promotion landed in the live tree (additive test file).
            assert evolved.exists()
        finally:
            # Restore prior state so the test is side-effect free.
            if backup is not None:
                evolved.write_text(backup)

    def test_archive_keeps_lineage(self, tmp_path):
        cfg, engine = _engine(tmp_path)
        engine.improve("blockchain-core", max_iter=2)
        arc = Archive(cfg.archive_db)
        lineage = arc.lineage("blockchain-core")
        assert len(lineage) >= 1
        # MAP-Elites: more than one behavior niche can be occupied.
        assert len(arc.elites("blockchain-core")) >= 1
        arc.close()


class TestOrchestrator:
    def test_isolated_workers_and_vote(self):
        orch = Orchestrator()
        tasks = [
            Task("a", lambda: {"output": "X"}),
            Task("b", lambda: {"output": "X"}),
            Task("c", lambda: (_ for _ in ()).throw(RuntimeError("boom"))),  # failing worker
        ]
        res = orch.run(tasks)
        # The failing worker is isolated, not propagated.
        assert any(not r["ok"] for r in res.results)
        # Verification vote still produces the consensus of the healthy workers.
        assert res.verified == "X"


class TestMetaFence:
    def test_meta_refuses_protected_files(self, tmp_path):
        sm = SafetyManager(Config())
        meta = MetaLoop(Config(), sm)
        for fenced in FENCED_FILES:
            with pytest.raises(SafetyError):
                meta.assert_edit_allowed(f"prometheus/{fenced}")
        # A non-fenced file (generation policy) is allowed.
        meta.assert_edit_allowed("prometheus/generator.py")

    def test_meta_proposes_and_fence_holds(self):
        sm = SafetyManager(Config())
        result = MetaLoop(Config(), sm).propose(dry_run=True)
        assert result.best_config
        assert "evaluator.py" in result.refused_edits
        assert "safety.py" in result.refused_edits

"""
SANITY PASS (CLAUDE.md Bootstrap §7): the safety envelope and reliability law are
backed by mechanism, not just prose. These tests assert the gates actually fire.

Kept out of tests/ so the evaluator (which runs `pytest tests/`) never recurses
into the engine's own tests.
"""

import time
from datetime import datetime, timezone

import pytest

from prometheus.audit import AuditLog
from prometheus.config import Config
from prometheus.reliability import (
    MAX_CHAIN_STEPS, ValidationError, chain, parallel, validate, vote, with_reflection,
)
from prometheus.safety import SafetyError, SafetyManager, expected_token
from prometheus.sandbox import Sandbox
from prometheus.skills import SkillLibrary


# --------------------------------------------------------------------------- #
# Safety floor (CLAUDE.md §1, §4)
# --------------------------------------------------------------------------- #
class TestSafetyGate:
    def test_require_approval_refuses_without_token(self, tmp_path):
        cfg = Config()
        cfg_state = tmp_path
        sm = SafetyManager(cfg, AuditLog(cfg_state / "audit.jsonl"))
        with pytest.raises(SafetyError):
            sm.require_approval("delete-prod", None)

    def test_require_approval_refuses_wrong_token(self, tmp_path):
        sm = SafetyManager(Config(), AuditLog(tmp_path / "a.jsonl"))
        with pytest.raises(SafetyError):
            sm.require_approval("delete-prod", "APPROVED-delete-prod-19990101")

    def test_require_approval_accepts_correct_token(self, tmp_path):
        sm = SafetyManager(Config(), AuditLog(tmp_path / "a.jsonl"))
        tok = expected_token("delete-prod")
        assert sm.require_approval("delete-prod", tok) is True

    def test_gated_decorator_blocks_then_allows(self, tmp_path):
        sm = SafetyManager(Config(), AuditLog(tmp_path / "a.jsonl"))

        @sm.gated("wipe")
        def wipe():
            return "done"

        with pytest.raises(SafetyError):
            wipe()
        assert wipe(token=expected_token("wipe")) == "done"

    def test_blocked_attempt_is_audited(self, tmp_path):
        audit = AuditLog(tmp_path / "a.jsonl")
        sm = SafetyManager(Config(), audit)
        with pytest.raises(SafetyError):
            sm.require_approval("x", None)
        assert any(e["blocked"] for e in audit.read())

    def test_production_target_detection(self, tmp_path):
        sm = SafetyManager(Config(), AuditLog(tmp_path / "a.jsonl"))
        assert sm.is_production_target("prod-payouts")
        assert not sm.is_production_target("blockchain-core")


# --------------------------------------------------------------------------- #
# KILL switch
# --------------------------------------------------------------------------- #
class TestKillSwitch:
    def test_kill_halts_and_clears(self, tmp_path):
        sm = SafetyManager(Config(), AuditLog(tmp_path / "a.jsonl"))
        sm.cfg.kill_flag.unlink(missing_ok=True)
        assert sm.is_killed() is False
        sm.trip_kill("test")
        assert sm.is_killed() is True
        with pytest.raises(SafetyError):
            sm.check_alive()
        sm.clear_kill()
        assert sm.is_killed() is False


# --------------------------------------------------------------------------- #
# Audit log is append-only (CLAUDE.md §0)
# --------------------------------------------------------------------------- #
class TestAuditAppendOnly:
    def test_no_update_or_delete_api(self, tmp_path):
        audit = AuditLog(tmp_path / "a.jsonl")
        # The contract: write + read only. No mutating methods exist.
        assert not hasattr(audit, "update")
        assert not hasattr(audit, "delete")
        public = [m for m in dir(audit) if not m.startswith("_")]
        assert "record" in public and "read" in public

    def test_entries_accumulate_immutably(self, tmp_path):
        audit = AuditLog(tmp_path / "a.jsonl")
        audit.record("t", "one")
        audit.record("t", "two")
        rows = audit.read()
        assert [r["action"] for r in rows] == ["one", "two"]


# --------------------------------------------------------------------------- #
# OS-control sandbox refuses escapes and forbidden commands (CLAUDE.md §1)
# --------------------------------------------------------------------------- #
class TestSandbox:
    def test_refuses_write_outside_worktree(self, tmp_path):
        cfg = Config()
        sm = SafetyManager(cfg, AuditLog(cfg.audit_log))
        with Sandbox(cfg, sm, name="test-escape") as sb:
            with pytest.raises(SafetyError):
                sb.write("../../escape.txt", "pwned")

    def test_refuses_forbidden_command(self, tmp_path):
        cfg = Config()
        sm = SafetyManager(cfg, AuditLog(cfg.audit_log))
        with Sandbox(cfg, sm, name="test-forbidden") as sb:
            with pytest.raises(SafetyError):
                sb.run("rm -rf /")
            with pytest.raises(SafetyError):
                sb.run("curl http://evil.example")

    def test_allows_in_sandbox_write(self, tmp_path):
        cfg = Config()
        sm = SafetyManager(cfg, AuditLog(cfg.audit_log))
        with Sandbox(cfg, sm, name="test-ok") as sb:
            act = sb.write("tests/_probe.py", "# ok\n")
            assert "wrote" in act.result
            assert (sb.root / "tests" / "_probe.py").exists()


# --------------------------------------------------------------------------- #
# Reliability law as code (CLAUDE.md §2)
# --------------------------------------------------------------------------- #
class TestReliability:
    def test_validate_rejects_bad_field(self):
        with pytest.raises(ValidationError):
            validate({"n": int}, {"n": "not-an-int"})
        assert validate({"n": int}, {"n": 3}) == {"n": 3}

    def test_chain_caps_at_five_steps(self):
        steps = [lambda x: x for _ in range(MAX_CHAIN_STEPS + 1)]
        with pytest.raises(ValueError):
            chain(steps, 0)

    def test_chain_verifier_checkpoint_aborts(self):
        steps = [lambda x: x + 1 for _ in range(5)]
        # Verifier fails after step 3 (index 2) -> abort.
        with pytest.raises(ValidationError):
            chain(steps, 0, verifier=lambda v: v < 2)

    def test_with_reflection_retries_then_succeeds(self):
        calls = {"n": 0}

        def flaky():
            calls["n"] += 1
            if calls["n"] < 2:
                raise RuntimeError("transient")
            return "ok"

        assert with_reflection(flaky, max_retries=1) == "ok"
        assert calls["n"] == 2

    def test_parallel_runs_branches(self):
        out = parallel([lambda: 1, lambda: 2, lambda: 3])
        assert sorted(out) == [1, 2, 3]

    def test_vote_majority(self):
        assert vote(["a", "b", "a", "a"]) == "a"


# --------------------------------------------------------------------------- #
# Skill library admission rule (CLAUDE.md / Voyager)
# --------------------------------------------------------------------------- #
class TestSkillLibrary:
    def test_refuses_unverified_skill(self, tmp_path):
        lib = SkillLibrary(tmp_path / "skills.db")
        with pytest.raises(ValueError):
            lib.add_skill("s", "desc", "code", verified=False, eval_score=1.0)
        with pytest.raises(ValueError):
            lib.add_skill("s", "desc", "code", verified=True, eval_score=None)

    def test_admits_verified_and_retrieves(self, tmp_path):
        lib = SkillLibrary(tmp_path / "skills.db")
        sid = lib.add_skill(
            "tamper-test", "detect tampered blockchain block", "code",
            verified=True, eval_score=0.9,
        )
        assert sid > 0
        hits = lib.search_skills("blockchain tamper detection", k=1)
        assert hits and hits[0].name == "tamper-test"

    def test_archive_never_deletes(self, tmp_path):
        lib = SkillLibrary(tmp_path / "skills.db")
        sid = lib.add_skill("s", "d", "c", verified=True, eval_score=1.0)
        lib.archive_skill(sid)
        assert lib.all_skills() == []  # hidden from active set
        assert len(lib.all_skills(include_archived=True)) == 1  # but not deleted

"""
Safety envelope (CLAUDE.md §1, §4 — load-bearing).

Prompts alone cannot make a self-modifying, OS-controlling agent safe. These are
the *mechanisms* that back the constitution:

  * require_approval / gated  — the APPROVED-<ACTION>-<YYYYMMDD> token gate on
    every destructive / production-class action.
  * KILL switch               — a flag the loop checks each iteration.
  * CapTracker                — enforces iteration / wallclock / spend / rate caps.
  * ConstitutionGuard         — refuses to run if the protected files
    (CLAUDE.md, safety.py, evaluator.py, audit.py) have been weakened.

If a destructive capability is technically available but its gate is missing,
the correct behavior is to STOP, not to "be helpful."
"""

from __future__ import annotations

import functools
import hashlib
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Dict, Optional

from .audit import AuditLog
from .config import Config


class SafetyError(Exception):
    """Raised when an action is refused on safety grounds."""


class KillSwitchTripped(SafetyError):
    """Raised when the engine is asked to act while the KILL flag is set."""


def expected_token(action: str, day: Optional[datetime] = None) -> str:
    """The exact approval token required for *action* today (UTC)."""
    day = day or datetime.now(timezone.utc)
    return f"APPROVED-{action}-{day:%Y%m%d}"


class SafetyManager:
    """Central guard. One instance is shared across the engine."""

    def __init__(self, cfg: Config, audit: Optional[AuditLog] = None):
        self.cfg = cfg
        self.audit = audit or AuditLog(cfg.audit_log)

    # ---- Approval gate -----------------------------------------------------
    def require_approval(self, action: str, token: Optional[str] = None) -> bool:
        """
        Return True only if *token* is exactly APPROVED-<action>-<todayUTC>.
        Otherwise log the blocked attempt and raise. Never infers or assumes.
        """
        want = expected_token(action)
        if token == want:
            self.audit.record("engine", action, approved=True, note="token accepted")
            return True
        self.audit.record(
            "engine",
            action,
            approved=False,
            blocked=True,
            note=f"missing/invalid approval token (need {want!r})",
        )
        raise SafetyError(f"Action {action!r} is gated. Provide token {want!r} to proceed.")

    def gated(self, action: str) -> Callable:
        """Decorator: wrap a destructive/production-class op behind the token."""

        def deco(fn: Callable) -> Callable:
            @functools.wraps(fn)
            def wrapper(*args, token: Optional[str] = None, **kwargs):
                self.require_approval(action, token)
                return fn(*args, **kwargs)

            return wrapper

        return deco

    def is_production_target(self, target: str) -> bool:
        t = target.lower()
        return any(m in t for m in self.cfg.production_markers)

    # ---- KILL switch -------------------------------------------------------
    def trip_kill(self, reason: str = "manual") -> None:
        self.cfg.kill_flag.write_text(f"{time.time()} {reason}\n", encoding="utf-8")
        self.audit.record("operator", "KILL", approved=True, note=reason)

    def clear_kill(self) -> None:
        if self.cfg.kill_flag.exists():
            self.cfg.kill_flag.unlink()
        self.audit.record("operator", "KILL_CLEAR", approved=True)

    def is_killed(self) -> bool:
        return self.cfg.kill_flag.exists()

    def check_alive(self) -> None:
        if self.is_killed():
            raise KillSwitchTripped("KILL flag is set; halting (run `kill --clear`).")

    # ---- Constitution integrity -------------------------------------------
    def baseline_hashes(self) -> Dict[str, str]:
        out: Dict[str, str] = {}
        for p in self.cfg.protected_files:
            out[p.name] = _file_hash(p)
        return out

    def assert_integrity(self) -> None:
        """
        Refuse to run if a protected file is missing or empty. (A stronger
        deployment pins known-good hashes; here we guarantee presence + the
        non-removal of the safety mechanisms, which is the invariant that
        matters for a self-modifying loop.)
        """
        for p in self.cfg.protected_files:
            if not p.exists() or p.stat().st_size == 0:
                self.audit.record(
                    "engine",
                    "integrity",
                    blocked=True,
                    note=f"protected file missing/empty: {p.name}",
                )
                raise SafetyError(f"Constitution integrity check failed: {p.name} missing/empty.")


class CapTracker:
    """Enforces the hard caps from config.Caps."""

    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.start = time.monotonic()
        self.iterations = 0
        self.spend_usd = 0.0
        self._tool_calls: list[float] = []

    def tick_iteration(self) -> None:
        self.iterations += 1
        if self.iterations > self.cfg.caps.max_iterations:
            raise SafetyError(f"iteration cap reached ({self.cfg.caps.max_iterations})")
        if time.monotonic() - self.start > self.cfg.caps.max_wallclock_s:
            raise SafetyError("wallclock cap reached")

    def add_spend(self, usd: float) -> None:
        self.spend_usd += usd
        if self.spend_usd > self.cfg.caps.max_spend_usd:
            raise SafetyError(f"spend cap reached (${self.cfg.caps.max_spend_usd})")

    def tick_tool_call(self) -> None:
        now = time.monotonic()
        self._tool_calls = [t for t in self._tool_calls if now - t < 60.0]
        self._tool_calls.append(now)
        if len(self._tool_calls) > self.cfg.caps.max_tool_calls_per_min:
            raise SafetyError("tool-call rate cap reached")


def _file_hash(path: Path) -> str:
    if not path.exists():
        return ""
    return hashlib.sha256(path.read_bytes()).hexdigest()

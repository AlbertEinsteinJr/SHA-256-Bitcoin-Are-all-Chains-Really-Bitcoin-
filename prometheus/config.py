"""
Configuration: paths, hard caps, capability allowlist, feature flags.

Everything that governs *how far* and *how fast* the engine may go lives here so
it is auditable in one place. Caps are enforced by safety.py, not merely
documented (CLAUDE.md §3 / §4).
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional


def _repo_root() -> Path:
    """Locate the repository root (the directory containing this package)."""
    return Path(__file__).resolve().parent.parent


@dataclass
class Caps:
    """Hard resource ceilings. The loop checks these every iteration."""

    max_iterations: int = 20
    max_wallclock_s: float = 600.0
    max_spend_usd: float = 5.0
    max_tool_calls_per_min: int = 30
    # Generation breadth per iteration (AlphaEvolve "breadth").
    variants_per_iteration: int = 4
    # Island model.
    islands: int = 2
    migration_every: int = 3


@dataclass
class Config:
    """Top-level engine configuration."""

    repo_root: Path = field(default_factory=_repo_root)
    caps: Caps = field(default_factory=Caps)

    # Default to offline so the entire engine runs with no network or API keys.
    offline: bool = True
    # The frozen model the live generator talks to (see docs/claude-api guidance).
    model: str = "claude-opus-4-8"
    # Redirect all mutable state (DBs, logs, worktrees) — used by tests for
    # hermetic isolation. When None, state lives in <repo>/.prometheus.
    state_dir_override: Optional[Path] = None

    # ---- Capability allowlist (defense in depth with the sandbox chokepoint) ----
    # Commands the sandbox may execute (first token of the command).
    allowed_commands: List[str] = field(
        default_factory=lambda: ["python", "python3", "pytest", "git", "coverage"]
    )
    # Substrings that, if present in any command, are hard-refused everywhere.
    forbidden_fragments: List[str] = field(
        default_factory=lambda: [
            "rm -rf", "rm -r", "mkfs", "dd ", ":(){", "shutdown", "reboot",
            "DROP TABLE", "DROP DATABASE", "--force", "-f origin", "push --force",
            "curl ", "wget ", "nc ", "sudo ",
        ]
    )

    # ---- Production bright line (CLAUDE.md §4) ----
    # Any target whose name matches one of these is HARD-GATED (needs a token).
    production_markers: List[str] = field(
        default_factory=lambda: ["prod", "production", "live", "payout", "dot-compliance"]
    )

    # ---- Derived paths ----
    @property
    def src_dir(self) -> Path:
        return self.repo_root / "src"

    @property
    def eval_dir(self) -> Path:
        return self.repo_root / "eval"

    @property
    def state_dir(self) -> Path:
        d = self.state_dir_override or (self.repo_root / ".prometheus")
        d.mkdir(parents=True, exist_ok=True)
        return d

    @property
    def archive_db(self) -> Path:
        return self.state_dir / "archive.db"

    @property
    def skills_db(self) -> Path:
        return self.state_dir / "skills.db"

    @property
    def audit_log(self) -> Path:
        return self.state_dir / "audit.jsonl"

    @property
    def trace_log(self) -> Path:
        return self.state_dir / "traces.jsonl"

    @property
    def kill_flag(self) -> Path:
        return self.state_dir / "KILL"

    @property
    def worktrees_dir(self) -> Path:
        d = self.state_dir / "worktrees"
        d.mkdir(exist_ok=True)
        return d

    # Files whose integrity gates the engine (CLAUDE.md self-check).
    @property
    def protected_files(self) -> List[Path]:
        pkg = self.repo_root / "prometheus"
        return [
            self.repo_root / "CLAUDE.md",
            pkg / "safety.py",
            pkg / "evaluator.py",
            pkg / "audit.py",
        ]


def load_config() -> Config:
    """Build a Config, honoring a few environment overrides."""
    cfg = Config()
    if os.environ.get("PROMETHEUS_ONLINE") == "1":
        cfg.offline = False
    if "PROMETHEUS_MODEL" in os.environ:
        cfg.model = os.environ["PROMETHEUS_MODEL"]
    return cfg

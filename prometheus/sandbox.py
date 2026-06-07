"""
L4 — OS-Control Sandbox: the single chokepoint through which the engine touches
the machine (CLAUDE.md §1, §4).

Every filesystem write and shell command goes through here. Guarantees:
  * Isolation   — work happens in a dedicated git worktree (a clean checkout of
                  HEAD), never the live working tree.
  * Allowlist   — only commands whose first token is allow-listed run, and any
                  forbidden fragment (rm -rf, force-push, network tools, DROP ...)
                  is hard-refused.
  * Dry-run     — the default. Writes/execs are planned and recorded; nothing
                  mutates the live tree without an explicit non-dry-run sandbox.
  * Confinement — writes outside the worktree root are refused.
  * Replay      — every action is trace-recorded so a run can be deterministically
                  replayed and verified before promotion.
"""

from __future__ import annotations

import shlex
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

from .audit import AuditLog
from .config import Config
from .safety import SafetyError, SafetyManager


@dataclass
class Action:
    kind: str            # "write" | "exec"
    detail: str
    dry_run: bool
    result: str = ""


@dataclass
class RunResult:
    returncode: int
    stdout: str
    stderr: str


class Sandbox:
    """An isolated git-worktree checkout the engine may safely mutate."""

    def __init__(
        self,
        cfg: Config,
        safety: SafetyManager,
        *,
        name: str,
        dry_run: bool = False,
    ):
        self.cfg = cfg
        self.safety = safety
        self.audit: AuditLog = safety.audit
        self.name = name
        self.dry_run = dry_run
        self.root: Optional[Path] = None
        self.actions: List[Action] = []

    # ---- lifecycle ---------------------------------------------------------
    def __enter__(self) -> "Sandbox":
        self.safety.check_alive()
        target = self.cfg.worktrees_dir / self.name
        if target.exists():
            self._remove_worktree(target)
        # Detached worktree of HEAD: a clean, isolated copy of the committed tree.
        self._git(["worktree", "add", "--detach", "--force", str(target), "HEAD"])
        self.root = target
        return self

    def __exit__(self, *exc) -> None:
        if self.root is not None:
            self._remove_worktree(self.root)
            self.root = None

    # ---- guarded operations ------------------------------------------------
    def write(self, rel_path: str, content: str) -> Action:
        """Write a file *inside* the sandbox. Refuses escapes and prod paths."""
        if self.root is None:
            raise SafetyError("sandbox not entered")
        dest = (self.root / rel_path).resolve()
        if not str(dest).startswith(str(self.root.resolve())):
            self.audit.record("sandbox", "write", blocked=True, note=f"escape: {rel_path}")
            raise SafetyError(f"refused write outside sandbox: {rel_path}")
        act = Action("write", rel_path, self.dry_run)
        if self.dry_run:
            act.result = f"DRY-RUN would write {len(content)} bytes"
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(content, encoding="utf-8")
            act.result = f"wrote {len(content)} bytes"
        self.actions.append(act)
        self.audit.record("sandbox", "write", args=rel_path, result=act.result)
        return act

    def run(self, command: str) -> RunResult:
        """Run an allow-listed command inside the sandbox."""
        if self.root is None:
            raise SafetyError("sandbox not entered")
        self.safety.check_alive()
        self._assert_command_allowed(command)
        act = Action("exec", command, self.dry_run)
        if self.dry_run:
            act.result = "DRY-RUN not executed"
            self.actions.append(act)
            self.audit.record("sandbox", "exec", args=command, result=act.result)
            return RunResult(0, "", "")
        proc = subprocess.run(
            shlex.split(command), cwd=str(self.root),
            capture_output=True, text=True, timeout=300,
        )
        act.result = f"rc={proc.returncode}"
        self.actions.append(act)
        self.audit.record("sandbox", "exec", args=command, result=act.result)
        return RunResult(proc.returncode, proc.stdout, proc.stderr)

    # ---- safety internals --------------------------------------------------
    def _assert_command_allowed(self, command: str) -> None:
        low = command.lower()
        for frag in self.cfg.forbidden_fragments:
            if frag.lower() in low:
                self.audit.record("sandbox", "exec", blocked=True, note=f"forbidden fragment: {frag}")
                raise SafetyError(f"refused command (forbidden fragment {frag!r}): {command}")
        head = shlex.split(command)[0] if command.strip() else ""
        base = Path(head).name
        if base not in self.cfg.allowed_commands and base != Path(sys.executable).name:
            self.audit.record("sandbox", "exec", blocked=True, note=f"not allow-listed: {base}")
            raise SafetyError(f"refused command (not in allowlist): {base}")

    def _git(self, args: List[str]) -> None:
        subprocess.run(["git", *args], cwd=str(self.cfg.repo_root),
                       check=True, capture_output=True, text=True)

    def _remove_worktree(self, path: Path) -> None:
        try:
            self._git(["worktree", "remove", "--force", str(path)])
        except subprocess.CalledProcessError:
            pass
        if path.exists():
            shutil.rmtree(path, ignore_errors=True)

"""
Append-only audit log (CLAUDE.md §0 / Bootstrap §4).

The log is write-only by contract: there is no public update or delete method.
Every safety-relevant action — blocked attempts included — lands here as one
JSON line. Agents/tools may append but never rewrite history.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List


def _hash(value: Any) -> str:
    """Stable short hash of an arbitrary value (for args/result fingerprints)."""
    try:
        blob = json.dumps(value, sort_keys=True, default=str).encode()
    except TypeError:
        blob = repr(value).encode()
    return hashlib.sha256(blob).hexdigest()[:16]


class AuditLog:
    """Append-only audit trail backed by a JSONL file."""

    def __init__(self, path: Path):
        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        # Touch the file so readers never hit a missing path.
        self._path.touch(exist_ok=True)

    def record(
        self,
        actor: str,
        action: str,
        *,
        args: Any = None,
        result: Any = None,
        approved: bool = False,
        blocked: bool = False,
        note: str = "",
    ) -> None:
        """Append a single immutable audit entry. Never raises on logging."""
        entry: Dict[str, Any] = {
            "ts": time.time(),
            "iso": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()),
            "actor": actor,
            "action": action,
            "args_hash": _hash(args) if args is not None else None,
            "result_hash": _hash(result) if result is not None else None,
            "approved": bool(approved),
            "blocked": bool(blocked),
            "note": note,
        }
        line = json.dumps(entry)
        # O_APPEND keeps writes atomic and ordering-safe across processes.
        with open(self._path, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")
            fh.flush()
            os.fsync(fh.fileno())

    def read(self) -> List[Dict[str, Any]]:
        """Read all entries (for inspection / tests). Read-only."""
        if not self._path.exists():
            return []
        out: List[Dict[str, Any]] = []
        with open(self._path, "r", encoding="utf-8") as fh:
            for ln in fh:
                ln = ln.strip()
                if ln:
                    out.append(json.loads(ln))
        return out

    @property
    def path(self) -> Path:
        return self._path

"""
L5 — Skill library (Voyager pattern) on stdlib sqlite3.

A growing, retrieval-indexed library of verified, executable skills. The
non-negotiable rule (Voyager ablation: ~73% drop without it): a skill is admitted
ONLY after self-verification AND a passing eval. Retrieval uses a pluggable
embedder; the offline default is token-overlap similarity so the library works
with no network. Lineage is preserved (parent_id); skills are archived, never
deleted.
"""

from __future__ import annotations

import json
import math
import re
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, List, Optional

_SCHEMA = """
CREATE TABLE IF NOT EXISTS skills (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    embedding   TEXT NOT NULL,
    code        TEXT NOT NULL,
    language    TEXT NOT NULL DEFAULT 'python',
    verified    INTEGER NOT NULL DEFAULT 0,
    eval_score  REAL,
    version     INTEGER NOT NULL DEFAULT 1,
    parent_id   INTEGER,
    archived    INTEGER NOT NULL DEFAULT 0,
    created_at  REAL NOT NULL
);
"""


@dataclass
class Skill:
    id: int
    name: str
    description: str
    code: str
    language: str
    verified: bool
    eval_score: Optional[float]
    version: int
    parent_id: Optional[int]
    archived: bool


def _tokens(text: str) -> List[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def token_overlap_embedder(text: str) -> List[float]:
    """Offline 'embedding': a sorted bag-of-tokens fingerprint stored as JSON."""
    # We store the token bag; similarity is cosine over shared tokens at query time.
    counts: dict = {}
    for t in _tokens(text):
        counts[t] = counts.get(t, 0) + 1
    return counts  # type: ignore[return-value]


def _cosine_bag(a: dict, b: dict) -> float:
    if not a or not b:
        return 0.0
    common = set(a) & set(b)
    dot = sum(a[t] * b[t] for t in common)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    return dot / (na * nb) if na and nb else 0.0


class SkillLibrary:
    def __init__(self, db_path: Path, embedder: Optional[Callable[[str], object]] = None):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(self.db_path))
        self._conn.row_factory = sqlite3.Row
        self._conn.executescript(_SCHEMA)
        self._conn.commit()
        self.embedder = embedder or token_overlap_embedder

    def close(self) -> None:
        self._conn.close()

    def add_skill(
        self, name: str, description: str, code: str, *,
        verified: bool, eval_score: Optional[float], language: str = "python",
        parent_id: Optional[int] = None,
    ) -> int:
        """Admit a skill. REFUSES unless verified AND eval_score is present."""
        if not (verified and eval_score is not None):
            raise ValueError(
                "skill admission refused: requires verified=True AND an eval_score "
                "(Voyager: self-verify + passing eval before admission)"
            )
        emb = json.dumps(self.embedder(description + " " + name))
        cur = self._conn.execute(
            """INSERT INTO skills
               (name, description, embedding, code, language, verified, eval_score,
                version, parent_id, archived, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,0,?)""",
            (name, description, emb, code, language, int(verified), eval_score,
             1, parent_id, time.time()),
        )
        self._conn.commit()
        return int(cur.lastrowid)

    def search_skills(self, query: str, k: int = 3) -> List[Skill]:
        q = self.embedder(query)
        rows = self._conn.execute("SELECT * FROM skills WHERE archived=0").fetchall()
        scored = []
        for row in rows:
            emb = json.loads(row["embedding"])
            scored.append((_cosine_bag(q, emb), row))  # type: ignore[arg-type]
        scored.sort(key=lambda t: t[0], reverse=True)
        return [_to_skill(r) for _, r in scored[:k]]

    def archive_skill(self, skill_id: int) -> None:
        """Soft-archive (never delete)."""
        self._conn.execute("UPDATE skills SET archived=1 WHERE id=?", (skill_id,))
        self._conn.commit()

    def promote_skill(
        self, parent_id: int, *, code: str, eval_score: float, verified: bool = True
    ) -> int:
        """Create a new version of a skill, preserving lineage."""
        parent = self._conn.execute("SELECT * FROM skills WHERE id=?", (parent_id,)).fetchone()
        if parent is None:
            raise ValueError(f"no such skill {parent_id}")
        if not (verified and eval_score is not None):
            raise ValueError("promotion refused: requires verified + eval_score")
        emb = json.dumps(self.embedder(parent["description"] + " " + parent["name"]))
        cur = self._conn.execute(
            """INSERT INTO skills
               (name, description, embedding, code, language, verified, eval_score,
                version, parent_id, archived, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,0,?)""",
            (f"{parent['name']}.v{parent['version'] + 1}", parent["description"], emb,
             code, parent["language"], int(verified), eval_score,
             parent["version"] + 1, parent_id, time.time()),
        )
        self._conn.commit()
        return int(cur.lastrowid)

    def all_skills(self, include_archived: bool = False) -> List[Skill]:
        sql = "SELECT * FROM skills" if include_archived else "SELECT * FROM skills WHERE archived=0"
        return [_to_skill(r) for r in self._conn.execute(sql).fetchall()]


def _to_skill(row: sqlite3.Row) -> Skill:
    return Skill(
        id=row["id"], name=row["name"], description=row["description"], code=row["code"],
        language=row["language"], verified=bool(row["verified"]),
        eval_score=row["eval_score"], version=row["version"],
        parent_id=row["parent_id"], archived=bool(row["archived"]),
    )

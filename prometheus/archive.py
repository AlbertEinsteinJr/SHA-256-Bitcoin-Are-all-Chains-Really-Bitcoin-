"""
L1 storage — the evolutionary archive (Darwin Gödel Machine principle).

Keep the *lineage*, not just HEAD. Every evaluated variant is stored with its
score, behavior descriptor, parent, island, and generation. We never overwrite —
the archive of diverse variants is the asset that lets the search escape local
optima (MAP-Elites: one elite per behavior niche).
"""

from __future__ import annotations

import json
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

_SCHEMA = """
CREATE TABLE IF NOT EXISTS variants (
    id          TEXT NOT NULL,
    target      TEXT NOT NULL,
    rel_path    TEXT NOT NULL,
    content     TEXT NOT NULL,
    genes       TEXT NOT NULL,
    score       REAL NOT NULL,
    total_cov   REAL NOT NULL,
    descriptor  TEXT NOT NULL,
    parent_id   TEXT,
    island      INTEGER NOT NULL DEFAULT 0,
    generation  INTEGER NOT NULL DEFAULT 0,
    source      TEXT NOT NULL DEFAULT 'offline',
    promoted    INTEGER NOT NULL DEFAULT 0,
    created_at  REAL NOT NULL,
    PRIMARY KEY (target, id)
);
CREATE INDEX IF NOT EXISTS idx_variants_target ON variants(target);
CREATE INDEX IF NOT EXISTS idx_variants_score ON variants(score);
"""


@dataclass
class Record:
    id: str
    target: str
    rel_path: str
    content: str
    genes: List[str]
    score: float
    total_cov: float
    descriptor: Tuple[int, ...]
    parent_id: Optional[str]
    island: int
    generation: int
    source: str
    promoted: bool
    created_at: float


class Archive:
    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(self.db_path))
        self._conn.row_factory = sqlite3.Row
        self._conn.executescript(_SCHEMA)
        self._conn.commit()

    def close(self) -> None:
        self._conn.close()

    # ---- writes ------------------------------------------------------------
    def add(
        self, variant, result, *, island: int, generation: int, promoted: bool = False
    ) -> None:
        self._conn.execute(
            """INSERT OR REPLACE INTO variants
               (id, target, rel_path, content, genes, score, total_cov, descriptor,
                parent_id, island, generation, source, promoted, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                variant.id, variant.target, variant.rel_path, variant.content,
                json.dumps(variant.genes), result.scalar, result.total_coverage,
                json.dumps(list(result.behavior_descriptor)), variant.parent_id,
                island, generation, variant.source, int(promoted), time.time(),
            ),
        )
        self._conn.commit()

    def mark_promoted(self, target: str, variant_id: str) -> None:
        self._conn.execute(
            "UPDATE variants SET promoted=1 WHERE target=? AND id=?", (target, variant_id)
        )
        self._conn.commit()

    # ---- reads -------------------------------------------------------------
    def best(self, target: str) -> Optional[Record]:
        row = self._conn.execute(
            """SELECT * FROM variants WHERE target=?
               ORDER BY score DESC, total_cov DESC, created_at ASC LIMIT 1""",
            (target,),
        ).fetchone()
        return _to_record(row) if row else None

    def elites(self, target: str) -> Dict[Tuple[int, ...], Record]:
        """MAP-Elites: best variant per behavior niche."""
        rows = self._conn.execute(
            "SELECT * FROM variants WHERE target=? ORDER BY score DESC", (target,)
        ).fetchall()
        grid: Dict[Tuple[int, ...], Record] = {}
        for row in rows:
            rec = _to_record(row)
            niche = tuple(rec.descriptor)
            cur = grid.get(niche)
            if cur is None or rec.score > cur.score:
                grid[niche] = rec
        return grid

    def lineage(self, target: str) -> List[Record]:
        rows = self._conn.execute(
            "SELECT * FROM variants WHERE target=? ORDER BY generation, created_at",
            (target,),
        ).fetchall()
        return [_to_record(r) for r in rows]

    def all_targets(self) -> List[str]:
        rows = self._conn.execute("SELECT DISTINCT target FROM variants").fetchall()
        return [r["target"] for r in rows]


def _to_record(row: sqlite3.Row) -> Record:
    return Record(
        id=row["id"], target=row["target"], rel_path=row["rel_path"],
        content=row["content"], genes=json.loads(row["genes"]), score=row["score"],
        total_cov=row["total_cov"], descriptor=tuple(json.loads(row["descriptor"])),
        parent_id=row["parent_id"], island=row["island"], generation=row["generation"],
        source=row["source"], promoted=bool(row["promoted"]), created_at=row["created_at"],
    )

"""
L7 — Observability: structured traces, scorecards, lineage-graph export.

Every loop emits one JSON line per event so a run is fully reconstructable and
deterministically replayable. The lineage exporter renders the archive as a DOT
graph (Graphviz) and as JSON.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Dict, List


class Telemetry:
    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.touch(exist_ok=True)

    def event(self, kind: str, **data: Any) -> None:
        entry = {"ts": time.time(), "kind": kind, **data}
        with open(self.path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry, default=str) + "\n")

    def read(self) -> List[Dict[str, Any]]:
        if not self.path.exists():
            return []
        out = []
        for ln in self.path.read_text(encoding="utf-8").splitlines():
            ln = ln.strip()
            if ln:
                out.append(json.loads(ln))
        return out


def sparkline(values: List[float]) -> str:
    """Render a list of values as a unicode sparkline."""
    if not values:
        return ""
    bars = "▁▂▃▄▅▆▇█"
    lo, hi = min(values), max(values)
    span = (hi - lo) or 1.0
    return "".join(bars[min(len(bars) - 1, int((v - lo) / span * (len(bars) - 1)))] for v in values)


def export_lineage_dot(archive, target: str) -> str:
    """Render an archive lineage as a Graphviz DOT string."""
    lines = ["digraph prometheus_lineage {", "  rankdir=LR; node [shape=box, fontsize=10];"]
    for rec in archive.lineage(target):
        color = "green" if rec.promoted else "gray"
        label = f"{rec.id}\\nscore={rec.score:.2f} cov={rec.total_cov:.0f}%"
        lines.append(f'  "{rec.id}" [label="{label}", color={color}];')
        if rec.parent_id:
            lines.append(f'  "{rec.parent_id}" -> "{rec.id}";')
    lines.append("}")
    return "\n".join(lines)


def export_lineage_json(archive, target: str) -> str:
    payload = [
        {
            "id": r.id,
            "parent": r.parent_id,
            "score": r.score,
            "total_cov": r.total_cov,
            "promoted": r.promoted,
            "island": r.island,
            "generation": r.generation,
            "genes": r.genes,
        }
        for r in archive.lineage(target)
    ]
    return json.dumps(payload, indent=2)

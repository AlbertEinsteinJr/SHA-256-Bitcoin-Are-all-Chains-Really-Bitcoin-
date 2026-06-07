"""
L7 — Live console dashboard (no third-party deps).

Renders current best per component, a fitness-over-generations sparkline, the
MAP-Elites niche map, recent promotions, and the blocked-action log. Plain text
so it works in any terminal, CI log, or web session.
"""

from __future__ import annotations

from typing import List

from .archive import Archive
from .audit import AuditLog
from .config import Config
from .telemetry import Telemetry, sparkline


def render_dashboard(cfg: Config) -> str:
    archive = Archive(cfg.archive_db)
    telemetry = Telemetry(cfg.trace_log)
    audit = AuditLog(cfg.audit_log)

    lines: List[str] = []
    lines.append("=" * 64)
    lines.append("  PROMETHEUS — Operator OS dashboard")
    lines.append("=" * 64)

    targets = archive.all_targets()
    if not targets:
        lines.append("  (no runs yet — try: python -m prometheus improve --target blockchain-core)")
    for target in targets:
        best = archive.best(target)
        elites = archive.elites(target)
        gen_events = [e for e in telemetry.read() if e.get("kind") == "generation"]
        spark = sparkline([e["best_cov"] for e in gen_events if "best_cov" in e])
        lines.append("")
        lines.append(f"  ▸ {target}")
        if best:
            lines.append(f"      best score : {best.score:.2f}   coverage: {best.total_cov:.1f}%")
            lines.append(f"      best id    : {best.id}  (promoted={best.promoted})")
        lines.append(f"      niches     : {len(elites)} occupied (MAP-Elites)")
        if spark:
            lines.append(f"      coverage ↗ : {spark}")

    blocked = [e for e in audit.read() if e.get("blocked")]
    lines.append("")
    lines.append(f"  blocked actions (safety) : {len(blocked)}")
    for b in blocked[-5:]:
        lines.append(f"      ✗ {b.get('action')}: {b.get('note')}")

    kill = "ARMED (KILL flag set)" if cfg.kill_flag.exists() else "clear"
    lines.append("")
    lines.append(f"  kill switch : {kill}")
    lines.append("=" * 64)
    archive.close()
    return "\n".join(lines)

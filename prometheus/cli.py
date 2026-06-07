"""
Command-line entrypoint: `python -m prometheus <command>`.

Commands:
    verify     one command, plain English: check + improve + show the result
    run        score the current repo against an eval suite (the gate)
    improve    run the eval-gated self-improvement loop on a target
    dashboard  render the live observability dashboard
    kill       arm/clear the KILL switch
    replay     replay the recorded trace of the last run
    meta       run the meta-loop (STOP) — improve the improver, fenced
    lineage    export the evolutionary lineage as DOT / JSON
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .archive import Archive
from .config import load_config
from .engine import EvolutionEngine
from .evaluator import Evaluator
from .meta import MetaLoop
from .safety import SafetyError, SafetyManager
from .telemetry import Telemetry, export_lineage_dot, export_lineage_json
from .tui import render_dashboard


def _evaluator(cfg, eval_name: str) -> Evaluator:
    path = cfg.eval_dir / f"{eval_name}.eval.json"
    if not path.exists():
        sys.exit(f"no eval file: {path}")
    return Evaluator(path)


def cmd_run(args) -> int:
    cfg = load_config()
    safety = SafetyManager(cfg)
    safety.assert_integrity()
    ev = _evaluator(cfg, args.eval)
    result = ev.evaluate(cfg.repo_root)
    print(
        f"\nEVAL: {args.eval}   score = {result.passed}/{result.total} "
        f"({result.scalar:.0%})   total coverage = {result.total_coverage:.1f}%\n"
    )
    for c in result.cases:
        mark = "PASS" if c.passed else "FAIL"
        print(f"  [{mark}] {c.id:<32} {c.detail}")
    print()
    return 0 if result.scalar >= 1.0 else 1


def cmd_improve(args) -> int:
    cfg = load_config()
    if args.online:
        cfg.offline = False
    safety = SafetyManager(cfg)
    ev = _evaluator(cfg, args.eval)
    engine = EvolutionEngine(cfg, safety, evaluator=ev)
    summary = engine.improve(args.target, max_iter=args.max_iter, approval_token=args.token)

    print("\n" + "=" * 60)
    print(f"  PROMETHEUS improve — target: {summary.target}")
    print("=" * 60)
    print(f"  baseline : score {summary.baseline_score:.0%}  coverage {summary.baseline_cov:.1f}%")
    print(f"  final    : score {summary.final_score:.0%}  coverage {summary.final_cov:.1f}%")
    print(f"  generations: {summary.generations}   archived variants: {summary.archived_count}")
    if summary.promoted:
        print(f"  PROMOTED : {summary.promoted_id} -> {summary.promoted_path}")
    else:
        print("  PROMOTED : nothing beat the baseline")
    for f in summary.flags:
        print(f"  flag     : {f}")
    print()
    return 0


def cmd_verify(args) -> int:
    """One command, plain English: check the code, improve it, show the result."""
    cfg = load_config()
    if args.online:
        cfg.offline = False
    safety = SafetyManager(cfg)
    ev = _evaluator(cfg, args.eval)
    engine = EvolutionEngine(cfg, safety, evaluator=ev)

    print("\nPROMETHEUS — one-shot verify")
    print("  Step 1/3  Checking how good the code is right now...")
    print("  Step 2/3  Improving it automatically (this can take a minute)...")
    summary = engine.improve(args.target, max_iter=args.max_iter, approval_token=args.token)

    bs, fs = summary.baseline_score, summary.final_score
    bc, fc = summary.baseline_cov, summary.final_cov
    print("\n  Step 3/3  Here's what happened:\n")
    print(f"    Before :  {bs:.0%} of checks passed   ({bc:.0f}% of the code was tested)")
    print(f"    After  :  {fs:.0%} of checks passed   ({fc:.0f}% of the code was tested)")
    print()

    if summary.promoted:
        print("    Result :  It improved the code and saved the new tests to")
        print(f"              {summary.promoted_path}")
    else:
        print("    Result :  The code was already as good as it could get — nothing changed.")

    gain = fs - bs
    if gain > 0:
        print(f"    Gain   :  a {gain:.0%} jump, done automatically.")
    print(f"    Tried  :  {summary.archived_count} versions; kept the best (full history saved).")

    if any("saturating" in f or "satisfied" in f for f in summary.flags):
        print("    Note   :  it stopped because every check is now satisfied.")

    print("\n  Done. Run `python -m prometheus dashboard` to see the scoreboard.\n")
    return 0


def cmd_dashboard(args) -> int:
    print(render_dashboard(load_config()))
    return 0


def cmd_kill(args) -> int:
    cfg = load_config()
    safety = SafetyManager(cfg)
    if args.clear:
        safety.clear_kill()
        print("KILL switch cleared.")
    else:
        safety.trip_kill(args.reason)
        print(f"KILL switch ARMED ({args.reason}). The loop halts next iteration.")
    return 0


def cmd_replay(args) -> int:
    cfg = load_config()
    events = Telemetry(cfg.trace_log).read()
    if not events:
        print("no traces recorded yet.")
        return 0
    print(f"replaying {len(events)} recorded events:\n")
    for e in events:
        kind = e.get("kind")
        if kind == "variant":
            print(
                f"  gen{e.get('generation')} {e.get('id'):<18} "
                f"score={e.get('score'):.2f} cov={e.get('cov'):.0f}% "
                f"promotable={e.get('promotable')}"
            )
        elif kind in ("baseline", "generation", "promote", "improve_start", "improve_end"):
            print(
                f"  [{kind}] "
                + ", ".join(f"{k}={v}" for k, v in e.items() if k not in ("kind", "ts"))
            )
    return 0


def cmd_meta(args) -> int:
    cfg = load_config()
    safety = SafetyManager(cfg)
    result = MetaLoop(cfg, safety).propose(dry_run=not args.apply)
    print("\nMETA-LOOP (STOP) — improving the improver (fenced):\n")
    for p in result.proposals:
        print(f"  meta_score={p['meta_score']:.3f}  config={p['config']}")
    print(f"\n  best improver config: {result.best_config}")
    print(f"  refused edits (fence held): {result.refused_edits}")
    print(f"  mode: {'DRY-RUN' if result.dry_run else 'APPLY'}\n")
    return 0


def cmd_lineage(args) -> int:
    cfg = load_config()
    archive = Archive(cfg.archive_db)
    if args.format == "dot":
        out = export_lineage_dot(archive, args.target)
    else:
        out = export_lineage_json(archive, args.target)
    if args.out:
        Path(args.out).write_text(out, encoding="utf-8")
        print(f"wrote lineage to {args.out}")
    else:
        print(out)
    archive.close()
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="prometheus", description="The Unstoppable Operator OS")
    sub = p.add_subparsers(dest="command", required=True)

    pr = sub.add_parser("run", help="score the repo against an eval suite")
    pr.add_argument("--eval", default="blockchain-core")
    pr.set_defaults(func=cmd_run)

    pi = sub.add_parser("improve", help="run the eval-gated self-improvement loop")
    pi.add_argument("--target", default="blockchain-core")
    pi.add_argument("--eval", default="blockchain-core")
    pi.add_argument("--max-iter", type=int, default=None)
    pi.add_argument("--online", action="store_true", help="use the live Claude generator")
    pi.add_argument("--token", default=None, help="APPROVED-<ACTION>-<YYYYMMDD> for gated targets")
    pi.set_defaults(func=cmd_improve)

    pv = sub.add_parser("verify", help="one command: check + improve + show (plain English)")
    pv.add_argument("--target", default="blockchain-core")
    pv.add_argument("--eval", default="blockchain-core")
    pv.add_argument("--max-iter", type=int, default=None)
    pv.add_argument("--online", action="store_true", help="use the live Claude generator")
    pv.add_argument("--token", default=None, help="APPROVED-<ACTION>-<YYYYMMDD> for gated targets")
    pv.set_defaults(func=cmd_verify)

    pd = sub.add_parser("dashboard", help="render the live dashboard")
    pd.set_defaults(func=cmd_dashboard)

    pk = sub.add_parser("kill", help="arm or clear the KILL switch")
    pk.add_argument("--clear", action="store_true")
    pk.add_argument("--reason", default="manual")
    pk.set_defaults(func=cmd_kill)

    prp = sub.add_parser("replay", help="replay recorded traces")
    prp.set_defaults(func=cmd_replay)

    pm = sub.add_parser("meta", help="run the meta-loop (STOP)")
    pm.add_argument("--apply", action="store_true", help="apply (default is dry-run)")
    pm.set_defaults(func=cmd_meta)

    pl = sub.add_parser("lineage", help="export the evolutionary lineage")
    pl.add_argument("--target", default="blockchain-core")
    pl.add_argument("--format", choices=["dot", "json"], default="dot")
    pl.add_argument("--out", default=None)
    pl.set_defaults(func=cmd_lineage)

    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except SafetyError as exc:
        # Safety refusals are expected control flow, not crashes: report cleanly.
        print(f"\n[SAFETY] {exc}\n", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

"""
L2 — Evaluator: the fitness function and the moat (CLAUDE.md §3).

You can only safely auto-improve what you can automatically score. This module
runs the real pytest suite with coverage inside a given working directory and
scores a set of BINARY assertions. It returns both a scalar (passed / total) for
promotion decisions and a behavior descriptor for MAP-Elites binning.

Assertion types (eval/*.eval.json):
    coverage     {"module": "src/chain.py", "min": 95}
    test_passes  {"name": "test_tampered_block_detected"}
    suite_green  {}                      # every collected test passes
    invariant    {"min_total": 95}       # total coverage threshold

A reward-hacking guard (CLAUDE.md §3) rejects "improvements" that raise the score
by shrinking real behavior (deleting assertions / weakening existing tests).
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class CaseResult:
    id: str
    type: str
    passed: bool
    detail: str = ""


@dataclass
class EvalResult:
    scalar: float                      # passed / total in [0, 1]
    passed: int
    total: int
    cases: List[CaseResult] = field(default_factory=list)
    coverage: Dict[str, float] = field(default_factory=dict)  # path -> percent
    total_coverage: float = 0.0
    suite_green: bool = False
    error: str = ""

    @property
    def behavior_descriptor(self) -> Tuple[int, int, int]:
        """
        MAP-Elites niche key: (coverage bucket, #modules >= 95%, suite-green bit).
        Deliberately coarse so distinct strategies land in distinct niches.
        """
        cov_bucket = int(self.total_coverage // 5)  # 5% buckets
        strong = sum(1 for v in self.coverage.values() if v >= 95.0)
        return (cov_bucket, strong, int(self.suite_green))


def load_eval(path: Path) -> List[Dict[str, Any]]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    cases = data["cases"] if isinstance(data, dict) else data
    if not isinstance(cases, list):
        raise ValueError(f"eval file {path} must contain a list of cases")
    return cases


class Evaluator:
    """Runs pytest+coverage in a workdir and scores binary assertions."""

    def __init__(self, eval_file: Path, *, timeout_s: float = 180.0):
        self.eval_file = Path(eval_file)
        self.cases = load_eval(self.eval_file)
        self.timeout_s = timeout_s

    # ---- public API --------------------------------------------------------
    def evaluate(self, workdir: Path) -> EvalResult:
        """Run the suite in *workdir* and score every assertion."""
        workdir = Path(workdir)
        cov_json = Path(tempfile.mkstemp(suffix=".json", prefix="cov_")[1])
        try:
            run = self._run_pytest(workdir, cov_json)
            coverage, total_cov = self._parse_coverage(cov_json)
            suite_green = run.returncode == 0
            passed_tests = self._collect_passed_tests(run.stdout + run.stderr)

            results: List[CaseResult] = []
            for case in self.cases:
                results.append(
                    self._score_case(case, coverage, total_cov, suite_green, passed_tests)
                )
            n_pass = sum(1 for r in results if r.passed)
            scalar = n_pass / len(results) if results else 0.0
            return EvalResult(
                scalar=scalar,
                passed=n_pass,
                total=len(results),
                cases=results,
                coverage=coverage,
                total_coverage=total_cov,
                suite_green=suite_green,
            )
        except subprocess.TimeoutExpired:
            return EvalResult(0.0, 0, len(self.cases), error="pytest timed out")
        finally:
            cov_json.unlink(missing_ok=True)

    # ---- reward-hacking guard ---------------------------------------------
    @staticmethod
    def structural_strength(test_files: List[Path]) -> int:
        """
        A crude proxy for "real behavior tested": number of assert statements plus
        test functions across the given files. A promotion that *lowers* this while
        raising the score is a reward-hacking signal.
        """
        total = 0
        for f in test_files:
            if not f.exists():
                continue
            text = f.read_text(encoding="utf-8", errors="ignore")
            total += len(re.findall(r"\bassert\b", text))
            total += len(re.findall(r"\bdef test_", text))
        return total

    # ---- internals ---------------------------------------------------------
    def _run_pytest(self, workdir: Path, cov_json: Path) -> subprocess.CompletedProcess:
        # Scope collection to the blockchain suite under tests/ so the evaluator
        # never recurses into the engine's own tests (which live in tests_meta/).
        target = "tests" if (Path(workdir) / "tests").exists() else "."
        cmd = [
            sys.executable, "-m", "pytest", "-q", "-rA", target,
            "--cov=src", f"--cov-report=json:{cov_json}",
            "-p", "no:cacheprovider",
        ]
        return subprocess.run(
            cmd, cwd=str(workdir), capture_output=True, text=True, timeout=self.timeout_s
        )

    @staticmethod
    def _parse_coverage(cov_json: Path) -> Tuple[Dict[str, float], float]:
        if not cov_json.exists():
            return {}, 0.0
        try:
            data = json.loads(cov_json.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}, 0.0
        files = data.get("files", {})
        coverage = {
            _normalize(path): float(info.get("summary", {}).get("percent_covered", 0.0))
            for path, info in files.items()
        }
        total = float(data.get("totals", {}).get("percent_covered", 0.0))
        return coverage, total

    @staticmethod
    def _collect_passed_tests(output: str) -> set:
        """
        Parse PASSED test names from pytest's `-rA` short summary, which prints
        one line per outcome, e.g.:
            PASSED tests/test_x.py::TestClass::test_name
        We only count lines whose outcome is PASSED so failing tests of the same
        name are never miscounted as present+passed.
        """
        passed = set()
        for line in output.splitlines():
            m = re.match(r"\s*PASSED\s+\S+::(test_\w+)\s*$", line)
            if m:
                passed.add(m.group(1))
        return passed

    def _score_case(
        self,
        case: Dict[str, Any],
        coverage: Dict[str, float],
        total_cov: float,
        suite_green: bool,
        passed_tests: set,
    ) -> CaseResult:
        cid = case.get("id", "?")
        ctype = case.get("type", "")
        try:
            if ctype == "coverage":
                module = _normalize(case["module"])
                got = coverage.get(module, 0.0)
                ok = got >= float(case["min"])
                return CaseResult(cid, ctype, ok, f"{module} {got:.1f}% (need {case['min']}%)")
            if ctype == "invariant":
                ok = total_cov >= float(case.get("min_total", 0))
                return CaseResult(cid, ctype, ok, f"total {total_cov:.1f}% (need {case.get('min_total')}%)")
            if ctype == "suite_green":
                return CaseResult(cid, ctype, suite_green, "all tests pass" if suite_green else "suite red")
            if ctype == "test_passes":
                name = case["name"]
                ok = name in passed_tests
                return CaseResult(cid, ctype, ok, f"{name} {'present+passed' if ok else 'missing/failed'}")
            return CaseResult(cid, ctype or "unknown", False, f"unknown assertion type {ctype!r}")
        except (KeyError, ValueError) as exc:
            return CaseResult(cid, ctype, False, f"malformed case: {exc}")


def _normalize(path: str) -> str:
    """Normalize coverage paths to 'src/<file>.py' regardless of absolute prefix."""
    p = path.replace("\\", "/")
    idx = p.rfind("src/")
    return p[idx:] if idx >= 0 else p

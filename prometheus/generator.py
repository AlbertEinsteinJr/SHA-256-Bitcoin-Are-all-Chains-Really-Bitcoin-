"""
L3 — Generator: proposes diverse candidate variants of a target.

Two interchangeable paths produce the same Variant objects, so the rest of the
loop (sandbox -> evaluator -> archive) is identical either way:

  * OfflineGenerator — deterministic recombination + mutation over the gene pool
    (prometheus/genes.py). Runs with no network or API key, so the entire engine
    is testable offline. This is genuine evolutionary search: fitness (coverage)
    selects which test genes survive.

  * ClaudeGenerator — the live brain. Calls the frozen model via the Anthropic
    SDK to write tests from the failure analysis + retrieved skills. Falls back
    to offline if the SDK or key is unavailable.

Every generation is wrapped in with_reflection (CLAUDE.md §2).
"""

from __future__ import annotations

import os
import random
import re
from dataclasses import dataclass, field
from typing import List, Optional, Sequence

from . import genes as gene_pool
from .config import Config
from .reliability import with_reflection

EVOLVED_PATH = "tests/test_prometheus_evolved.py"


@dataclass
class Variant:
    id: str
    target: str
    rel_path: str
    content: str
    genes: List[str] = field(default_factory=list)
    parent_id: Optional[str] = None
    source: str = "offline"


class Generator:
    """Generator interface."""

    def generate(
        self, target: str, *, parent_genes: Sequence[str], failures: List[str], n: int, seed: int
    ) -> List[Variant]:
        raise NotImplementedError


class OfflineGenerator(Generator):
    """Deterministic gene recombination + mutation. No network required."""

    def generate(self, target, *, parent_genes, failures, n, seed):
        rng = random.Random(seed)
        all_genes = list(gene_pool.GENES.keys())
        parent = list(parent_genes)
        variants: List[Variant] = []

        # Variant 0 — directed mutation: parent's genes plus one new gene
        # (monotone improvement toward closing the gaps).
        missing = [g for g in all_genes if g not in set(parent)]
        if missing:
            add = rng.choice(missing)
            child = sorted(set(parent) | {add}, key=all_genes.index)
            variants.append(self._make(target, child, seed, "child", parent))

        # Variants 1..n-1 — exploration: random subsets for diversity / islands.
        for k in range(max(0, n - len(variants))):
            size = rng.randint(1, len(all_genes))
            subset = sorted(rng.sample(all_genes, size), key=all_genes.index)
            variants.append(self._make(target, subset, seed * 100 + k, "explore", None))
        return variants

    @staticmethod
    def _make(target, gene_names, salt, tag, parent) -> Variant:
        content = gene_pool.assemble(gene_names)
        vid = f"v{salt}-{tag}-{len(gene_names)}"
        return Variant(
            id=vid,
            target=target,
            rel_path=EVOLVED_PATH,
            content=content,
            genes=list(gene_names),
            source="offline",
        )


class ClaudeGenerator(Generator):
    """Live generator backed by the Anthropic SDK (optional)."""

    def __init__(self, cfg: Config, fallback: Optional[Generator] = None):
        self.cfg = cfg
        self.fallback = fallback or OfflineGenerator()

    def generate(self, target, *, parent_genes, failures, n, seed):
        def _attempt() -> List[Variant]:
            return self._call_claude(target, list(failures), n)

        try:
            return with_reflection(_attempt, max_retries=1)
        except Exception:  # noqa: BLE001 — graceful degradation to offline
            return self.fallback.generate(
                target, parent_genes=parent_genes, failures=failures, n=n, seed=seed
            )

    def _call_claude(self, target: str, failures: List[str], n: int) -> List[Variant]:
        try:
            import anthropic  # type: ignore
        except ImportError as exc:
            raise RuntimeError("anthropic SDK not installed") from exc
        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise RuntimeError("ANTHROPIC_API_KEY not set")

        client = anthropic.Anthropic()
        prompt = (
            "You are improving the test suite of a Python SHA-256/blockchain repo "
            "(package `src`). Write a single pytest module that adds tests closing "
            "these coverage gaps. Output ONLY a fenced ```python code block.\n\n"
            "Failing assertions:\n- " + "\n- ".join(failures or ["raise overall coverage"])
        )
        variants: List[Variant] = []
        for i in range(n):
            msg = client.messages.create(
                model=self.cfg.model,
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}],
            )
            text = "".join(getattr(b, "text", "") for b in msg.content)
            code = _extract_code(text)
            if code:
                variants.append(
                    Variant(
                        id=f"claude-{i}",
                        target=target,
                        rel_path=EVOLVED_PATH,
                        content=code,
                        source="claude",
                    )
                )
        if not variants:
            raise RuntimeError("claude returned no usable code")
        return variants


def _extract_code(text: str) -> str:
    m = re.search(r"```(?:python)?\n(.*?)```", text, re.DOTALL)
    return m.group(1) if m else ""


def make_generator(cfg: Config) -> Generator:
    """Pick the generator per config: offline by default, Claude when online."""
    if cfg.offline:
        return OfflineGenerator()
    return ClaudeGenerator(cfg)

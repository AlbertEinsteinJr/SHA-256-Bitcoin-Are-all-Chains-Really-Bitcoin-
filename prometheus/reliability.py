"""
Reliability law as code (CLAUDE.md §2).

Per-step success multiplies (~0.95^n): 5 steps ~77%, 10 ~60%, 20 ~36%. The fixes
are mechanical and stack as defense in depth:

  * validate()        — structured-output validation at every boundary.
  * with_reflection() — one reflective retry turns 95% into ~99.75%.
  * chain()           — caps a sequential chain at 5 steps, with a verification
                        checkpoint auto-inserted at step 3 and step 5.
  * parallel()        — independent branches run as a DAG, so their errors do not
                        compound serially.
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Dict, List, Optional, Sequence

log = logging.getLogger("prometheus.reliability")

MAX_CHAIN_STEPS = 5
VERIFY_AT = (2, 4)  # zero-based indices -> "step 3" and "step 5"


class ValidationError(ValueError):
    """Raised when a value fails its boundary schema."""


def validate(schema: Dict[str, Callable[[Any], bool]], value: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate *value* against *schema* (field -> predicate). Predicates may be
    plain types (``int``) or callables returning bool. Raises ValidationError on
    the first violation. Returns the value unchanged on success.

    pydantic is a drop-in replacement for richer schemas; kept stdlib here to
    avoid a hard dependency.
    """
    if not isinstance(value, dict):
        raise ValidationError(f"expected a mapping, got {type(value).__name__}")
    for field, rule in schema.items():
        if field not in value:
            raise ValidationError(f"missing required field {field!r}")
        v = value[field]
        ok = isinstance(v, rule) if isinstance(rule, type) else bool(rule(v))
        if not ok:
            raise ValidationError(f"field {field!r} failed validation (got {v!r})")
    return value


def with_reflection(
    fn: Callable[[], Any],
    *,
    max_retries: int = 1,
    on_reflect: Optional[Callable[[int, Exception], None]] = None,
) -> Any:
    """
    Run *fn*; on failure, write a short failure analysis and retry up to
    *max_retries* times. The cheapest possible self-improvement loop (Reflexion).
    """
    last: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001 - reflection is the whole point
            last = exc
            analysis = f"attempt {attempt} failed: {type(exc).__name__}: {exc}"
            log.warning("reflection: %s", analysis)
            if on_reflect:
                on_reflect(attempt, exc)
            if attempt >= max_retries:
                break
    raise last  # type: ignore[misc]


def chain(
    steps: Sequence[Callable[[Any], Any]],
    initial: Any = None,
    *,
    verifier: Optional[Callable[[Any], bool]] = None,
) -> Any:
    """
    Run a SHORT sequential chain. Refuses chains longer than 5 steps. After the
    3rd and 5th step, runs *verifier* (a circuit breaker) if provided; a failing
    verification aborts the chain immediately.
    """
    if len(steps) > MAX_CHAIN_STEPS:
        raise ValueError(
            f"chain too long ({len(steps)} > {MAX_CHAIN_STEPS}); decompose or parallelize"
        )
    value = initial
    for i, step in enumerate(steps):
        value = step(value)
        if i in VERIFY_AT and verifier is not None:
            if not verifier(value):
                raise ValidationError(f"verification checkpoint failed after step {i + 1}")
    return value


def parallel(
    branches: Sequence[Callable[[], Any]], *, max_workers: Optional[int] = None
) -> List[Any]:
    """
    Run independent branches concurrently (a DAG fan-out) and join. Errors in one
    branch do not compound into the others.
    """
    if not branches:
        return []
    with ThreadPoolExecutor(max_workers=max_workers or len(branches)) as ex:
        futures = [ex.submit(b) for b in branches]
        return [f.result() for f in futures]


def vote(results: Sequence[Any]) -> Any:
    """
    Self-consistency: return the most common result (majority vote). Ties resolve
    to the first-seen value. Used for the verification pass on critical outputs.
    """
    if not results:
        raise ValueError("cannot vote over zero results")
    counts: Dict[Any, int] = {}
    order: List[Any] = []
    for r in results:
        key = r if isinstance(r, (str, int, float, bool, tuple)) else repr(r)
        if key not in counts:
            order.append(key)
        counts[key] = counts.get(key, 0) + 1
    best = max(order, key=lambda k: counts[k])
    # Map the winning key back to an actual result instance.
    for r in results:
        key = r if isinstance(r, (str, int, float, bool, tuple)) else repr(r)
        if key == best:
            return r
    return results[0]

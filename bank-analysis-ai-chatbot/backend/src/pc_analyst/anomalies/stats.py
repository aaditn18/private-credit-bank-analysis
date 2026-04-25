"""Tiny statistical helpers used by category detectors.

Kept dependency-free (no numpy) so it can be imported in any context.
"""

from __future__ import annotations

import math
from typing import Iterable, Sequence


def _clean(values: Iterable[float | None]) -> list[float]:
    return [float(v) for v in values if v is not None]


def mean(values: Iterable[float | None]) -> float | None:
    v = _clean(values)
    return sum(v) / len(v) if v else None


def stdev(values: Iterable[float | None]) -> float | None:
    v = _clean(values)
    if len(v) < 2:
        return None
    m = sum(v) / len(v)
    var = sum((x - m) ** 2 for x in v) / (len(v) - 1)
    return math.sqrt(var)


def rolling_zscore(history: Sequence[float | None], current: float | None) -> float | None:
    """z = (current - mean(history)) / stdev(history). Skips Nones."""
    if current is None:
        return None
    h = _clean(history)
    if len(h) < 3:
        return None
    m = sum(h) / len(h)
    var = sum((x - m) ** 2 for x in h) / (len(h) - 1) if len(h) > 1 else 0.0
    sd = math.sqrt(var)
    if sd <= 0:
        return None
    return (float(current) - m) / sd


def percentile_rank(value: float | None, distribution: Sequence[float | None]) -> float | None:
    """0..100 inclusive. None if value missing or distribution empty."""
    if value is None:
        return None
    d = sorted(_clean(distribution))
    if not d:
        return None
    below = sum(1 for x in d if x < value)
    eq = sum(1 for x in d if x == value)
    return 100.0 * (below + 0.5 * eq) / len(d)


def cohort_zscore(value: float | None, cohort: Sequence[float | None]) -> float | None:
    """z of *value* against the rest of the cohort (peer-group)."""
    if value is None:
        return None
    others = [v for v in _clean(cohort) if v != value]
    if len(others) < 3:
        return None
    m = sum(others) / len(others)
    var = sum((x - m) ** 2 for x in others) / (len(others) - 1)
    sd = math.sqrt(var)
    if sd <= 0:
        return None
    return (float(value) - m) / sd


def median(values: Iterable[float | None]) -> float | None:
    v = sorted(_clean(values))
    if not v:
        return None
    n = len(v)
    if n % 2:
        return v[n // 2]
    return 0.5 * (v[n // 2 - 1] + v[n // 2])

"""Loughran-McDonald-style sentiment scoring for filings narrative.

The bundled wordlists in ``lm_data/`` are a curated subset of the public LM
master dictionary (Loughran & McDonald, finance-specific tone categories).
For higher precision the files can be replaced with the full LM lists; the
loader works the same way.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from functools import cache
from pathlib import Path

LM_DIR = Path(__file__).resolve().parent / "lm_data"

_WORD = re.compile(r"[A-Za-z][A-Za-z'-]*")


@cache
def _load(name: str) -> frozenset[str]:
    path = LM_DIR / f"{name}.txt"
    return frozenset(
        w.strip().lower() for w in path.read_text().splitlines() if w.strip()
    )


@dataclass
class SentimentScore:
    positive_count: int
    negative_count: int
    uncertainty_count: int
    litigious_count: int
    total_words: int
    net_sentiment: float


def score_text(text: str) -> SentimentScore:
    pos = _load("positive")
    neg = _load("negative")
    unc = _load("uncertainty")
    lit = _load("litigious")

    words = [m.group(0).lower() for m in _WORD.finditer(text)]
    total = len(words)
    p = sum(1 for w in words if w in pos)
    n = sum(1 for w in words if w in neg)
    u = sum(1 for w in words if w in unc)
    l = sum(1 for w in words if w in lit)

    net = (p - n) / total if total else 0.0
    return SentimentScore(
        positive_count=p,
        negative_count=n,
        uncertainty_count=u,
        litigious_count=l,
        total_words=total,
        net_sentiment=net,
    )

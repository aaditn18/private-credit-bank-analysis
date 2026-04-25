"""Anomaly engine — invokes per-category detectors and assembles results.

Themes use underscore form internally (``private_credit``) to match the
chunk_topic / taxonomy naming. The API accepts kebab-case (``private-credit``)
for URL friendliness; ``normalize_theme`` does the swap.
"""

from __future__ import annotations

import threading
import time
from dataclasses import asdict, dataclass, field
from typing import Literal

from ..retrieval.taxonomy import THEMES

# Detector results are deterministic for a given (theme, quarter) until new
# data lands. Cache aggressively in-process — refreshed only when the
# ingestion pipeline reruns and the backend restarts.
_CACHE_TTL_SECONDS = 24 * 3600
_cache: dict[tuple[str, str | None], tuple[float, list]] = {}
_cache_lock = threading.Lock()


def clear_cache() -> None:
    with _cache_lock:
        _cache.clear()

Severity = Literal["low", "medium", "high"]


# Display order matters — frontend renders top-to-bottom.
CATEGORIES: tuple[str, ...] = (
    "exposure",
    "credit_quality",
    "peer_deviation",
    "disclosure_nlp",
    "events_8k",
    "valuation_marks",
    "structural",
    "macro_divergence",
)


@dataclass
class Citation:
    kind: str                  # 'chunk' | 'filing' | 'call_report' | 'event'
    ref_id: int | None = None
    label: str | None = None
    bank_ticker: str | None = None
    quarter: str | None = None
    document_id: int | None = None


Sentiment = Literal["positive", "negative", "inconclusive"]


@dataclass
class Anomaly:
    theme: str
    category: str
    bank_ticker: str
    severity: Severity
    headline: str
    detail: str
    metric_value: float | None = None
    peer_median: float | None = None
    z_score: float | None = None
    quarter: str | None = None
    citations: list[Citation] = field(default_factory=list)
    sentiment: Sentiment = "inconclusive"
    full_detail: str | None = None
    history: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        d = asdict(self)
        return d


_SEVERITY_RANK: dict[str, int] = {"high": 3, "medium": 2, "low": 1}


def normalize_theme(raw: str) -> str:
    s = raw.strip().lower().replace("-", "_")
    if s not in THEMES:
        raise ValueError(f"unknown theme {raw!r}")
    return s


def run_for_theme(theme: str, quarter: str | None = None) -> list[Anomaly]:
    """Run every category detector and return the full list of anomalies.

    Detectors are imported lazily so a broken detector doesn't take the whole
    package down on import. Results are cached for ``_CACHE_TTL_SECONDS``.
    """
    cache_key = (theme, quarter)
    now = time.time()
    with _cache_lock:
        hit = _cache.get(cache_key)
        if hit and (now - hit[0]) < _CACHE_TTL_SECONDS:
            return list(hit[1])

    from .categories import (
        credit_quality,
        disclosure_nlp,
        events_8k,
        exposure,
        macro_divergence,
        peer_deviation,
        structural,
        valuation_marks,
    )

    detectors = {
        "exposure":          exposure.detect,
        "credit_quality":    credit_quality.detect,
        "peer_deviation":    peer_deviation.detect,
        "disclosure_nlp":    disclosure_nlp.detect,
        "events_8k":         events_8k.detect,
        "valuation_marks":   valuation_marks.detect,
        "structural":        structural.detect,
        "macro_divergence":  macro_divergence.detect,
    }

    out: list[Anomaly] = []
    for category in CATEGORIES:
        try:
            out.extend(detectors[category](theme, quarter))
        except Exception as exc:   # noqa: BLE001
            # Surface the failure as a low-severity anomaly so the page never
            # silently goes blank when a detector is broken.
            out.append(
                Anomaly(
                    theme=theme,
                    category=category,
                    bank_ticker="-",
                    severity="low",
                    headline=f"{category} detector failed",
                    detail=f"{type(exc).__name__}: {exc}",
                )
            )

    _annotate_sentiment_and_text(out)
    out.sort(key=lambda a: (_SEVERITY_RANK[a.severity], abs(a.z_score or 0.0)), reverse=True)
    with _cache_lock:
        _cache[cache_key] = (now, list(out))
    return out


# Categories that, when supported by a metric, are inherently negative
# (more exposure / worse credit / impairment language are bad signals).
_NEGATIVE_BY_DEFAULT = {
    "credit_quality",
    "valuation_marks",
    "events_8k",
    "structural",
}


def _annotate_sentiment_and_text(anomalies: list[Anomaly]) -> None:
    """Attach LM-derived sentiment and full chunk text where available."""
    from ..db import cursor, render_sql
    from .queries import chunk_sentiments_for

    chunk_ids: set[int] = set()
    for a in anomalies:
        for c in a.citations:
            if c.kind == "chunk" and c.ref_id is not None:
                chunk_ids.add(int(c.ref_id))
    if chunk_ids:
        sentiments = chunk_sentiments_for(list(chunk_ids))
        # Pull full text for chunks already cited (so the frontend can expand).
        marks = ",".join("?" * len(chunk_ids))
        with cursor() as (_, cur):
            cur.execute(
                render_sql(f"SELECT id, text FROM chunk WHERE id IN ({marks})"),
                tuple(chunk_ids),
            )
            texts = {int(r[0]): (r[1] or "") for r in cur.fetchall()}
    else:
        sentiments = {}
        texts = {}

    for a in anomalies:
        chunk_cite = next(
            (c for c in a.citations if c.kind == "chunk" and c.ref_id is not None),
            None,
        )
        if chunk_cite and texts.get(int(chunk_cite.ref_id)):
            full = texts[int(chunk_cite.ref_id)].strip()
            if len(full) > len(a.detail.rstrip("…").rstrip()):
                a.full_detail = full

        if a.sentiment != "inconclusive":
            continue  # detector already set it

        if chunk_cite is not None:
            score = sentiments.get(int(chunk_cite.ref_id))
            if score is not None:
                if score < -0.005:
                    a.sentiment = "negative"
                elif score > 0.005:
                    a.sentiment = "positive"
                else:
                    a.sentiment = "inconclusive"
                continue

        if a.category in _NEGATIVE_BY_DEFAULT:
            a.sentiment = "negative"
        elif a.category == "exposure" and (a.z_score or 0) > 0:
            a.sentiment = "negative"
        elif a.category == "exposure" and (a.z_score or 0) < 0:
            a.sentiment = "positive"
        elif a.category == "peer_deviation":
            a.sentiment = "negative" if (a.metric_value or 0) > (a.peer_median or 0) else "inconclusive"


def group_by_category(anomalies: list[Anomaly]) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {c: [] for c in CATEGORIES}
    for a in anomalies:
        out.setdefault(a.category, []).append(a.to_dict())
    return out

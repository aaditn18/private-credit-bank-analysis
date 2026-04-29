"""Hybrid topic classifier (keyword + cosine to theme anchor).

Tags every chunk with one of: 'private_credit' | 'ai' | 'digital_assets' | 'none'.
Persisted into chunk_topic so anomaly endpoints can route narrative quickly.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path

from ..retrieval.embeddings import embed
from ..retrieval.taxonomy import THEMES, load_themes


@dataclass
class TopicResult:
    theme: str
    confidence: float
    keyword_score: float
    cosine_score: float


_CACHE_DIR = Path(__file__).resolve().parents[3] / ".cache"
_ANCHOR_CACHE = _CACHE_DIR / "theme_anchors.json"

# A chunk under both thresholds maps to 'none'.
_KEYWORD_FLOOR = 0.0    # any keyword hit is enough to keep out of 'none'
_COSINE_FLOOR = 0.20    # below this cosine to all themes → no thematic signal


def _build_anchor_strings() -> dict[str, list[str]]:
    """One short string per concept synonym, suitable for embedding."""
    themes = load_themes()
    out: dict[str, list[str]] = {}
    for theme, tax in themes.items():
        strings: list[str] = []
        for c in tax.concepts.values():
            strings.append(c.label)
            strings.extend(c.synonyms)
        out[theme] = strings
    return out


def _mean(vectors: list[list[float]]) -> list[float]:
    if not vectors:
        return []
    dim = len(vectors[0])
    acc = [0.0] * dim
    for v in vectors:
        for i, x in enumerate(v):
            acc[i] += x
    n = len(vectors)
    avg = [x / n for x in acc]
    norm = math.sqrt(sum(x * x for x in avg)) or 1.0
    return [x / norm for x in avg]


def _cos(a: list[float], b: list[float]) -> float:
    if not a or not b:
        return 0.0
    return sum(x * y for x, y in zip(a, b))   # both normalized → dot is cosine


def get_theme_anchors() -> dict[str, list[float]]:
    """Compute (or load cached) one anchor embedding per theme."""
    if _ANCHOR_CACHE.exists():
        try:
            cached = json.loads(_ANCHOR_CACHE.read_text())
            if set(cached) == set(THEMES):
                return cached
        except (json.JSONDecodeError, OSError):
            pass

    anchor_strings = _build_anchor_strings()
    anchors: dict[str, list[float]] = {}
    for theme, strings in anchor_strings.items():
        if not strings:
            anchors[theme] = []
            continue
        vecs = embed(strings)
        anchors[theme] = _mean(vecs)

    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    _ANCHOR_CACHE.write_text(json.dumps(anchors))
    return anchors


def _keyword_scores(text: str) -> dict[str, float]:
    """Per-theme keyword density: hits / sqrt(words)."""
    themes = load_themes()
    lower = text.lower()
    word_count = max(len(lower.split()), 1)
    scale = math.sqrt(word_count)
    out: dict[str, float] = {}
    for theme, tax in themes.items():
        hits = 0
        for concept in tax.concepts.values():
            for term in (concept.label, *concept.synonyms):
                t = term.lower()
                if t and t in lower:
                    hits += 1
        out[theme] = hits / scale
    return out


def classify_text(text: str, anchors: dict[str, list[float]] | None = None) -> TopicResult:
    """Classify one piece of text. Pass pre-computed anchors when batching."""
    if anchors is None:
        anchors = get_theme_anchors()

    kw = _keyword_scores(text)
    chunk_vec = embed([text])[0]
    cos = {theme: _cos(chunk_vec, vec) for theme, vec in anchors.items()}

    # Combined score: keyword count is unbounded, cosine is bounded ~[-1,1].
    # Light scaling on keywords keeps embeddings in the running on short chunks.
    combined = {t: kw[t] * 0.6 + cos[t] for t in THEMES}
    ranked = sorted(combined.items(), key=lambda kv: kv[1], reverse=True)
    top_theme, top_score = ranked[0]
    second_score = ranked[1][1] if len(ranked) > 1 else 0.0

    # Classification floor: if no theme stands out, it's narrative noise.
    if kw[top_theme] <= _KEYWORD_FLOOR and cos[top_theme] < _COSINE_FLOOR:
        return TopicResult("none", 0.0, kw[top_theme], cos[top_theme])

    confidence = top_score - second_score
    return TopicResult(
        theme=top_theme,
        confidence=confidence,
        keyword_score=kw[top_theme],
        cosine_score=cos[top_theme],
    )


def classify_batch(texts: list[str]) -> list[TopicResult]:
    """Embed once for the whole batch — much faster than calling classify_text per chunk."""
    anchors = get_theme_anchors()
    vecs = embed(texts)
    out: list[TopicResult] = []
    for text, vec in zip(texts, vecs):
        kw = _keyword_scores(text)
        cos = {theme: _cos(vec, anchors[theme]) for theme in THEMES}
        combined = {t: kw[t] * 0.6 + cos[t] for t in THEMES}
        ranked = sorted(combined.items(), key=lambda kv: kv[1], reverse=True)
        top_theme, top_score = ranked[0]
        second_score = ranked[1][1] if len(ranked) > 1 else 0.0

        if kw[top_theme] <= _KEYWORD_FLOOR and cos[top_theme] < _COSINE_FLOOR:
            out.append(TopicResult("none", 0.0, kw[top_theme], cos[top_theme]))
        else:
            out.append(
                TopicResult(
                    theme=top_theme,
                    confidence=top_score - second_score,
                    keyword_score=kw[top_theme],
                    cosine_score=cos[top_theme],
                )
            )
    return out

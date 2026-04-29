"""Cross-encoder reranker with graceful fallback.

If ``sentence-transformers`` + a reranker model are available we use
``CrossEncoder``. Otherwise we fall back to a lexical-overlap rerank
score so the pipeline still works.
"""

from __future__ import annotations

import threading

from ..config import settings

_RERANK_LOCK = threading.Lock()
# See embeddings.py — lru_cache is unsafe for expensive first-time loads under
# concurrent access. Guard the instantiation with an explicit lock.
_MODEL_LOAD_LOCK = threading.Lock()
_MODEL_SINGLETON = None


def rerank(query: str, candidates: list[tuple[str, float]]) -> list[float]:
    """Return a parallel list of rerank scores for ``candidates``.

    Each candidate is a ``(text, retrieval_score)`` tuple. Output scores
    are floats in roughly ``[-10, 10]``; higher is better.
    """
    if not candidates:
        return []
    try:
        model = _load()
        pairs = [[query, text] for text, _ in candidates]
        with _RERANK_LOCK:
            scores = model.predict(pairs)
        return [float(s) for s in scores]
    except Exception:
        return [_lexical_rerank(query, text) for text, _ in candidates]


def _load():  # noqa: ANN202
    global _MODEL_SINGLETON
    if _MODEL_SINGLETON is not None:
        return _MODEL_SINGLETON
    with _MODEL_LOAD_LOCK:
        if _MODEL_SINGLETON is not None:
            return _MODEL_SINGLETON
        from sentence_transformers import CrossEncoder
        _MODEL_SINGLETON = CrossEncoder(settings.reranker_model)
    return _MODEL_SINGLETON


def _lexical_rerank(query: str, text: str) -> float:
    q = set(query.lower().split())
    t = text.lower()
    if not q:
        return 0.0
    hits = sum(1 for tok in q if tok in t)
    return hits / max(1, len(q))

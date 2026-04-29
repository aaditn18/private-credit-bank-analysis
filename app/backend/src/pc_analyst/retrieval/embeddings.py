"""Pluggable embedding provider.

- ``local``: sentence-transformers/all-MiniLM-L6-v2 (384d). Runs CPU-only.
- ``none``: deterministic hash-based embedding (only for tests).

We intentionally keep the interface tiny: ``embed(texts) -> list[list[float]]``.
"""

from __future__ import annotations

import hashlib
import math
import threading

from ..config import settings

# PyTorch model forward passes aren't safe under true concurrent access from
# multiple threads — serialize at the embed layer.
_EMBED_LOCK = threading.Lock()
# Separate lock for first-time model load. lru_cache is NOT thread-safe on
# cold start: N concurrent callers can each trigger their own SentenceTransformer
# instantiation (~200MB each), spiking memory and triggering OOM kill.
_MODEL_LOAD_LOCK = threading.Lock()
_MODEL_SINGLETON = None


def embed(texts: list[str]) -> list[list[float]]:
    if settings.embedding_model == "local":
        return _local_embed(tuple(texts))
    if settings.embedding_model == "none":
        return [_hash_embed(t, settings.embedding_dim) for t in texts]
    raise ValueError(f"Unknown EMBEDDING_MODEL: {settings.embedding_model!r}")


def embed_one(text: str) -> list[float]:
    return embed([text])[0]


# ---------------------------------------------------------------------------
# Local (sentence-transformers)
# ---------------------------------------------------------------------------

def _load_local_model():  # noqa: ANN202  — returns SentenceTransformer
    global _MODEL_SINGLETON
    if _MODEL_SINGLETON is not None:
        return _MODEL_SINGLETON
    with _MODEL_LOAD_LOCK:
        if _MODEL_SINGLETON is not None:
            return _MODEL_SINGLETON
        from sentence_transformers import SentenceTransformer
        _MODEL_SINGLETON = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    return _MODEL_SINGLETON


def _local_embed(texts: tuple[str, ...]) -> list[list[float]]:
    model = _load_local_model()
    with _EMBED_LOCK:
        vectors = model.encode(list(texts), normalize_embeddings=True, convert_to_numpy=True)
    return [vec.tolist() for vec in vectors]


# ---------------------------------------------------------------------------
# Deterministic hash embedding (CI / offline tests)
# ---------------------------------------------------------------------------

def _hash_embed(text: str, dim: int) -> list[float]:
    """Low-quality but deterministic embedding used for tests without deps."""
    vec = [0.0] * dim
    tokens = text.lower().split()
    for tok in tokens:
        h = hashlib.md5(tok.encode()).digest()
        for i, b in enumerate(h):
            vec[(hash(tok) + i) % dim] += (b / 255.0) - 0.5
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]

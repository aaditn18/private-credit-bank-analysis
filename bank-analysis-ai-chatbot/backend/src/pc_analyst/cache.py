"""In-memory TTL cache for read-mostly endpoint handlers.

The data behind ``/rankings``, ``/trends``, ``/findings``, ``/timeline``,
and ``/anomalies/{theme}`` only changes when an offline script runs
(``populate_findings.py``, ``ingest_filings.py``, ``load_call_reports.py``,
etc.). Re-querying SQLite + re-shaping JSON on every request wastes CPU
and adds latency the user can feel — especially on the ``/compare`` page,
which fans out 4-bank × 2 endpoints (``timeline`` + ``findings``) plus
the global ``rankings`` and ``trends`` calls on every render.

This module gives endpoint code two things:

1. ``@cached(ttl=300)`` — a thread-safe per-process TTL memo. The cache
   key is derived from the function's positional + keyword args, so
   ``get_timeline("JPM")`` and ``get_timeline("BAC")`` cache separately.

2. ``invalidate(prefix)`` — clears entries whose key starts with
   ``prefix``. Long-running scripts can call this after writing to flush
   stale results without restarting the API.

The cache is intentionally simple: no LRU eviction, no size bound. The
working set across every endpoint × every bank × every quarter is small
(a few MB of JSON at most) and entries expire on their own.
"""

from __future__ import annotations

import functools
import threading
import time
from typing import Any, Callable, TypeVar

F = TypeVar("F", bound=Callable[..., Any])


class _TTLStore:
    """Thread-safe ``key -> (expires_at, value)`` map."""

    def __init__(self) -> None:
        self._data: dict[str, tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Any | None:
        now = time.monotonic()
        with self._lock:
            entry = self._data.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if expires_at < now:
                # Expired — drop and miss.
                self._data.pop(key, None)
                return None
            return value

    def set(self, key: str, value: Any, ttl_seconds: float) -> None:
        with self._lock:
            self._data[key] = (time.monotonic() + ttl_seconds, value)

    def invalidate(self, prefix: str) -> int:
        with self._lock:
            keys = [k for k in self._data if k.startswith(prefix)]
            for k in keys:
                del self._data[k]
            return len(keys)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()

    def stats(self) -> dict[str, int]:
        with self._lock:
            return {"entries": len(self._data)}


_store = _TTLStore()


def _make_key(name: str, args: tuple[Any, ...], kwargs: dict[str, Any]) -> str:
    # repr() is deterministic enough for our small primitive args (strings,
    # ints, None). We never cache calls that take complex objects.
    return name + "|" + repr(args) + "|" + repr(sorted(kwargs.items()))


def cached(ttl: float) -> Callable[[F], F]:
    """Decorator: memoize the wrapped function's return value for ``ttl`` seconds.

    Use only on functions whose result is fully determined by their args.
    The wrapped function still runs on a cache miss, so SQLite errors etc.
    propagate normally.
    """

    def deco(fn: F) -> F:
        name = f"{fn.__module__}.{fn.__qualname__}"

        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            key = _make_key(name, args, kwargs)
            hit = _store.get(key)
            if hit is not None:
                return hit
            value = fn(*args, **kwargs)
            _store.set(key, value, ttl)
            return value

        # Expose the underlying function so callers (and tests) can bypass
        # the cache when they need fresh data.
        wrapper.__wrapped__ = fn  # type: ignore[attr-defined]
        wrapper.cache_invalidate = lambda: _store.invalidate(name)  # type: ignore[attr-defined]
        return wrapper  # type: ignore[return-value]

    return deco


def invalidate(prefix: str = "") -> int:
    """Drop all cache entries whose key starts with ``prefix``.

    Pass ``""`` to flush everything.
    """
    return _store.invalidate(prefix)


def stats() -> dict[str, int]:
    return _store.stats()

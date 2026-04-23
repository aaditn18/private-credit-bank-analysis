"""Thin DB access layer supporting both Postgres+pgvector and a SQLite fallback.

The SQLite mode stores embeddings as JSON and does cosine similarity in
Python. It is intended for local demos and CI; the production target is
Postgres with pgvector.
"""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Iterator, Sequence

from .config import settings


@dataclass
class DBHandle:
    """Connection-like wrapper hiding the Postgres/SQLite difference."""

    backend: str                # 'postgres' | 'sqlite'
    conn: Any                   # psycopg connection or sqlite3.Connection

    def close(self) -> None:
        self.conn.close()


def _connect_postgres() -> DBHandle:
    import psycopg
    from pgvector.psycopg import register_vector

    conn = psycopg.connect(settings.database_url, autocommit=False)
    register_vector(conn)
    return DBHandle(backend="postgres", conn=conn)


def _connect_sqlite() -> DBHandle:
    settings.sqlite_path.parent.mkdir(parents=True, exist_ok=True)
    # timeout=30: wait up to 30s for write lock instead of failing immediately
    # check_same_thread=False: FastAPI runs sync endpoints in a thread pool
    conn = sqlite3.connect(str(settings.sqlite_path), timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    # WAL mode: allows concurrent readers + one writer without blocking each other
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    return DBHandle(backend="sqlite", conn=conn)


def connect() -> DBHandle:
    if settings.storage_backend == "postgres":
        return _connect_postgres()
    if settings.storage_backend == "sqlite":
        return _connect_sqlite()
    raise ValueError(f"Unknown STORAGE_BACKEND: {settings.storage_backend!r}")


@contextmanager
def cursor() -> Iterator[tuple[DBHandle, Any]]:
    handle = connect()
    try:
        cur = handle.conn.cursor()
        try:
            yield handle, cur
            handle.conn.commit()
        except Exception:
            handle.conn.rollback()
            raise
        finally:
            cur.close()
    finally:
        handle.close()


# ---------------------------------------------------------------------------
# Migrations
# ---------------------------------------------------------------------------

SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS bank (
    ticker TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rssd_id TEXT,
    cik TEXT,
    peer_group TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_ticker TEXT NOT NULL REFERENCES bank(ticker) ON DELETE CASCADE,
    doc_type TEXT NOT NULL,
    fiscal_year INTEGER,
    fiscal_quarter INTEGER,
    filed_at TEXT,
    source_path TEXT NOT NULL,
    source_url TEXT,
    title TEXT,
    raw_text TEXT NOT NULL,
    raw_text_sha256 TEXT NOT NULL,
    ingested_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (bank_ticker, doc_type, fiscal_year, fiscal_quarter, raw_text_sha256)
);

CREATE INDEX IF NOT EXISTS document_bank_type_idx
    ON document (bank_ticker, doc_type, fiscal_year, fiscal_quarter);

CREATE TABLE IF NOT EXISTS chunk (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL REFERENCES document(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    section_header TEXT,
    page INTEGER,
    char_start INTEGER NOT NULL,
    char_end INTEGER NOT NULL,
    text TEXT NOT NULL,
    token_count INTEGER,
    taxonomy_hits TEXT,               -- JSON list
    embedding TEXT,                   -- JSON list of floats
    UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS chunk_doc_idx ON chunk (document_id);

CREATE TABLE IF NOT EXISTS call_report_fact (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rssd_id TEXT NOT NULL,
    bank_ticker TEXT REFERENCES bank(ticker) ON DELETE SET NULL,
    quarter TEXT NOT NULL,
    schedule TEXT NOT NULL,
    line_item TEXT NOT NULL,
    label TEXT,
    value_numeric REAL,
    value_text TEXT,
    as_of_date TEXT,
    source_url TEXT,
    ingested_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (rssd_id, quarter, schedule, line_item)
);

CREATE INDEX IF NOT EXISTS crf_bank_idx ON call_report_fact (bank_ticker, quarter, schedule);

CREATE TABLE IF NOT EXISTS agent_run (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    answer TEXT,
    citations_json TEXT,
    started_at TEXT DEFAULT CURRENT_TIMESTAMP,
    finished_at TEXT,
    llm_provider TEXT,
    llm_model TEXT,
    status TEXT NOT NULL DEFAULT 'running'
);

CREATE TABLE IF NOT EXISTS reasoning_step (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES agent_run(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL,
    step_type TEXT NOT NULL,
    tool_name TEXT,
    tool_arguments TEXT,
    tool_result TEXT,
    summary TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (run_id, step_index)
);

CREATE TABLE IF NOT EXISTS pc_finding (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_ticker TEXT NOT NULL REFERENCES bank(ticker) ON DELETE CASCADE,
    bank_name TEXT,
    rating INTEGER,
    mention_frequency TEXT,
    sentiment TEXT,
    key_themes TEXT,
    strategic_initiatives TEXT,
    perceived_risks TEXT,
    notable_quotes TEXT,
    pullback_mentions TEXT,
    named_competitors TEXT,
    risk_focus_analysis TEXT,
    involvement_rating INTEGER,
    UNIQUE (bank_ticker)
);

CREATE TABLE IF NOT EXISTS stock_price (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_ticker TEXT NOT NULL REFERENCES bank(ticker) ON DELETE CASCADE,
    date TEXT NOT NULL,
    close REAL NOT NULL,
    volume INTEGER,
    UNIQUE (bank_ticker, date)
);

CREATE INDEX IF NOT EXISTS stock_price_ticker_idx ON stock_price (bank_ticker, date);

CREATE TABLE IF NOT EXISTS news_article (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_ticker TEXT NOT NULL REFERENCES bank(ticker) ON DELETE CASCADE,
    headline TEXT NOT NULL,
    url TEXT,
    published_at TEXT NOT NULL,
    sentiment_score REAL,
    UNIQUE (bank_ticker, url)
);

CREATE INDEX IF NOT EXISTS news_article_ticker_idx ON news_article (bank_ticker, published_at);
"""


def apply_migrations() -> None:
    """Idempotent schema setup for whichever backend is configured."""
    migrations_dir = Path(__file__).resolve().parents[2] / "migrations"
    if settings.storage_backend == "postgres":
        for sql_file in sorted(migrations_dir.glob("*.sql")):
            sql = sql_file.read_text()
            with cursor() as (_, cur):
                cur.execute(sql)
    else:
        with cursor() as (_, cur):
            cur.executescript(SQLITE_SCHEMA)


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------

def serialize_embedding(vec: Sequence[float]) -> Any:
    """Postgres consumes numpy/list directly via pgvector; SQLite uses JSON."""
    if settings.storage_backend == "postgres":
        return list(vec)
    return json.dumps(list(vec))


def serialize_json(value: Any) -> Any:
    if settings.storage_backend == "postgres":
        return json.dumps(value)  # psycopg handles jsonb; keep it simple
    return json.dumps(value)


def placeholder() -> str:
    return "%s" if settings.storage_backend == "postgres" else "?"


def render_sql(sql: str) -> str:
    """Allow templates with ``?`` that become ``%s`` under Postgres."""
    if settings.storage_backend == "postgres":
        return sql.replace("?", "%s")
    return sql


def fetchone_dict(cur: Any) -> dict[str, Any] | None:
    row = cur.fetchone()
    if row is None:
        return None
    if isinstance(row, sqlite3.Row):
        return {k: row[k] for k in row.keys()}
    cols = [d[0] for d in cur.description]
    return dict(zip(cols, row, strict=False))


def fetchall_dicts(cur: Any) -> list[dict[str, Any]]:
    rows = cur.fetchall()
    if not rows:
        return []
    if isinstance(rows[0], sqlite3.Row):
        return [{k: r[k] for k in r.keys()} for r in rows]
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r, strict=False)) for r in rows]


def executemany(cur: Any, sql: str, params: Iterable[Sequence[Any]]) -> None:
    cur.executemany(render_sql(sql), list(params))

"""Shared DB queries used by multiple category detectors.

Centralized so the SQL stays consistent and the detectors stay small.
"""

from __future__ import annotations

from ..db import cursor, fetchall_dicts, render_sql

# Quarters where Call Report data starts having reasonable coverage.
DEFAULT_HISTORY_QUARTERS = 8


def latest_quarter_with_data() -> str | None:
    with cursor() as (_, cur):
        cur.execute(
            "SELECT quarter FROM call_report_fact "
            "WHERE value_numeric IS NOT NULL "
            "GROUP BY quarter ORDER BY quarter DESC LIMIT 1"
        )
        row = cur.fetchone()
    return row[0] if row else None


def quarters_descending(limit: int = DEFAULT_HISTORY_QUARTERS) -> list[str]:
    with cursor() as (_, cur):
        cur.execute(
            render_sql(
                "SELECT DISTINCT quarter FROM call_report_fact "
                "WHERE value_numeric IS NOT NULL "
                "ORDER BY quarter DESC LIMIT ?"
            ),
            (limit,),
        )
        rows = cur.fetchall()
    return [r[0] for r in rows]


def previous_quarter(q: str) -> str:
    """'2025Q4' -> '2025Q3', '2025Q1' -> '2024Q4'."""
    year, quarter = int(q[:4]), int(q[-1])
    if quarter == 1:
        return f"{year - 1}Q4"
    return f"{year}Q{quarter - 1}"


def all_banks() -> list[dict]:
    with cursor() as (_, cur):
        cur.execute(render_sql("SELECT ticker, name, peer_group FROM bank ORDER BY ticker"))
        return fetchall_dicts(cur)


def call_report_facts(quarters: list[str], mnemonics: list[str]) -> dict[tuple[str, str], dict[str, float]]:
    """Returns {(ticker, quarter): {mnemonic: value}}."""
    if not quarters or not mnemonics:
        return {}
    q_marks = ",".join("?" * len(quarters))
    m_marks = ",".join("?" * len(mnemonics))
    sql = (
        f"SELECT bank_ticker, quarter, line_item, value_numeric "
        f"FROM call_report_fact "
        f"WHERE quarter IN ({q_marks}) AND line_item IN ({m_marks}) "
        f"  AND value_numeric IS NOT NULL"
    )
    with cursor() as (_, cur):
        cur.execute(render_sql(sql), [*quarters, *mnemonics])
        rows = fetchall_dicts(cur)
    out: dict[tuple[str, str], dict[str, float]] = {}
    for r in rows:
        if not r["bank_ticker"]:
            continue
        key = (r["bank_ticker"], r["quarter"])
        out.setdefault(key, {})[r["line_item"]] = float(r["value_numeric"])
    return out


def topic_tagged_chunks(theme: str, *, min_confidence: float = 0.0, limit: int | None = None) -> list[dict]:
    """Chunks tagged with *theme*, joined back to document for filing context."""
    sql = (
        "SELECT c.id AS chunk_id, c.document_id, c.text, c.section_header, "
        "       c.token_count, "
        "       d.bank_ticker, d.doc_type, d.fiscal_year, d.fiscal_quarter, "
        "       d.filed_at, ct.confidence, ct.keyword_score, ct.cosine_score "
        "FROM chunk c "
        "JOIN chunk_topic ct ON ct.chunk_id = c.id "
        "JOIN document d ON d.id = c.document_id "
        "WHERE ct.theme = ? AND ct.confidence >= ? "
        "ORDER BY ct.confidence DESC"
    )
    if limit:
        sql += f" LIMIT {int(limit)}"
    with cursor() as (_, cur):
        cur.execute(render_sql(sql), (theme, min_confidence))
        return fetchall_dicts(cur)


def topic_tagged_chunks_for_bank(theme: str, ticker: str, *, limit: int | None = None) -> list[dict]:
    sql = (
        "SELECT c.id AS chunk_id, c.document_id, c.text, c.section_header, "
        "       d.doc_type, d.fiscal_year, d.fiscal_quarter, d.filed_at, "
        "       ct.confidence "
        "FROM chunk c "
        "JOIN chunk_topic ct ON ct.chunk_id = c.id "
        "JOIN document d ON d.id = c.document_id "
        "WHERE ct.theme = ? AND d.bank_ticker = ? "
        "ORDER BY d.fiscal_year DESC, d.fiscal_quarter DESC, ct.confidence DESC"
    )
    if limit:
        sql += f" LIMIT {int(limit)}"
    with cursor() as (_, cur):
        cur.execute(render_sql(sql), (theme, ticker))
        return fetchall_dicts(cur)


def chunk_sentiments_for(chunk_ids: list[int]) -> dict[int, float]:
    """Return ``{chunk_id: net_sentiment}`` for the given ids."""
    if not chunk_ids:
        return {}
    marks = ",".join("?" * len(chunk_ids))
    sql = f"SELECT chunk_id, net_sentiment FROM chunk_sentiment WHERE chunk_id IN ({marks})"
    with cursor() as (_, cur):
        cur.execute(render_sql(sql), tuple(chunk_ids))
        return {int(r[0]): float(r[1]) for r in cur.fetchall()}


def topic_tagged_chunks_grouped_by_bank(theme: str, *, per_bank: int = 40) -> dict[str, list[dict]]:
    """Return up to *per_bank* theme-tagged chunks per bank, in one round-trip.

    Used by NLP detectors to avoid the 50× per-bank query pattern.
    """
    sql = (
        "SELECT c.id AS chunk_id, c.document_id, c.text, c.section_header, "
        "       d.bank_ticker, d.doc_type, d.fiscal_year, d.fiscal_quarter, "
        "       ct.confidence "
        "FROM chunk c "
        "JOIN chunk_topic ct ON ct.chunk_id = c.id "
        "JOIN document d ON d.id = c.document_id "
        "WHERE ct.theme = ? AND d.bank_ticker IS NOT NULL "
        "ORDER BY d.bank_ticker, d.fiscal_year DESC, d.fiscal_quarter DESC, ct.confidence DESC"
    )
    with cursor() as (_, cur):
        cur.execute(render_sql(sql), (theme,))
        rows = fetchall_dicts(cur)
    out: dict[str, list[dict]] = {}
    for r in rows:
        t = r["bank_ticker"]
        if not t:
            continue
        bucket = out.setdefault(t, [])
        if len(bucket) < per_bank:
            bucket.append(r)
    return out


def latest_chunk_per_bank(theme: str) -> dict[str, dict]:
    """For each bank with a *theme*-tagged chunk, return the most recent one.

    One query instead of N — disclosure_nlp / per-bank loops should use this
    rather than calling ``topic_tagged_chunks_for_bank`` in a loop.
    """
    sql = (
        "SELECT c.id AS chunk_id, c.document_id, c.section_header, "
        "       d.bank_ticker, d.doc_type, d.fiscal_year, d.fiscal_quarter "
        "FROM chunk c "
        "JOIN chunk_topic ct ON ct.chunk_id = c.id "
        "JOIN document d ON d.id = c.document_id "
        "WHERE ct.theme = ? AND d.bank_ticker IS NOT NULL "
        "ORDER BY d.bank_ticker, d.fiscal_year DESC, d.fiscal_quarter DESC, ct.confidence DESC"
    )
    with cursor() as (_, cur):
        cur.execute(render_sql(sql), (theme,))
        rows = fetchall_dicts(cur)
    out: dict[str, dict] = {}
    for r in rows:
        t = r["bank_ticker"]
        if t and t not in out:
            out[t] = r
    return out


def chunk_sentiment_by_bank_quarter(theme: str) -> dict[tuple[str, int, int], dict[str, float]]:
    """Aggregate net_sentiment + uncertainty density per (ticker, fy, fq) for *theme*-tagged chunks."""
    sql = (
        "SELECT d.bank_ticker, d.fiscal_year, d.fiscal_quarter, "
        "       SUM(cs.positive_count) AS pos, SUM(cs.negative_count) AS neg, "
        "       SUM(cs.uncertainty_count) AS unc, SUM(cs.total_words) AS tot "
        "FROM chunk_sentiment cs "
        "JOIN chunk c ON c.id = cs.chunk_id "
        "JOIN chunk_topic ct ON ct.chunk_id = c.id "
        "JOIN document d ON d.id = c.document_id "
        "WHERE ct.theme = ? AND d.fiscal_year IS NOT NULL "
        "GROUP BY d.bank_ticker, d.fiscal_year, d.fiscal_quarter"
    )
    with cursor() as (_, cur):
        cur.execute(render_sql(sql), (theme,))
        rows = fetchall_dicts(cur)
    out: dict[tuple[str, int, int], dict[str, float]] = {}
    for r in rows:
        ticker = r["bank_ticker"]
        if not ticker:
            continue
        fy = int(r["fiscal_year"])
        fq = int(r["fiscal_quarter"]) if r["fiscal_quarter"] is not None else 0
        tot = int(r["tot"] or 0)
        if tot == 0:
            continue
        pos = int(r["pos"] or 0)
        neg = int(r["neg"] or 0)
        unc = int(r["unc"] or 0)
        out[(ticker, fy, fq)] = {
            "net_sentiment": (pos - neg) / tot,
            "uncertainty_density": unc / tot,
            "total_words": tot,
        }
    return out


def filing_events(theme: str | None = None) -> list[dict]:
    """Return 8-K events; optionally restricted to filings with at least
    one chunk tagged with *theme*.
    """
    if theme is None:
        sql = (
            "SELECT fe.id, fe.document_id, fe.item_code, fe.item_label, fe.excerpt, "
            "       d.bank_ticker, d.fiscal_year, d.fiscal_quarter, d.filed_at "
            "FROM filing_event fe JOIN document d ON d.id = fe.document_id "
            "ORDER BY d.filed_at DESC"
        )
        params: tuple = ()
    else:
        # Pre-resolve doc IDs that have any chunk tagged with the theme.
        # An EXISTS subquery here forces a full scan over chunk_topic per
        # filing_event row; SELECTing the IDs first is much faster.
        with cursor() as (_, cur):
            cur.execute(
                render_sql(
                    "SELECT DISTINCT c.document_id FROM chunk c "
                    "JOIN chunk_topic ct ON ct.chunk_id = c.id "
                    "WHERE ct.theme = ?"
                ),
                (theme,),
            )
            doc_ids = [r[0] for r in cur.fetchall()]
        if not doc_ids:
            return []
        marks = ",".join("?" * len(doc_ids))
        sql = (
            f"SELECT fe.id, fe.document_id, fe.item_code, fe.item_label, fe.excerpt, "
            f"       d.bank_ticker, d.fiscal_year, d.fiscal_quarter, d.filed_at "
            f"FROM filing_event fe "
            f"JOIN document d ON d.id = fe.document_id "
            f"WHERE fe.document_id IN ({marks}) "
            f"ORDER BY d.filed_at DESC"
        )
        params = tuple(doc_ids)
    with cursor() as (_, cur):
        cur.execute(render_sql(sql), params)
        return fetchall_dicts(cur)

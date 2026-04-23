"""Hybrid retrieval: BM25-ish full-text + vector cosine + cross-encoder rerank.

Postgres path uses ``tsvector`` + ``pgvector`` (IVFFLAT cosine). The
SQLite path loads rows and does BM25 via ``rank-bm25`` and cosine in
Python. Both return the same ``RetrievalHit`` shape so downstream
doesn't care which backend is live.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from typing import Any

from rank_bm25 import BM25Okapi

from ..db import cursor, fetchall_dicts, render_sql
from .embeddings import embed_one
from .reranker import rerank
from .taxonomy import Taxonomy, load_taxonomy


@dataclass
class RetrievalHit:
    chunk_id: int
    document_id: int
    bank_ticker: str
    doc_type: str
    fiscal_year: int | None
    fiscal_quarter: int | None
    section_header: str | None
    char_start: int
    char_end: int
    text: str
    bm25_score: float
    vector_score: float
    rerank_score: float
    taxonomy_hits: list[str]

    @property
    def final_score(self) -> float:
        # Blend; weights tuned by taste + eval harness.
        return 0.4 * self.bm25_score + 0.4 * self.vector_score + 0.2 * self.rerank_score


def _tokenize(text: str) -> list[str]:
    return [t for t in text.lower().split() if t.isalnum() or "-" in t]


class HybridRetriever:
    def __init__(self, taxonomy: Taxonomy | None = None) -> None:
        self.taxonomy = taxonomy or load_taxonomy()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def search(
        self,
        query: str,
        *,
        bank: str | None = None,
        doc_type: str | None = None,
        fiscal_year: int | None = None,
        fiscal_quarter: int | None = None,
        top_k: int = 10,
        candidate_k: int = 40,
    ) -> list[RetrievalHit]:
        """Run full hybrid retrieval, return up to ``top_k`` hits."""
        expanded = self.taxonomy.expand_query(query)
        qvec = embed_one(expanded)

        with cursor() as (handle, cur):
            if handle.backend == "postgres":
                hits = self._search_postgres(
                    cur, expanded, qvec, bank, doc_type, fiscal_year, fiscal_quarter, candidate_k
                )
            else:
                hits = self._search_sqlite(
                    cur, expanded, qvec, bank, doc_type, fiscal_year, fiscal_quarter, candidate_k
                )

        if not hits:
            return []

        rerank_scores = rerank(query, [(h.text, h.bm25_score + h.vector_score) for h in hits])
        for h, s in zip(hits, rerank_scores, strict=False):
            h.rerank_score = float(s)

        hits.sort(key=lambda h: h.final_score, reverse=True)
        return hits[:top_k]

    # ------------------------------------------------------------------
    # Postgres
    # ------------------------------------------------------------------

    def _search_postgres(
        self,
        cur: Any,
        query: str,
        qvec: list[float],
        bank: str | None,
        doc_type: str | None,
        fiscal_year: int | None,
        fiscal_quarter: int | None,
        candidate_k: int,
    ) -> list[RetrievalHit]:
        where = ["1=1"]
        params: list[Any] = []
        if bank:
            where.append("d.bank_ticker = %s")
            params.append(bank)
        if doc_type:
            where.append("d.doc_type = %s")
            params.append(doc_type)
        if fiscal_year:
            where.append("d.fiscal_year = %s")
            params.append(fiscal_year)
        if fiscal_quarter:
            where.append("d.fiscal_quarter = %s")
            params.append(fiscal_quarter)
        where_clause = " AND ".join(where)

        # Union of two candidate sources: BM25 and vector.
        sql = f"""
        WITH bm25 AS (
            SELECT c.id AS chunk_id,
                   ts_rank(c.tsv, plainto_tsquery('english', %s)) AS score
            FROM chunk c JOIN document d ON d.id = c.document_id
            WHERE {where_clause} AND c.tsv @@ plainto_tsquery('english', %s)
            ORDER BY score DESC LIMIT %s
        ),
        vec AS (
            SELECT c.id AS chunk_id,
                   1 - (c.embedding <=> %s::vector) AS score
            FROM chunk c JOIN document d ON d.id = c.document_id
            WHERE {where_clause}
            ORDER BY c.embedding <=> %s::vector ASC LIMIT %s
        ),
        merged AS (
            SELECT chunk_id, MAX(CASE WHEN src='bm25' THEN score END) AS bm25_score,
                   MAX(CASE WHEN src='vec' THEN score END) AS vector_score
            FROM (
                SELECT chunk_id, score, 'bm25' AS src FROM bm25
                UNION ALL
                SELECT chunk_id, score, 'vec' AS src FROM vec
            ) x GROUP BY chunk_id
        )
        SELECT c.id AS chunk_id, c.document_id, d.bank_ticker, d.doc_type,
               d.fiscal_year, d.fiscal_quarter, c.section_header,
               c.char_start, c.char_end, c.text, c.taxonomy_hits,
               COALESCE(m.bm25_score, 0) AS bm25_score,
               COALESCE(m.vector_score, 0) AS vector_score
        FROM merged m
        JOIN chunk c ON c.id = m.chunk_id
        JOIN document d ON d.id = c.document_id
        """
        # Assemble params in the exact order placeholders appear:
        # bm25 cte uses: plainto, where params*, plainto, limit
        # vec cte uses: qvec, where params*, qvec, limit
        all_params: list[Any] = [query, *params, query, candidate_k, qvec, *params, qvec, candidate_k]
        cur.execute(sql, all_params)
        rows = fetchall_dicts(cur)
        return [self._row_to_hit(r) for r in rows]

    # ------------------------------------------------------------------
    # SQLite fallback
    # ------------------------------------------------------------------

    def _search_sqlite(
        self,
        cur: Any,
        query: str,
        qvec: list[float],
        bank: str | None,
        doc_type: str | None,
        fiscal_year: int | None,
        fiscal_quarter: int | None,
        candidate_k: int,
    ) -> list[RetrievalHit]:
        clauses = ["1=1"]
        params: list[Any] = []
        if bank:
            clauses.append("d.bank_ticker = ?")
            params.append(bank)
        if doc_type:
            clauses.append("d.doc_type = ?")
            params.append(doc_type)
        if fiscal_year:
            clauses.append("d.fiscal_year = ?")
            params.append(fiscal_year)
        if fiscal_quarter:
            clauses.append("d.fiscal_quarter = ?")
            params.append(fiscal_quarter)
        sql = f"""
        SELECT c.id AS chunk_id, c.document_id, d.bank_ticker, d.doc_type,
               d.fiscal_year, d.fiscal_quarter, c.section_header,
               c.char_start, c.char_end, c.text, c.taxonomy_hits, c.embedding
        FROM chunk c JOIN document d ON d.id = c.document_id
        WHERE {' AND '.join(clauses)}
        """
        cur.execute(sql, params)
        rows = fetchall_dicts(cur)
        if not rows:
            return []

        # BM25 over the candidate set
        corpus_tokens = [_tokenize(r["text"]) for r in rows]
        bm25 = BM25Okapi(corpus_tokens)
        q_tokens = _tokenize(query)
        bm25_scores = bm25.get_scores(q_tokens) if q_tokens else [0.0] * len(rows)

        # Cosine similarity
        import numpy as np

        qv = np.asarray(qvec, dtype=float)
        qv_norm = qv / (np.linalg.norm(qv) or 1.0)
        vec_scores: list[float] = []
        for r in rows:
            emb = r.get("embedding")
            if not emb:
                vec_scores.append(0.0)
                continue
            arr = np.asarray(json.loads(emb), dtype=float)
            arr = arr / (np.linalg.norm(arr) or 1.0)
            vec_scores.append(float(qv_norm @ arr))

        # Pair each row with its scores, truncate to top candidate_k by blend
        triples = list(zip(rows, bm25_scores, vec_scores, strict=False))
        triples.sort(key=lambda t: 0.5 * t[1] + 0.5 * t[2], reverse=True)
        triples = triples[:candidate_k]

        hits = []
        for row, bm25_score, vec_score in triples:
            tax_raw = row.get("taxonomy_hits")
            if isinstance(tax_raw, str):
                try:
                    tax_hits = json.loads(tax_raw)
                except Exception:
                    tax_hits = []
            elif isinstance(tax_raw, list):
                tax_hits = tax_raw
            else:
                tax_hits = []
            hits.append(
                RetrievalHit(
                    chunk_id=row["chunk_id"],
                    document_id=row["document_id"],
                    bank_ticker=row["bank_ticker"],
                    doc_type=row["doc_type"],
                    fiscal_year=row.get("fiscal_year"),
                    fiscal_quarter=row.get("fiscal_quarter"),
                    section_header=row.get("section_header"),
                    char_start=row["char_start"],
                    char_end=row["char_end"],
                    text=row["text"],
                    bm25_score=_normalize(bm25_score, bm25_scores),
                    vector_score=vec_score,
                    rerank_score=0.0,
                    taxonomy_hits=tax_hits,
                )
            )
        return hits

    # ------------------------------------------------------------------
    def _row_to_hit(self, r: dict[str, Any]) -> RetrievalHit:
        tax = r.get("taxonomy_hits") or []
        if isinstance(tax, str):
            try:
                tax = json.loads(tax)
            except Exception:
                tax = []
        return RetrievalHit(
            chunk_id=r["chunk_id"],
            document_id=r["document_id"],
            bank_ticker=r["bank_ticker"],
            doc_type=r["doc_type"],
            fiscal_year=r.get("fiscal_year"),
            fiscal_quarter=r.get("fiscal_quarter"),
            section_header=r.get("section_header"),
            char_start=r["char_start"],
            char_end=r["char_end"],
            text=r["text"],
            bm25_score=float(r.get("bm25_score") or 0),
            vector_score=float(r.get("vector_score") or 0),
            rerank_score=0.0,
            taxonomy_hits=list(tax),
        )


def _normalize(value: float, among: list[float] | Any) -> float:
    try:
        vmax = max(among)
    except Exception:
        return 0.0
    if not vmax or math.isnan(vmax):
        return 0.0
    return float(value) / float(vmax)

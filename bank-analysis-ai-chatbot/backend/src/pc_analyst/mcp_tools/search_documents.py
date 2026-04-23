"""search_documents tool."""

from __future__ import annotations

from typing import Any

from ..retrieval.hybrid import HybridRetriever


def search_documents(
    query: str,
    *,
    bank: str | None = None,
    doc_type: str | None = None,
    fiscal_year: int | None = None,
    fiscal_quarter: int | None = None,
    top_k: int = 8,
) -> dict[str, Any]:
    retriever = HybridRetriever()
    hits = retriever.search(
        query,
        bank=bank,
        doc_type=doc_type,
        fiscal_year=fiscal_year,
        fiscal_quarter=fiscal_quarter,
        top_k=top_k,
    )
    return {
        "query": query,
        "filters": {
            "bank": bank,
            "doc_type": doc_type,
            "fiscal_year": fiscal_year,
            "fiscal_quarter": fiscal_quarter,
        },
        "hits": [
            {
                "chunk_id": h.chunk_id,
                "document_id": h.document_id,
                "bank": h.bank_ticker,
                "doc_type": h.doc_type,
                "fiscal_year": h.fiscal_year,
                "fiscal_quarter": h.fiscal_quarter,
                "section": h.section_header,
                "char_start": h.char_start,
                "char_end": h.char_end,
                "text": h.text,
                "taxonomy_hits": h.taxonomy_hits,
                "scores": {
                    "bm25": round(h.bm25_score, 4),
                    "vector": round(h.vector_score, 4),
                    "rerank": round(h.rerank_score, 4),
                    "final": round(h.final_score, 4),
                },
            }
            for h in hits
        ],
    }

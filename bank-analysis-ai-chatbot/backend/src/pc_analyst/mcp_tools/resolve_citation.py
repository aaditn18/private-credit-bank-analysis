"""resolve_citation tool: chunk id -> full source context + surrounding window."""

from __future__ import annotations

from typing import Any

from ..db import cursor, fetchone_dict, render_sql


SURROUNDING_CHARS = 1200


def resolve_citation(chunk_id: int) -> dict[str, Any]:
    with cursor() as (handle, cur):
        cur.execute(
            render_sql(
                "SELECT c.id, c.document_id, c.chunk_index, c.section_header, c.page, "
                "c.char_start, c.char_end, c.text, c.taxonomy_hits, "
                "d.bank_ticker, d.doc_type, d.fiscal_year, d.fiscal_quarter, "
                "d.source_path, d.source_url, d.title, d.raw_text "
                "FROM chunk c JOIN document d ON d.id = c.document_id "
                "WHERE c.id = ?"
            ),
            (chunk_id,),
        )
        row = fetchone_dict(cur)
    if not row:
        return {"error": f"chunk {chunk_id} not found"}

    raw: str = row["raw_text"]
    start = max(0, row["char_start"] - SURROUNDING_CHARS)
    end = min(len(raw), row["char_end"] + SURROUNDING_CHARS)
    context = raw[start:end]
    highlight_start = row["char_start"] - start
    highlight_end = row["char_end"] - start

    # Don't leak raw_text in the returned dict (can be megabytes).
    row.pop("raw_text", None)
    row["context"] = context
    row["highlight_start"] = highlight_start
    row["highlight_end"] = highlight_end
    row["surrounding_chars"] = SURROUNDING_CHARS
    return row

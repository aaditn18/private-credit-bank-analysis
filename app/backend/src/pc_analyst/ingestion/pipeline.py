"""End-to-end ingestion: parse -> chunk -> embed -> persist.

Keeps offsets exact: the text stored in ``document.raw_text`` is the
same string that ``chunk.char_start`` / ``chunk.char_end`` index into,
so a citation can be resolved back to a highlighted span without any
re-parsing.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from rich.console import Console

from ..banks import BANK_REGISTRY
from ..db import cursor, render_sql, serialize_embedding
from ..retrieval.embeddings import embed
from ..retrieval.taxonomy import Taxonomy, load_taxonomy
from .chunker import Chunk, SectionChunker
from .edgar import LocalFiling, discover_local_filings
from .html_parser import HtmlExtract, extract_text_from_path

console = Console()


def upsert_bank(ticker: str) -> None:
    meta = BANK_REGISTRY.get(ticker)
    if not meta:
        # Insert a bare record so FK constraints still succeed.
        meta = {"name": ticker, "rssd_id": None, "cik": None, "peer_group": None}
    with cursor() as (handle, cur):
        if handle.backend == "postgres":
            sql = (
                "INSERT INTO bank (ticker, name, rssd_id, cik, peer_group) "
                "VALUES (%s, %s, %s, %s, %s) "
                "ON CONFLICT (ticker) DO UPDATE SET "
                "name = EXCLUDED.name, rssd_id = EXCLUDED.rssd_id, "
                "cik = EXCLUDED.cik, peer_group = EXCLUDED.peer_group"
            )
            cur.execute(
                render_sql(sql),
                (ticker, meta["name"], meta["rssd_id"], meta["cik"], meta["peer_group"]),
            )
        else:
            # Use ON CONFLICT DO UPDATE rather than INSERT OR REPLACE to avoid
            # triggering ON DELETE SET NULL on referencing rows.
            cur.execute(
                "INSERT INTO bank (ticker, name, rssd_id, cik, peer_group) "
                "VALUES (?, ?, ?, ?, ?) "
                "ON CONFLICT(ticker) DO UPDATE SET "
                "name = excluded.name, rssd_id = excluded.rssd_id, "
                "cik = excluded.cik, peer_group = excluded.peer_group",
                (ticker, meta["name"], meta["rssd_id"], meta["cik"], meta["peer_group"]),
            )


# ---------------------------------------------------------------------------
# Ingestion core
# ---------------------------------------------------------------------------

@dataclass
class IngestResult:
    document_id: int
    chunk_count: int
    already_ingested: bool


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def ingest_filing_file(
    *,
    ticker: str,
    doc_type: str,
    fiscal_year: int,
    fiscal_quarter: int,
    source_path: Path,
    source_url: str | None = None,
    title: str | None = None,
    filed_at: date | None = None,
    taxonomy: Taxonomy | None = None,
) -> IngestResult:
    """Parse, chunk, embed, and persist a single filing."""
    taxonomy = taxonomy or load_taxonomy()
    upsert_bank(ticker)

    extract: HtmlExtract = extract_text_from_path(source_path)
    text = extract.text
    digest = _sha256(text)

    # Check for existing identical document
    with cursor() as (handle, cur):
        check_sql = (
            "SELECT id FROM document WHERE bank_ticker = ? AND doc_type = ? "
            "AND fiscal_year = ? AND fiscal_quarter = ? AND raw_text_sha256 = ?"
        )
        cur.execute(
            render_sql(check_sql),
            (ticker, doc_type, fiscal_year, fiscal_quarter, digest),
        )
        row = cur.fetchone()
        if row:
            doc_id = row[0] if not isinstance(row, dict) else row["id"]
            return IngestResult(document_id=doc_id, chunk_count=0, already_ingested=True)

    chunker = SectionChunker()
    chunks: list[Chunk] = chunker.chunk(extract)

    for ch in chunks:
        ch.taxonomy_hits = taxonomy.match_concepts(ch.text)

    embed_texts = [ch.text for ch in chunks]
    vectors = embed(embed_texts) if embed_texts else []

    with cursor() as (handle, cur):
        ins_sql = (
            "INSERT INTO document (bank_ticker, doc_type, fiscal_year, fiscal_quarter, "
            "filed_at, source_path, source_url, title, raw_text, raw_text_sha256) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
            + ("RETURNING id" if handle.backend == "postgres" else "")
        )
        cur.execute(
            render_sql(ins_sql),
            (
                ticker,
                doc_type,
                fiscal_year,
                fiscal_quarter,
                filed_at.isoformat() if filed_at else None,
                str(source_path),
                source_url,
                title,
                text,
                digest,
            ),
        )
        if handle.backend == "postgres":
            doc_id = cur.fetchone()[0]
        else:
            doc_id = cur.lastrowid

        for ch, vec in zip(chunks, vectors, strict=False):
            emb = serialize_embedding(vec)
            if handle.backend == "postgres":
                chunk_sql = (
                    "INSERT INTO chunk (document_id, chunk_index, section_header, "
                    "page, char_start, char_end, text, token_count, taxonomy_hits, "
                    "embedding) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
                )
                cur.execute(
                    chunk_sql,
                    (
                        doc_id,
                        ch.chunk_index,
                        ch.section_header,
                        ch.page,
                        ch.char_start,
                        ch.char_end,
                        ch.text,
                        ch.token_count,
                        ch.taxonomy_hits,
                        emb,
                    ),
                )
            else:
                chunk_sql = (
                    "INSERT INTO chunk (document_id, chunk_index, section_header, "
                    "page, char_start, char_end, text, token_count, taxonomy_hits, "
                    "embedding) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                )
                cur.execute(
                    chunk_sql,
                    (
                        doc_id,
                        ch.chunk_index,
                        ch.section_header,
                        ch.page,
                        ch.char_start,
                        ch.char_end,
                        ch.text,
                        ch.token_count,
                        json.dumps(ch.taxonomy_hits),
                        emb,
                    ),
                )

    return IngestResult(document_id=doc_id, chunk_count=len(chunks), already_ingested=False)


def ingest_bank_filings(
    root: Path,
    tickers: list[str],
    *,
    max_per_type: int | None = None,
) -> list[IngestResult]:
    """Discover and ingest filings under ``root`` for the listed tickers."""
    tax = load_taxonomy()
    filings: list[LocalFiling] = discover_local_filings(root, tickers)
    if max_per_type:
        counter: dict[tuple[str, str], int] = {}
        kept: list[LocalFiling] = []
        for f in sorted(filings, key=lambda f: (f.fiscal_year, f.fiscal_quarter), reverse=True):
            key = (f.ticker, f.doc_type)
            counter[key] = counter.get(key, 0) + 1
            if counter[key] <= max_per_type:
                kept.append(f)
        filings = kept

    results: list[IngestResult] = []
    for filing in filings:
        console.print(
            f"[bold]Ingesting[/bold] {filing.ticker} {filing.doc_type} "
            f"{filing.fiscal_year}Q{filing.fiscal_quarter} — {filing.source_path}"
        )
        result = ingest_filing_file(
            ticker=filing.ticker,
            doc_type=filing.doc_type,
            fiscal_year=filing.fiscal_year,
            fiscal_quarter=filing.fiscal_quarter,
            source_path=filing.source_path,
            taxonomy=tax,
        )
        if result.already_ingested:
            console.print(f"  [yellow]skipped[/yellow] (already ingested, doc {result.document_id})")
        else:
            console.print(f"  [green]ok[/green] doc {result.document_id}, {result.chunk_count} chunks")
        results.append(result)

    return results

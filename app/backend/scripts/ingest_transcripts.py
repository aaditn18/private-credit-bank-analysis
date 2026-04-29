"""Ingest earnings call transcripts into the document/chunk tables.

Transcript files follow the naming convention TICKER_YEAR_Q.txt
(e.g. JPM_2024_Q1.txt) and contain plain text in Motley Fool format.

Usage (from backend/):
    python scripts/ingest_transcripts.py [--dir PATH] [--tickers JPM,BAC]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from pc_analyst.db import cursor, render_sql, serialize_embedding
from pc_analyst.ingestion.html_parser import HtmlExtract, Section
from pc_analyst.ingestion.chunker import SectionChunker
from pc_analyst.ingestion.pipeline import upsert_bank
from pc_analyst.retrieval.embeddings import embed
from pc_analyst.retrieval.taxonomy import load_taxonomy

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_TRANSCRIPT_DIR = REPO_ROOT / "Earnings Calls" / "transcripts_final"

# Sections we care about in Motley Fool transcripts
SECTION_MARKERS = [
    "Prepared Remarks:",
    "Questions and Answers:",
    "Call Participants:",
]


def parse_filename(path: Path) -> tuple[str, int, int] | None:
    """JPM_2024_Q1.txt → ('JPM', 2024, 1) or None if doesn't match."""
    m = re.match(r"^([A-Z]+)_(\d{4})_Q(\d)\.txt$", path.name, re.IGNORECASE)
    if not m:
        return None
    return m.group(1).upper(), int(m.group(2)), int(m.group(3))


def text_to_extract(raw: str) -> HtmlExtract:
    """Build an HtmlExtract from plain transcript text, detecting sections."""
    # Normalize line endings and strip leading boilerplate (Motley Fool image tag)
    text = raw.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"^Image source:.*\n*", "", text)
    text = text.strip() + "\n"

    sections: list[Section] = []
    cursor_pos = 0
    for line in text.splitlines(keepends=True):
        stripped = line.strip()
        for marker in SECTION_MARKERS:
            if stripped.startswith(marker):
                sections.append(Section(header=marker.rstrip(":"), start=cursor_pos))
                break
        cursor_pos += len(line)

    # Close section ends
    for i, sec in enumerate(sections):
        sec.end = sections[i + 1].start if i + 1 < len(sections) else len(text)

    return HtmlExtract(text=text, sections=sections)


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def ingest_transcript(path: Path, ticker: str, year: int, quarter: int, taxonomy) -> str:
    """Ingest one transcript. Returns 'ok', 'skipped', or 'error:...'."""
    upsert_bank(ticker)

    raw = path.read_text(encoding="utf-8", errors="replace")
    extract = text_to_extract(raw)
    text = extract.text
    digest = _sha256(text)

    with cursor() as (handle, cur):
        cur.execute(
            render_sql(
                "SELECT id FROM document WHERE bank_ticker = ? AND doc_type = ? "
                "AND fiscal_year = ? AND fiscal_quarter = ? AND raw_text_sha256 = ?"
            ),
            (ticker, "earnings_call", year, quarter, digest),
        )
        if cur.fetchone():
            return "skipped"

    chunker = SectionChunker()
    chunks = chunker.chunk(extract)
    for ch in chunks:
        ch.taxonomy_hits = taxonomy.match_concepts(ch.text)

    vectors = embed([ch.text for ch in chunks]) if chunks else []

    with cursor() as (handle, cur):
        ins_sql = (
            "INSERT INTO document (bank_ticker, doc_type, fiscal_year, fiscal_quarter, "
            "source_path, raw_text, raw_text_sha256) "
            "VALUES (?, ?, ?, ?, ?, ?, ?) "
            + ("RETURNING id" if handle.backend == "postgres" else "")
        )
        cur.execute(
            render_sql(ins_sql),
            (ticker, "earnings_call", year, quarter, str(path), text, digest),
        )
        doc_id = cur.fetchone()[0] if handle.backend == "postgres" else cur.lastrowid

        chunk_sql = (
            "INSERT INTO chunk (document_id, chunk_index, section_header, "
            "page, char_start, char_end, text, token_count, taxonomy_hits, embedding) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        for ch, vec in zip(chunks, vectors, strict=False):
            cur.execute(
                render_sql(chunk_sql),
                (
                    doc_id, ch.chunk_index, ch.section_header,
                    ch.page, ch.char_start, ch.char_end,
                    ch.text, ch.token_count,
                    json.dumps(ch.taxonomy_hits),
                    serialize_embedding(vec),
                ),
            )

    return f"ok ({len(chunks)} chunks)"


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest earnings call transcripts")
    parser.add_argument("--dir", type=Path, default=DEFAULT_TRANSCRIPT_DIR)
    parser.add_argument("--tickers", help="Comma-separated tickers to limit (default: all)")
    args = parser.parse_args()

    tx_dir: Path = args.dir
    if not tx_dir.exists():
        sys.exit(f"Transcript directory not found: {tx_dir}")

    filter_tickers: set[str] | None = (
        {t.strip().upper() for t in args.tickers.split(",")} if args.tickers else None
    )

    taxonomy = load_taxonomy()
    files = sorted(tx_dir.glob("*.txt"))
    print(f"Found {len(files)} transcript files in {tx_dir}")

    ok = skipped = errors = 0
    for path in files:
        parsed = parse_filename(path)
        if parsed is None:
            print(f"  SKIP (bad name): {path.name}")
            continue
        ticker, year, quarter = parsed
        if filter_tickers and ticker not in filter_tickers:
            continue
        result = ingest_transcript(path, ticker, year, quarter, taxonomy)
        if result.startswith("ok"):
            print(f"  ok  {ticker} {year}Q{quarter} — {result}")
            ok += 1
        elif result == "skipped":
            print(f"  --  {ticker} {year}Q{quarter} already ingested")
            skipped += 1
        else:
            print(f"  ERR {ticker} {year}Q{quarter}: {result}")
            errors += 1

    print(f"\nDone. {ok} ingested, {skipped} skipped, {errors} errors.")


if __name__ == "__main__":
    main()

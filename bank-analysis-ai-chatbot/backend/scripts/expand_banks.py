"""Scale out from the 3 pilot banks to the 10-bank MVP (or beyond).

For each new ticker we:
  1. Resolve the CIK from the static bank registry
  2. Pull the most recent 10-K, 10-Q, 8-K filings via EDGAR
  3. Download the primary document HTML and drop it into the local
     ``<root>/<TICKER>/<DOC_TYPE>/<TICKER>_<DOC_TYPE>_<YEAR>_Q<N>/primary-document.html``
     layout — matching the DFS/FHN/FLG folders already on disk.
  4. Hand off to the existing ingestion pipeline.

Because we reuse the on-disk layout, re-running this script is
idempotent and the chunker sees exactly the same input regardless of
whether a filing came from a manual download or this script.
"""

from __future__ import annotations

import time
from datetime import date
from pathlib import Path

import typer
from rich.console import Console

from pc_analyst.banks import BANK_REGISTRY
from pc_analyst.config import REPO_ROOT
from pc_analyst.db import apply_migrations
from pc_analyst.ingestion.edgar import fetch_primary_document, list_recent_filings
from pc_analyst.ingestion.pipeline import ingest_filing_file

console = Console()
app = typer.Typer(add_completion=False)


FORM_TO_DIR = {"10-K": "10-K", "10-Q": "10-Q", "8-K": "8-K"}


def _quarter_from_date(filing_date: str) -> tuple[int, int]:
    year, month, _ = filing_date.split("-")
    q = (int(month) - 1) // 3 + 1
    return int(year), q


@app.command()
def main(
    add: str = typer.Option(
        ...,
        "--add",
        help="Comma- or space-separated tickers to add, e.g. 'JPM,BAC,WFC'",
    ),
    root: Path = typer.Option(REPO_ROOT, "--root"),
    forms: str = typer.Option("10-K,10-Q,8-K", "--forms"),
    per_form: int = typer.Option(4, "--per-form", help="Most-recent N filings per form"),
    fetch_only: bool = typer.Option(
        False, "--fetch-only", help="Only download; skip ingestion"
    ),
    sleep: float = typer.Option(0.2, "--sleep", help="Pause between EDGAR requests (seconds)"),
) -> None:
    apply_migrations()
    tickers = [t for t in add.replace(",", " ").split() if t]
    form_list = [f.strip() for f in forms.split(",")]

    for ticker in tickers:
        meta = BANK_REGISTRY.get(ticker)
        if not meta or not meta.get("cik"):
            console.print(f"[red]skip[/red] {ticker}: no CIK in registry")
            continue
        cik = str(meta["cik"])
        console.rule(f"{ticker} (CIK {cik})")
        try:
            filings = list_recent_filings(cik, form_list, limit=per_form * len(form_list))
        except Exception as e:
            console.print(f"  [red]EDGAR error:[/red] {e}")
            continue

        # Keep only the per_form most recent per form
        kept: list[dict] = []
        counters: dict[str, int] = {}
        for f in filings:
            if counters.get(f["form"], 0) >= per_form:
                continue
            kept.append(f)
            counters[f["form"]] = counters.get(f["form"], 0) + 1

        for entry in kept:
            form = entry["form"]
            year, q = _quarter_from_date(entry["filingDate"])
            dest_dir = (
                root
                / ticker
                / FORM_TO_DIR[form]
                / f"{ticker}_{form}_{year}_Q{q}"
            )
            dest_dir.mkdir(parents=True, exist_ok=True)
            dest_file = dest_dir / "primary-document.html"
            if not dest_file.exists():
                try:
                    html = fetch_primary_document(
                        cik=cik,
                        accession=entry["accessionNumber"],
                        primary_doc=entry["primaryDocument"],
                    )
                    dest_file.write_text(html)
                    console.print(
                        f"  [green]downloaded[/green] {form} {entry['filingDate']} -> {dest_file.relative_to(root)}"
                    )
                except Exception as e:
                    console.print(
                        f"  [red]fetch failed[/red] {form} {entry['filingDate']}: {e}"
                    )
                    continue
                time.sleep(sleep)
            else:
                console.print(
                    f"  [yellow]exists[/yellow] {form} {entry['filingDate']} -> {dest_file.relative_to(root)}"
                )

            if not fetch_only:
                try:
                    res = ingest_filing_file(
                        ticker=ticker,
                        doc_type=form,
                        fiscal_year=year,
                        fiscal_quarter=q,
                        source_path=dest_file,
                        filed_at=date.fromisoformat(entry["filingDate"]),
                    )
                    if res.already_ingested:
                        console.print(f"    skipped (already ingested, doc {res.document_id})")
                    else:
                        console.print(f"    ingested doc {res.document_id}, {res.chunk_count} chunks")
                except Exception as e:
                    console.print(f"    [red]ingest failed:[/red] {e}")


if __name__ == "__main__":
    app()

"""Ingest filings from the local on-disk layout."""

from __future__ import annotations

from pathlib import Path

import typer

from pc_analyst.config import REPO_ROOT
from pc_analyst.db import apply_migrations
from pc_analyst.ingestion.pipeline import ingest_bank_filings

app = typer.Typer(add_completion=False)


@app.command()
def main(
    banks: str = typer.Option(
        ...,
        "--banks",
        help="Comma- or space-separated tickers to ingest, e.g. 'DFS,FHN,FLG'",
    ),
    root: Path = typer.Option(REPO_ROOT, "--root", help="Directory containing <TICKER>/ folders"),
    max_per_type: int | None = typer.Option(
        None, "--max-per-type", help="Keep only the N most recent per (ticker, doc_type)"
    ),
    init: bool = typer.Option(True, "--init/--no-init", help="Run migrations first"),
) -> None:
    if init:
        apply_migrations()
    tickers = [t for t in banks.replace(",", " ").split() if t]
    results = ingest_bank_filings(root=root, tickers=tickers, max_per_type=max_per_type)
    typer.echo(f"\nDone. {len(results)} filings processed.")


if __name__ == "__main__":
    app()

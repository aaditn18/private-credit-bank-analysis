"""Seed the Call Report fact table from data/seed/call_report_seed.json.

Makes demos work without FFIEC credentials. Run AFTER init_db.
"""

from __future__ import annotations

import typer
from rich.console import Console

from pc_analyst.db import apply_migrations, cursor, render_sql
from pc_analyst.ingestion.ffiec import load_seed_facts
from pc_analyst.ingestion.pipeline import upsert_bank

console = Console()
app = typer.Typer(add_completion=False)


@app.command()
def main(init: bool = typer.Option(True, "--init/--no-init")) -> None:
    if init:
        apply_migrations()
    facts = load_seed_facts()
    if not facts:
        console.print("[yellow]no seed facts found — see data/seed/call_report_seed.json[/yellow]")
        raise typer.Exit(0)

    tickers = {f.bank_ticker for f in facts if f.bank_ticker}
    for t in tickers:
        upsert_bank(t)

    with cursor() as (handle, cur):
        for fact in facts:
            if handle.backend == "postgres":
                cur.execute(
                    "INSERT INTO call_report_fact (rssd_id, bank_ticker, quarter, schedule, "
                    "line_item, label, value_numeric, value_text, as_of_date, source_url) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
                    "ON CONFLICT (rssd_id, quarter, schedule, line_item) DO UPDATE SET "
                    "value_numeric = EXCLUDED.value_numeric, value_text = EXCLUDED.value_text, "
                    "label = EXCLUDED.label, bank_ticker = EXCLUDED.bank_ticker",
                    (
                        fact.rssd_id, fact.bank_ticker, fact.quarter, fact.schedule,
                        fact.line_item, fact.label, fact.value_numeric, fact.value_text,
                        fact.as_of_date, fact.source_url,
                    ),
                )
            else:
                cur.execute(
                    render_sql(
                        "INSERT OR REPLACE INTO call_report_fact "
                        "(rssd_id, bank_ticker, quarter, schedule, line_item, label, "
                        "value_numeric, value_text, as_of_date, source_url) "
                        "VALUES (?,?,?,?,?,?,?,?,?,?)"
                    ),
                    (
                        fact.rssd_id, fact.bank_ticker, fact.quarter, fact.schedule,
                        fact.line_item, fact.label, fact.value_numeric, fact.value_text,
                        fact.as_of_date, fact.source_url,
                    ),
                )
    console.print(f"[green]seeded {len(facts)} call-report facts[/green]")


if __name__ == "__main__":
    app()

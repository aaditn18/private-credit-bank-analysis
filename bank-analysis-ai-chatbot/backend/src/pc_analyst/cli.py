"""Small Typer CLI for manual poking."""

from __future__ import annotations

import json

import typer
from rich.console import Console

from .agent.loop import AgentLoop
from .db import apply_migrations

app = typer.Typer(add_completion=False, help="Private Credit Analyst Tool")
console = Console()


@app.command()
def init_db() -> None:
    """Apply schema migrations (Postgres or SQLite)."""
    apply_migrations()
    console.print("[green]migrations applied[/green]")


@app.command()
def ask(question: str) -> None:
    """Run the agent end-to-end for a single question."""
    result = AgentLoop().run(question)
    console.rule(f"Run {result.run_id}")
    console.print(result.answer_markdown)
    console.rule("Trace")
    for step in result.reasoning_steps:
        console.print(f"[{step['step_index']}] {step['step_type']} — {step['summary']}")


@app.command()
def trace(run_id: int) -> None:
    """Print the reasoning trace of a persisted run."""
    from .db import cursor, fetchall_dicts, render_sql

    with cursor() as (_, cur):
        cur.execute(
            render_sql("SELECT * FROM reasoning_step WHERE run_id = ? ORDER BY step_index"),
            (run_id,),
        )
        for row in fetchall_dicts(cur):
            console.print(json.dumps(row, default=str, indent=2))


def main() -> None:
    app()


if __name__ == "__main__":
    main()

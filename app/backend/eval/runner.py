"""Eval harness — run the agent against graded questions.

Metrics:
  - bank_recall:     fraction of expected banks present in the plan.banks
  - concept_recall:  fraction of expected concepts present in plan.concepts
  - doc_type_hit:    whether at least one citation comes from the expected doc types
  - keyword_hit:     whether all must_contain_keywords appear in the answer
  - overall_pass:    all of the above
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import typer
import yaml
from rich.console import Console
from rich.table import Table

from pc_analyst.agent.decomposer import decompose
from pc_analyst.agent.loop import AgentLoop


console = Console()
app = typer.Typer(add_completion=False)

DEFAULT_PATH = Path(__file__).resolve().parent / "questions.yaml"


@dataclass
class EvalResult:
    id: str
    question: str
    bank_recall: float
    concept_recall: float
    doc_type_hit: bool
    keyword_hit: bool
    passed: bool


def run_eval(path: Path, execute: bool) -> list[EvalResult]:
    data = yaml.safe_load(path.read_text())
    results: list[EvalResult] = []

    for q in data.get("questions", []):
        plan = decompose(q["question"])
        bank_recall = _recall(q.get("expect_banks", []), plan.banks)
        concept_recall = _recall(q.get("expect_concepts", []), plan.concepts)

        doc_type_hit = True
        keyword_hit = True

        if execute:
            try:
                run = AgentLoop().run(q["question"])
            except Exception as e:
                console.print(f"[red]{q['id']} run failed:[/red] {e}")
                run = None
            if run:
                expected_types = set(q.get("expect_doc_types") or [])
                if expected_types:
                    cit_types = {c["doc_type"] for c in run.citations}
                    doc_type_hit = bool(expected_types & cit_types)
                for kw in q.get("must_contain_keywords") or []:
                    if kw.lower() not in run.answer_markdown.lower():
                        keyword_hit = False
                        break

        passed = (
            bank_recall == 1.0
            and concept_recall == 1.0
            and doc_type_hit
            and keyword_hit
        )
        results.append(
            EvalResult(
                id=q["id"],
                question=q["question"],
                bank_recall=bank_recall,
                concept_recall=concept_recall,
                doc_type_hit=doc_type_hit,
                keyword_hit=keyword_hit,
                passed=passed,
            )
        )
    return results


def _recall(expected: list[str], actual: list[str]) -> float:
    if not expected:
        return 1.0
    hits = sum(1 for e in expected if e in actual)
    return hits / len(expected)


def print_report(results: list[EvalResult]) -> None:
    table = Table(title="Eval Report")
    table.add_column("id")
    table.add_column("bank_recall")
    table.add_column("concept_recall")
    table.add_column("doc_type")
    table.add_column("keyword")
    table.add_column("pass")
    table.add_column("question", overflow="fold")
    for r in results:
        table.add_row(
            r.id,
            f"{r.bank_recall:.2f}",
            f"{r.concept_recall:.2f}",
            "ok" if r.doc_type_hit else "miss",
            "ok" if r.keyword_hit else "miss",
            "[green]PASS[/green]" if r.passed else "[red]FAIL[/red]",
            r.question,
        )
    console.print(table)
    total = len(results)
    passed = sum(1 for r in results if r.passed)
    console.print(f"\n{passed}/{total} questions passing ({passed/total:.0%})")


@app.command()
def main(
    path: Path = typer.Option(DEFAULT_PATH, "--path", exists=True),
    execute: bool = typer.Option(
        False,
        "--execute/--plan-only",
        help="Actually run the agent (requires ingested filings + DB). Default is plan-only.",
    ),
) -> None:
    results = run_eval(path, execute=execute)
    print_report(results)
    sys.exit(0 if all(r.passed for r in results) else 1)


if __name__ == "__main__":
    app()

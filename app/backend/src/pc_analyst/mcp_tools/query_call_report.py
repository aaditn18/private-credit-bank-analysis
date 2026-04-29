"""query_call_report tool."""

from __future__ import annotations

from typing import Any

from ..db import cursor, fetchall_dicts, render_sql
from ..retrieval.taxonomy import load_taxonomy


def query_call_report(
    banks: list[str],
    *,
    quarters: list[str] | None = None,
    concept: str | None = None,
    mnemonics: list[str] | None = None,
) -> dict[str, Any]:
    tax = load_taxonomy()
    line_items: list[tuple[str, str]] = []  # (schedule, line_item)
    resolved_mnemonics: list[str] = list(mnemonics or [])
    concept_label = None
    if concept:
        if concept not in tax.concepts:
            return {"error": f"Unknown concept: {concept}", "known": list(tax.concepts.keys())}
        concept_label = tax.concepts[concept].label
        for li in tax.concept_line_items(concept):
            line_items.append((li.schedule, li.line_item))
            if li.mnemonic:
                resolved_mnemonics.append(li.mnemonic)

    params: list[Any] = []

    with cursor() as (handle, cur):
        if handle.backend == "postgres":
            clauses = ["bank_ticker = ANY(%s)"]
            params.append(banks)
            if quarters:
                clauses.append("quarter = ANY(%s)")
                params.append(quarters)
            or_parts: list[str] = []
            if line_items:
                or_parts.append(
                    "(schedule, line_item) IN ("
                    + ", ".join(["(%s, %s)"] * len(line_items))
                    + ")"
                )
                for sched, li in line_items:
                    params.extend([sched, li])
            if resolved_mnemonics:
                or_parts.append("line_item = ANY(%s)")
                params.append(resolved_mnemonics)
            if or_parts:
                clauses.append("(" + " OR ".join(or_parts) + ")")
            sql = (
                "SELECT rssd_id, bank_ticker, quarter, schedule, line_item, label, "
                "value_numeric, value_text, as_of_date, source_url FROM call_report_fact "
                "WHERE " + " AND ".join(clauses) + " ORDER BY bank_ticker, quarter, schedule, line_item"
            )
            cur.execute(sql, params)
        else:
            qmarks_banks = ",".join("?" * len(banks))
            clauses = [f"bank_ticker IN ({qmarks_banks})"]
            params.extend(banks)
            if quarters:
                qmarks_qs = ",".join("?" * len(quarters))
                clauses.append(f"quarter IN ({qmarks_qs})")
                params.extend(quarters)
            or_parts = []
            if line_items:
                or_parts.append(
                    "(" + " OR ".join(["(schedule = ? AND line_item = ?)"] * len(line_items)) + ")"
                )
                for sched, li in line_items:
                    params.extend([sched, li])
            if resolved_mnemonics:
                qmarks_m = ",".join("?" * len(resolved_mnemonics))
                or_parts.append(f"line_item IN ({qmarks_m})")
                params.extend(resolved_mnemonics)
            if or_parts:
                clauses.append("(" + " OR ".join(or_parts) + ")")
            sql = (
                "SELECT rssd_id, bank_ticker, quarter, schedule, line_item, label, "
                "value_numeric, value_text, as_of_date, source_url FROM call_report_fact "
                "WHERE " + " AND ".join(clauses) + " ORDER BY bank_ticker, quarter, schedule, line_item"
            )
            cur.execute(render_sql(sql), params)
        facts = fetchall_dicts(cur)

    return {
        "concept": concept,
        "concept_label": concept_label,
        "banks": banks,
        "quarters": quarters,
        "facts": facts,
        "notes": (
            tax.concepts[concept].notes if concept and concept in tax.concepts else None
        ),
    }

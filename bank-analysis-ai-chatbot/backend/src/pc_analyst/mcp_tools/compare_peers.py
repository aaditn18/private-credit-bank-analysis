"""compare_peers tool: peer benchmark on a concept across banks for a quarter."""

from __future__ import annotations

import statistics
from typing import Any

from .query_call_report import query_call_report


def compare_peers(
    concept: str,
    quarter: str,
    *,
    banks: list[str] | None = None,
) -> dict[str, Any]:
    """Return a per-bank summary + cohort median/mean for a taxonomy concept.

    If ``banks`` is omitted, the query runs over every bank that has
    call_report_fact rows for the requested quarter.
    """
    from ..db import cursor, fetchall_dicts, render_sql

    if not banks:
        with cursor() as (handle, cur):
            if handle.backend == "postgres":
                cur.execute(
                    "SELECT DISTINCT bank_ticker FROM call_report_fact WHERE quarter = %s",
                    (quarter,),
                )
            else:
                cur.execute(
                    render_sql("SELECT DISTINCT bank_ticker FROM call_report_fact WHERE quarter = ?"),
                    (quarter,),
                )
            rows = fetchall_dicts(cur)
            banks = [r["bank_ticker"] for r in rows if r["bank_ticker"]]

    result = query_call_report(banks=banks, quarters=[quarter], concept=concept)
    facts = result.get("facts", [])

    per_bank: dict[str, dict[str, Any]] = {}
    for f in facts:
        bank = f["bank_ticker"]
        per_bank.setdefault(
            bank,
            {"bank": bank, "rssd_id": f["rssd_id"], "line_items": []},
        )
        per_bank[bank]["line_items"].append(
            {
                "schedule": f["schedule"],
                "line_item": f["line_item"],
                "label": f["label"],
                "value_numeric": f["value_numeric"],
            }
        )

    # Flatten: sum numeric values per bank across the concept's line items
    rows: list[dict[str, Any]] = []
    for bank, data in per_bank.items():
        total = sum(
            (li["value_numeric"] or 0.0) for li in data["line_items"] if li["value_numeric"] is not None
        )
        rows.append({"bank": bank, "rssd_id": data["rssd_id"], "value": total, "breakdown": data["line_items"]})

    values = [r["value"] for r in rows if r["value"] is not None]
    cohort_stats = {
        "count": len(values),
        "median": statistics.median(values) if values else None,
        "mean": statistics.mean(values) if values else None,
        "p90": (sorted(values)[int(0.9 * (len(values) - 1))] if values else None),
        "max": max(values) if values else None,
        "min": min(values) if values else None,
    }

    rows.sort(key=lambda r: r["value"] or 0, reverse=True)
    for rank, r in enumerate(rows, start=1):
        r["rank"] = rank

    return {
        "concept": concept,
        "concept_label": result.get("concept_label"),
        "quarter": quarter,
        "rows": rows,
        "cohort": cohort_stats,
        "notes": result.get("notes"),
    }

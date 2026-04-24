"""Fetch Call Report data via FFIEC PWS for registry banks missing from the
bulk CSVs. Inserts/updates rows in call_report_fact using canonical RCON keys
that match the /rankings endpoint's query.

Run after load_call_reports.py. Requires FFIEC_USERNAME + FFIEC_TOKEN in .env.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from ffiec_data_connect import OAuth2Credentials, collect_data

from pc_analyst.banks import BANK_REGISTRY
from pc_analyst.config import settings
from pc_analyst.db import cursor, render_sql
from pc_analyst.ingestion.pipeline import upsert_bank

# Canonical key → [variants to try], same priority as load_call_reports.py
MNEMONICS: dict[str, tuple[str, list[str]]] = {
    "RCON1766": ("C&I loans to NBFIs",           ["RCON1766"]),
    "RCONJ457": ("Unused commitments to NBFIs",  ["RCONJ457", "RCFDJ457"]),
    "RCON1763": ("Total C&I loans and leases",   ["RCON1763", "RCFD1763"]),
    "RCON2122": ("Total loans and leases",       ["RCON2122", "RCFD2122"]),
    "RCOA8274": ("Private equity investments",   ["RCOA8274", "RCFA8274"]),
    "RCOAB704": ("Leveraged loans",              ["RCOAB704"]),
}

QUARTERS = [
    ("2024Q1", "03/31/2024", "2024-03-31"),
    ("2024Q2", "06/30/2024", "2024-06-30"),
    ("2024Q3", "09/30/2024", "2024-09-30"),
    ("2024Q4", "12/31/2024", "2024-12-31"),
    ("2025Q1", "03/31/2025", "2025-03-31"),
    ("2025Q2", "06/30/2025", "2025-06-30"),
    ("2025Q3", "09/30/2025", "2025-09-30"),
    ("2025Q4", "12/31/2025", "2025-12-31"),
]


def value_from_row(row: dict) -> float | None:
    for key in ("int_data", "float_data"):
        v = row.get(key)
        if v is None:
            continue
        try:
            # pandas NA sentinels don't compare cleanly; rely on float() catching.
            return float(v)
        except (TypeError, ValueError):
            continue
    return None


def registry_missing_rssds(existing_rssds: set[str]) -> list[tuple[str, str]]:
    """(ticker, rssd_id) pairs for registry banks whose data is absent."""
    out = []
    for ticker, meta in BANK_REGISTRY.items():
        rssd = meta.get("rssd_id")
        if rssd and rssd not in existing_rssds:
            out.append((ticker, rssd))
    return out


def current_rssds_with_data() -> set[str]:
    """RSSDs that already have non-null values for the canonical MDRM keys
    we care about. Old seed rows under labels like '4.a' don't count — the
    /rankings endpoint queries by canonical RCON/RCOA mnemonics.
    """
    canonical = tuple(MNEMONICS.keys())
    placeholders = ",".join("?" * len(canonical))
    with cursor() as (handle, cur):
        cur.execute(
            f"SELECT DISTINCT rssd_id FROM call_report_fact "
            f"WHERE value_numeric IS NOT NULL AND line_item IN ({placeholders})",
            canonical,
        )
        return {row[0] for row in cur.fetchall()}


def upsert_facts(rows: list[dict]) -> int:
    if not rows:
        return 0
    with cursor() as (handle, cur):
        sql = render_sql(
            "INSERT INTO call_report_fact "
            "(rssd_id, bank_ticker, quarter, schedule, line_item, label, value_numeric, as_of_date) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(rssd_id, quarter, schedule, line_item) DO UPDATE SET "
            "bank_ticker = excluded.bank_ticker, "
            "value_numeric = excluded.value_numeric, "
            "label = excluded.label"
        )
        cur.executemany(sql, [
            (r["rssd_id"], r["bank_ticker"], r["quarter"],
             r["schedule"], r["line_item"], r["label"],
             r["value_numeric"], r["as_of_date"])
            for r in rows
        ])
    return len(rows)


def main() -> None:
    if not (settings.ffiec_username and settings.ffiec_token):
        sys.exit("FFIEC_USERNAME / FFIEC_TOKEN not set in .env")

    creds = OAuth2Credentials(
        username=settings.ffiec_username,
        bearer_token=settings.ffiec_token,
    )

    existing = current_rssds_with_data()
    targets = registry_missing_rssds(existing)
    if not targets:
        print("No missing banks — nothing to fetch.")
        return

    print(f"Fetching {len(targets)} banks × {len(QUARTERS)} quarters from FFIEC PWS…")
    print("  Targets:", ", ".join(f"{t}({r})" for t, r in targets))

    total_rows = 0
    for ticker, rssd in targets:
        upsert_bank(ticker)
        for quarter, rp, as_of in QUARTERS:
            try:
                rows = collect_data(
                    creds,
                    reporting_period=rp,
                    rssd_id=rssd,
                    series="call",
                )
            except Exception as e:
                print(f"  {ticker} {quarter}: FAILED — {type(e).__name__}: {e}")
                continue

            by_mdrm: dict[str, float] = {}
            for row in rows:
                mdrm = row.get("mdrm")
                if not mdrm:
                    continue
                val = value_from_row(row)
                if val is not None:
                    by_mdrm[mdrm] = val

            fact_rows = []
            for canonical, (label, variants) in MNEMONICS.items():
                value = None
                for v in variants:
                    if v in by_mdrm:
                        value = by_mdrm[v]
                        break
                fact_rows.append({
                    "rssd_id": rssd,
                    "bank_ticker": ticker,
                    "quarter": quarter,
                    "schedule": "CALL",
                    "line_item": canonical,
                    "label": label,
                    "value_numeric": value,
                    "as_of_date": as_of,
                })

            upsert_facts(fact_rows)
            filled = sum(1 for r in fact_rows if r["value_numeric"] is not None)
            print(f"  {ticker} ({rssd}) {quarter}: {len(rows)} mdrms fetched, "
                  f"{filled}/{len(MNEMONICS)} target metrics populated")
            total_rows += len(fact_rows)

    print(f"\nDone. {total_rows} fact rows upserted across {len(targets)} banks.")


if __name__ == "__main__":
    main()

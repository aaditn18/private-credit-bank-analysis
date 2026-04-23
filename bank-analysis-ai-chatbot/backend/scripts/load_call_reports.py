"""Load real FFIEC Call Report bulk CSVs into call_report_fact.

Usage (from backend/):
    python scripts/load_call_reports.py [--csv-dir PATH]

Defaults to the repo-level "Call Reports/" directory.
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

# Make src importable when run from the backend/ directory.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from pc_analyst.banks import BANK_REGISTRY
from pc_analyst.db import cursor, render_sql

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CSV_DIR = REPO_ROOT / "Call Reports"

# MDRM mnemonics we care about
MNEMONICS: dict[str, str] = {
    "RCON1766": "C&I loans to NBFIs",
    "RCONJ457": "Unused commitments to NBFIs",
    "RCON1763": "Total C&I loans and leases",
    "RCON2122": "Total loans and leases",
    "RCOA8274": "Private equity investments",
    "RCOAB704": "Leveraged loans",
}


def filename_to_quarter(stem: str) -> str:
    """20240331 → 2024Q1,  20241231 → 2024Q4."""
    y, m = stem[:4], int(stem[4:6])
    q = {3: 1, 6: 2, 9: 3, 12: 4}[m]
    return f"{y}Q{q}"


def build_rssd_map() -> dict[str, str]:
    return {
        meta["rssd_id"]: ticker
        for ticker, meta in BANK_REGISTRY.items()
        if meta.get("rssd_id")
    }


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


def load_one_csv(path: Path, quarter: str, rssd_map: dict[str, str]) -> tuple[int, int]:
    """Returns (matched_rows, total_rows)."""
    rows_to_insert: list[dict] = []
    total = 0
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total += 1
            rssd = str(row.get("IDRSSD", "")).strip()
            ticker = rssd_map.get(rssd)
            for mnemonic, label in MNEMONICS.items():
                raw = row.get(mnemonic, "").strip()
                try:
                    value = float(raw) if raw not in ("", "CONF", "NA") else None
                except ValueError:
                    value = None
                rows_to_insert.append({
                    "rssd_id": rssd,
                    "bank_ticker": ticker,
                    "quarter": quarter,
                    "schedule": "CALL",
                    "line_item": mnemonic,
                    "label": label,
                    "value_numeric": value,
                    "as_of_date": f"{path.stem[:4]}-{path.stem[4:6]}-{path.stem[6:8]}",
                })

    inserted = upsert_facts(rows_to_insert)
    matched = sum(1 for r in rows_to_insert if r["bank_ticker"] is not None) // len(MNEMONICS) if rows_to_insert else 0
    return matched, total


def main() -> None:
    parser = argparse.ArgumentParser(description="Load FFIEC Call Report bulk CSVs")
    parser.add_argument("--csv-dir", type=Path, default=DEFAULT_CSV_DIR)
    args = parser.parse_args()

    csv_dir: Path = args.csv_dir
    if not csv_dir.exists():
        sys.exit(f"CSV directory not found: {csv_dir}")

    rssd_map = build_rssd_map()
    print(f"RSSD→ticker map: {len(rssd_map)} entries")

    csvs = sorted(csv_dir.glob("*.csv"))
    if not csvs:
        sys.exit(f"No CSV files found in {csv_dir}")

    total_matched = 0
    total_rows = 0
    for path in csvs:
        quarter = filename_to_quarter(path.stem)
        matched, rows = load_one_csv(path, quarter, rssd_map)
        total_matched += matched
        total_rows += rows
        print(f"  {path.name} ({quarter}): {rows} institutions, {matched} matched to registry")

    print(f"\nDone. {len(csvs)} files, {total_rows} total institutions, {total_matched} bank-quarters matched.")


if __name__ == "__main__":
    main()

"""Parse Item codes out of 8-K filings into the filing_event table.

Idempotent: UNIQUE(document_id, item_code, excerpt) prevents duplicates on
re-run.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from pc_analyst.anomalies.item_codes import item_label
from pc_analyst.db import cursor, render_sql


# Match "Item 5.02. Departure of Directors..." with up to 200 chars of label-line.
ITEM_RE = re.compile(
    r"Item\s+(\d+\.\d+)\.?\s+([^\n]{0,200})", re.IGNORECASE
)
EXCERPT_CHARS = 400


def main() -> None:
    with cursor() as (_, cur):
        cur.execute(
            "SELECT id, raw_text FROM document WHERE doc_type = '8-K'"
        )
        rows = cur.fetchall()

    if not rows:
        print("No 8-K documents found.")
        return

    print(f"Scanning {len(rows)} 8-K documents…")

    payload: list[tuple[int, str, str, str]] = []
    for row in rows:
        doc_id = row[0]
        text = row[1] or ""
        # Track unique (item_code, excerpt) per doc; the UNIQUE constraint
        # also de-dupes at the DB level.
        seen: set[tuple[str, str]] = set()
        for m in ITEM_RE.finditer(text):
            code = m.group(1)
            start = m.start()
            excerpt = text[start : start + EXCERPT_CHARS].strip()
            key = (code, excerpt)
            if key in seen:
                continue
            seen.add(key)
            payload.append((doc_id, code, item_label(code), excerpt))

    if not payload:
        print("No item codes matched.")
        return

    sql = render_sql(
        "INSERT OR IGNORE INTO filing_event "
        "(document_id, item_code, item_label, excerpt) "
        "VALUES (?, ?, ?, ?)"
    )
    # Postgres path: ON CONFLICT DO NOTHING via INSERT ... ON CONFLICT.
    # The render_sql helper only swaps placeholders; for sqlite the literal
    # "INSERT OR IGNORE" is correct. For Postgres we rebuild the SQL.
    from pc_analyst.config import settings as _settings
    if _settings.storage_backend == "postgres":
        sql = (
            "INSERT INTO filing_event "
            "(document_id, item_code, item_label, excerpt) "
            "VALUES (%s, %s, %s, %s) "
            "ON CONFLICT (document_id, item_code, excerpt) DO NOTHING"
        )

    with cursor() as (_, cur):
        cur.executemany(sql, payload)

    print(f"Inserted up to {len(payload)} filing_event rows (duplicates ignored).")


if __name__ == "__main__":
    main()

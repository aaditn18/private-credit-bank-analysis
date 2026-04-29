"""Score every chunk lacking a chunk_sentiment row using the LM lexicon.
Idempotent — safe to re-run after new ingestion.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from pc_analyst.anomalies.lm_lexicon import score_text
from pc_analyst.db import cursor, render_sql


def main() -> None:
    with cursor() as (_, cur):
        cur.execute(
            "SELECT c.id, c.text "
            "FROM chunk c "
            "LEFT JOIN chunk_sentiment cs ON cs.chunk_id = c.id "
            "WHERE cs.chunk_id IS NULL"
        )
        rows = cur.fetchall()

    if not rows:
        print("No new chunks to score.")
        return

    print(f"Scoring {len(rows)} chunks…")
    payload: list[tuple[int, int, int, int, int, int, float]] = []
    for row in rows:
        chunk_id = row[0]
        text = row[1] or ""
        s = score_text(text)
        payload.append(
            (
                chunk_id,
                s.positive_count,
                s.negative_count,
                s.uncertainty_count,
                s.litigious_count,
                s.total_words,
                s.net_sentiment,
            )
        )

    sql = render_sql(
        "INSERT INTO chunk_sentiment "
        "(chunk_id, positive_count, negative_count, uncertainty_count, "
        " litigious_count, total_words, net_sentiment) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    with cursor() as (_, cur):
        cur.executemany(sql, payload)
    print(f"Inserted {len(payload)} chunk_sentiment rows.")


if __name__ == "__main__":
    main()

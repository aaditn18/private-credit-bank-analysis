"""Topic-tag every chunk that doesn't yet have a chunk_topic row.

Idempotent: skips chunks already classified. Run after ingestion or after
adding new themes/synonyms.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from pc_analyst.anomalies.topic_classifier import classify_batch, get_theme_anchors
from pc_analyst.db import cursor, render_sql


BATCH = 64


def main() -> None:
    # Warm the anchor cache once.
    get_theme_anchors()

    with cursor() as (_, cur):
        cur.execute(
            "SELECT c.id, c.text "
            "FROM chunk c "
            "LEFT JOIN chunk_topic ct ON ct.chunk_id = c.id "
            "WHERE ct.chunk_id IS NULL "
            "ORDER BY c.id"
        )
        rows = cur.fetchall()

    if not rows:
        print("No new chunks to classify.")
        return

    print(f"Classifying {len(rows)} chunks…")
    sql = render_sql(
        "INSERT INTO chunk_topic "
        "(chunk_id, theme, confidence, keyword_score, cosine_score) "
        "VALUES (?, ?, ?, ?, ?)"
    )

    counts: dict[str, int] = {}
    total = 0
    for start in range(0, len(rows), BATCH):
        batch = rows[start : start + BATCH]
        ids = [r[0] for r in batch]
        texts = [(r[1] or "") for r in batch]
        results = classify_batch(texts)
        payload = [
            (
                int(cid),
                r.theme,
                float(r.confidence),
                float(r.keyword_score),
                float(r.cosine_score),
            )
            for cid, r in zip(ids, results)
        ]
        with cursor() as (_, cur):
            cur.executemany(sql, payload)
        for r in results:
            counts[r.theme] = counts.get(r.theme, 0) + 1
        total += len(batch)
        print(f"  {total}/{len(rows)} classified")

    print("Distribution:")
    for theme, n in sorted(counts.items(), key=lambda kv: -kv[1]):
        print(f"  {theme:18s} {n:6d}")


if __name__ == "__main__":
    main()

"""Event-driven (8-K) detector.

Routes filing_event rows whose document has a chunk tagged with *theme*.
Severity = item × theme weight × cluster size (multiple same-code events
within a year amplify).
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from ..anchors import has_theme_anchor
from ..engine import Anomaly, Citation
from ..item_codes import item_label, item_weight
from ..queries import filing_events
from ..severity import severity

# Item codes whose meaning is *intrinsically* material regardless of whether
# the excerpt mentions the theme directly (impairments, bankruptcy, non-reliance
# on prior financials). For routine codes (5.02 officer change, 8.01 other,
# 1.01 material agreement) we still require a theme anchor in the excerpt so a
# generic officer departure doesn't show up under AI/DA.
ALWAYS_MATERIAL_CODES = {"1.03", "2.06", "4.02"}

CATEGORY = "events_8k"


def _year(filed_at: str | None) -> int | None:
    if not filed_at:
        return None
    try:
        return datetime.fromisoformat(str(filed_at).replace("Z", "+00:00")).year
    except (ValueError, AttributeError):
        # Fall back to first 4 chars.
        try:
            return int(str(filed_at)[:4])
        except ValueError:
            return None


def detect(theme: str, quarter: str | None) -> list[Anomaly]:
    rows = filing_events(theme=theme)
    if not rows:
        return []

    # Cluster: how many of the same item code did this bank file in this year?
    clusters: dict[tuple[str, int, str], int] = defaultdict(int)
    for r in rows:
        y = _year(r.get("filed_at"))
        if y is None or not r.get("bank_ticker"):
            continue
        clusters[(r["bank_ticker"], y, r["item_code"])] += 1

    seen_excerpts: set[tuple[str, str, str]] = set()
    out: list[Anomaly] = []
    for r in rows:
        ticker = r.get("bank_ticker")
        if not ticker:
            continue
        y = _year(r.get("filed_at"))
        code = r["item_code"]
        excerpt = (r["excerpt"] or "").strip()
        # De-dupe on (ticker, code, first 80 chars) — same officer can be
        # mentioned across exhibits.
        key = (ticker, code, excerpt[:80])
        if key in seen_excerpts:
            continue
        seen_excerpts.add(key)

        # Filter routine codes that need a theme-anchor in the excerpt itself
        # to be considered theme-relevant. Material codes (impairment,
        # bankruptcy, restated financials) are kept regardless.
        if code not in ALWAYS_MATERIAL_CODES and not has_theme_anchor(excerpt, theme):
            continue

        cluster_size = clusters.get((ticker, y or 0, code), 1)
        weight = item_weight(theme, code)
        # Magnitude scales with weight + cluster.
        magnitude = weight * (1.0 + 0.4 * (cluster_size - 1))
        sev = severity(magnitude, category=CATEGORY, theme=theme, corroboration=cluster_size)

        out.append(
            Anomaly(
                theme=theme,
                category=CATEGORY,
                bank_ticker=ticker,
                severity=sev,
                headline=f"8-K Item {code}: {item_label(code)}",
                detail=excerpt[:340] + ("…" if len(excerpt) > 340 else ""),
                metric_value=float(cluster_size),
                z_score=magnitude,
                quarter=None,
                citations=[
                    Citation(
                        kind="event",
                        ref_id=r["id"],
                        label=f"Item {code}",
                        bank_ticker=ticker,
                        document_id=r["document_id"],
                    )
                ],
            )
        )
        if len(out) >= 60:
            break
    return out

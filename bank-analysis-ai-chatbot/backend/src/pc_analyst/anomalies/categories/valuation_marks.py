"""Valuation / marks detector.

PC: Level 3 / fair-value / mark language in PC-tagged narrative. The numeric
    Level 3 ratio isn't loaded yet, so this is currently NLP-driven.
AI: Capitalized AI development costs / impairments mentioned in AI-tagged chunks.
DA: Fair-value movements on digital-asset holdings in DA-tagged chunks.
"""

from __future__ import annotations

import re

from ..engine import Anomaly, Citation
from ..queries import topic_tagged_chunks
from ..severity import severity

CATEGORY = "valuation_marks"

PATTERNS = {
    "private_credit": re.compile(
        r"\b(level\s?3|fair value|mark|markdown|mark[\s-]down|impair|"
        r"unobservable input|valuation allowance|loss reserve)",
        re.IGNORECASE,
    ),
    "ai": re.compile(
        r"\b(capitalized|capitalised|amortization|amortisation|goodwill|"
        r"intangible|impair|written down|writedown|write-down)",
        re.IGNORECASE,
    ),
    "digital_assets": re.compile(
        r"\b(fair value|mark[\s-]?to[\s-]?market|impair|unrealized (gain|loss)|"
        r"realized (gain|loss)|writedown|write-down)",
        re.IGNORECASE,
    ),
}


def detect(theme: str, quarter: str | None) -> list[Anomaly]:
    pat = PATTERNS.get(theme)
    if not pat:
        return []
    chunks = topic_tagged_chunks(theme, min_confidence=0.05, limit=300)
    out: list[Anomaly] = []
    seen: set[tuple[str, str]] = set()
    headline = {
        "private_credit": "Level 3 / fair-value language in PC narrative",
        "ai": "AI intangible / impairment language",
        "digital_assets": "Digital-asset fair-value language",
    }[theme]
    for c in chunks:
        text = (c["text"] or "").strip()
        ticker = c["bank_ticker"]
        if not ticker or not pat.search(text):
            continue
        key = (ticker, text[:120])
        if key in seen:
            continue
        seen.add(key)
        excerpt = text[:300] + ("…" if len(text) > 300 else "")
        out.append(
            Anomaly(
                theme=theme,
                category=CATEGORY,
                bank_ticker=ticker,
                severity=severity(min(c["confidence"] * 4, 2.5), category=CATEGORY, theme=theme),
                headline=headline,
                detail=excerpt,
                citations=[
                    Citation(
                        kind="chunk",
                        ref_id=c["chunk_id"],
                        label=c.get("section_header") or c.get("doc_type"),
                        bank_ticker=ticker,
                        document_id=c.get("document_id"),
                    )
                ],
            )
        )
        if len(out) >= 25:
            break
    return out

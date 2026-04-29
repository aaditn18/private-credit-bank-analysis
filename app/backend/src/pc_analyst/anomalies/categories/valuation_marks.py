"""Valuation / marks detector.

PC: Level 3 / fair-value / mark language in PC-tagged narrative. The numeric
    Level 3 ratio isn't loaded yet, so this is currently NLP-driven.
AI: Capitalized AI development costs / impairments mentioned in AI-tagged chunks.
DA: Fair-value movements on digital-asset holdings in DA-tagged chunks.
"""

from __future__ import annotations

import re

from ..anchors import anchor_near
from ..engine import Anomaly, Citation
from ..queries import topic_tagged_chunks_grouped_by_bank
from ..severity import nlp_magnitude, severity

MIN_NLP_CONFIDENCE = 0.10

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
    headline = {
        "private_credit": "Level 3 / fair-value language in PC narrative",
        "ai": "AI intangible / impairment language",
        "digital_assets": "Digital-asset fair-value language",
    }[theme]
    grouped = topic_tagged_chunks_grouped_by_bank(theme, per_bank=40)
    out: list[Anomaly] = []
    for ticker, chunks in grouped.items():
        scored: list[tuple[dict, str]] = []
        for c in chunks:
            if c["confidence"] < MIN_NLP_CONFIDENCE:
                continue
            ok, window = anchor_near(c["text"], theme, pat, max_chars=300)
            if ok and window:
                scored.append((c, window))
        if not scored:
            continue
        c, window = max(scored, key=lambda pair: pair[0]["confidence"])
        excerpt = window[:340] + ("…" if len(window) > 340 else "")
        out.append(
            Anomaly(
                theme=theme,
                category=CATEGORY,
                bank_ticker=ticker,
                severity=severity(nlp_magnitude(c["confidence"], theme, cap=3.2), category=CATEGORY, theme=theme),
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
    return out

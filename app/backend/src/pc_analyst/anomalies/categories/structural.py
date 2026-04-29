"""Structural anomalies — covenant tone (PC), GPU-tenor mismatch (AI),
reserve composition (DA). All NLP-driven this pass.
"""

from __future__ import annotations

import re

from ..anchors import has_theme_anchor
from ..engine import Anomaly, Citation
from ..queries import topic_tagged_chunks
from ..severity import nlp_magnitude, severity

MIN_NLP_CONFIDENCE = 0.10

CATEGORY = "structural"

# AI-specific: tenor language ("five-year", "seven-year") near GPU/data-center
# refs is an early-warning that loan duration may exceed GPU useful life (~3y).
TENOR_RE = re.compile(
    r"\b(three|four|five|six|seven|eight|ten|3|4|5|6|7|8|10)[\s-]year\b",
    re.IGNORECASE,
)
GPU_NEAR_RE = re.compile(
    r"\b(GPU|graphics processing unit|chip|accelerator|data[\s-]?center|"
    r"compute|colocation|hyperscale|server farm)",
    re.IGNORECASE,
)

# DA: reserve composition.
DA_RESERVE_RE = re.compile(
    r"\b(commercial paper|treasury bill|reverse repo|money market|"
    r"backed by|reserves are held|reserve assets|cash and equivalents)",
    re.IGNORECASE,
)

# PC: cov-lite + leverage multiple structural language.
PC_STRUCT_RE = re.compile(
    r"\b(cov[\s-]?lite|covenant[\s-]?lite|covenant package|leverage multiple|"
    r"debt to EBITDA|first lien|second lien|payment in kind)",
    re.IGNORECASE,
)


def _surface(theme: str, regex_match_fn, headline: str) -> list[Anomaly]:
    chunks = topic_tagged_chunks(theme, min_confidence=MIN_NLP_CONFIDENCE, limit=400)
    out: list[Anomaly] = []
    seen: set[tuple[str, str]] = set()
    for c in chunks:
        text = (c["text"] or "").strip()
        ticker = c["bank_ticker"]
        if not ticker:
            continue
        if not has_theme_anchor(text, theme):
            continue
        if not regex_match_fn(text):
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
                severity=severity(
                    nlp_magnitude(c["confidence"], theme, cap=3.2),
                    category=CATEGORY,
                    theme=theme,
                ),
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


def detect(theme: str, quarter: str | None) -> list[Anomaly]:
    if theme == "private_credit":
        return _surface(
            "private_credit",
            lambda t: bool(PC_STRUCT_RE.search(t)),
            "Loan-structure language in PC narrative",
        )
    if theme == "ai":
        # Match only when tenor + GPU/data-center language co-occur in chunk.
        return _surface(
            "ai",
            lambda t: bool(TENOR_RE.search(t)) and bool(GPU_NEAR_RE.search(t)),
            "Loan tenor near GPU / data-center reference",
        )
    if theme == "digital_assets":
        return _surface(
            "digital_assets",
            lambda t: bool(DA_RESERVE_RE.search(t)),
            "Stablecoin / digital-asset reserve composition language",
        )
    return []

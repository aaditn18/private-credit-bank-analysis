"""Credit-quality detector.

PC: directional flag — NBFI growing while total loan growth flat/negative is a
    classic concentration-risk pattern. Surface PC-tagged chunks with credit
    distress vocabulary (non-accrual, charge-off, PIK, criticized, ACL).
AI / DA: NLP-only — surface tagged chunks with credit-quality vocabulary.
"""

from __future__ import annotations

import re

from ..engine import Anomaly, Citation
from ..queries import (
    all_banks,
    call_report_facts,
    latest_quarter_with_data,
    previous_quarter,
    topic_tagged_chunks,
    topic_tagged_chunks_grouped_by_bank,
)
from ..severity import severity

CATEGORY = "credit_quality"

# Vocabulary used to extract chunks from PC-tagged narrative for the cards.
PC_DISTRESS = re.compile(
    r"\b(non[\s-]?accrual|charge[\s-]?off|charge\s?offs|PIK|criticized|"
    r"classified|impair|deferred interest|allowance for credit loss|"
    r"watch[\s-]?list|special mention|substandard|covenant breach)",
    re.IGNORECASE,
)

# Generic credit-quality language for AI / DA narrative.
GENERIC_DISTRESS = re.compile(
    r"\b(non[\s-]?accrual|charge[\s-]?off|impair|reserve|provision|"
    r"deteriorat|watch[\s-]?list|covenant)",
    re.IGNORECASE,
)


def _ratio(num, den):
    if num is None or den is None or den == 0:
        return None
    return num / den


def _pick_nbfi(d: dict) -> tuple[float | None, str]:
    """Prefer RCON1766 (loans held); fall back to RCONJ457 (commitments)."""
    if d.get("RCON1766") is not None:
        return d["RCON1766"], "loans"
    if d.get("RCONJ457") is not None:
        return d["RCONJ457"], "commitments"
    return None, ""


def _detect_pc(quarter: str) -> list[Anomaly]:
    prev = previous_quarter(quarter)
    facts = call_report_facts([quarter, prev], ["RCON1766", "RCONJ457", "RCON2122"])
    out: list[Anomaly] = []
    banks = all_banks()
    for b in banks:
        t = b["ticker"]
        cur = facts.get((t, quarter), {})
        prv = facts.get((t, prev), {})
        cur_nbfi, src = _pick_nbfi(cur)
        prv_nbfi, _ = _pick_nbfi(prv)
        cur_tot = cur.get("RCON2122")
        prv_tot = prv.get("RCON2122")
        if not all(x and x > 0 for x in (cur_nbfi, cur_tot, prv_nbfi, prv_tot)):
            continue
        nbfi_growth = (cur_nbfi - prv_nbfi) / prv_nbfi
        tot_growth = (cur_tot - prv_tot) / prv_tot
        gap = nbfi_growth - tot_growth
        # Concentration-risk pattern: NBFI growing materially faster than book.
        if nbfi_growth > 0.03 and gap > 0.03:
            sev = severity(1.8 + min(gap, 0.3) * 5, category=CATEGORY, theme="private_credit")
            out.append(
                Anomaly(
                    theme="private_credit",
                    category=CATEGORY,
                    bank_ticker=t,
                    severity=sev,
                    headline=f"NBFI {src} {nbfi_growth*100:+.1f}% outpaces total loans {tot_growth*100:+.1f}%",
                    detail="Concentration into NBFI while overall book is flat — directional credit-quality flag.",
                    metric_value=gap,
                    z_score=None,
                    quarter=quarter,
                )
            )

    # NLP layer: PC-tagged chunks with distress vocabulary.
    chunks = topic_tagged_chunks("private_credit", min_confidence=0.05, limit=300)
    seen: set[tuple[str, str]] = set()
    for c in chunks:
        text = (c["text"] or "").strip()
        ticker = c["bank_ticker"]
        if not ticker or not PC_DISTRESS.search(text):
            continue
        key = (ticker, text[:120])
        if key in seen:
            continue
        seen.add(key)
        excerpt = text[:280] + ("…" if len(text) > 280 else "")
        out.append(
            Anomaly(
                theme="private_credit",
                category=CATEGORY,
                bank_ticker=ticker,
                severity=severity(2.0, category=CATEGORY, theme="private_credit"),
                headline="Credit-distress language in PC narrative",
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
        if len(out) >= 40:
            break
    return out


def _detect_nlp(theme: str) -> list[Anomaly]:
    """Per-bank scan: pick the best credit-quality chunk for each bank."""
    grouped = topic_tagged_chunks_grouped_by_bank(theme, per_bank=40)
    out: list[Anomaly] = []
    headline = {
        "ai": "AI-borrower credit-quality language",
        "digital_assets": "Digital-asset credit-quality language",
    }.get(theme, "Credit-quality language")
    for ticker, chunks in grouped.items():
        for c in chunks:
            text = (c["text"] or "").strip()
            if not GENERIC_DISTRESS.search(text):
                continue
            excerpt = text[:280] + ("…" if len(text) > 280 else "")
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
            break
    return out


def detect(theme: str, quarter: str | None) -> list[Anomaly]:
    q = quarter or latest_quarter_with_data()
    if theme == "private_credit" and q:
        return _detect_pc(q)
    if theme in {"ai", "digital_assets"}:
        return _detect_nlp(theme)
    return []

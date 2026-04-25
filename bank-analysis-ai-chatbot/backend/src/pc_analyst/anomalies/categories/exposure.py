"""Exposure & concentration detector.

PC: rolling-z + cohort-z on Call Report ratios (NBFI loan ratio, NBFI commitment
    ratio, total C&I ratio).
AI / DA: NLP-only — surface high-confidence chunks that mention exposure or
    concentration language.
"""

from __future__ import annotations

import re

from ..engine import Anomaly, Citation
from ..queries import (
    all_banks,
    call_report_facts,
    latest_quarter_with_data,
    previous_quarter,
    quarters_descending,
    topic_tagged_chunks_grouped_by_bank,
)
from ..severity import severity
from ..stats import cohort_zscore, median, rolling_zscore

CATEGORY = "exposure"

# PC mnemonics + which ratio each ticker computes against RCON2122 (total loans).
PC_MNEMONICS = ["RCON1766", "RCONJ457", "RCON1763", "RCON2122"]

# Exposure-mentioning regexes for AI/DA NLP surfacing.
EXPOSURE_LANG = re.compile(
    r"\b(billion|million|exposure|concentration|portfolio|book|outstanding|"
    r"committed|undrawn|approximately|\$\d)",
    re.IGNORECASE,
)


def _ratio(num, den):
    if num is None or den is None or den == 0:
        return None
    return num / den


def _nbfi_exposure(d: dict) -> tuple[float | None, str]:
    """Return (ratio, source) — prefer RCON1766/RCON2122; fall back to commitment.

    Most large banks (GSIBs, big regionals) don't break out RCON1766 (NBFI loans
    held), so the commitment line RCONJ457 is the best available proxy.
    """
    tot = d.get("RCON2122")
    nbfi = _ratio(d.get("RCON1766"), tot)
    if nbfi is not None:
        return nbfi, "loan"
    commit = _ratio(d.get("RCONJ457"), tot)
    if commit is not None:
        return commit, "commit"
    return None, ""


def _detect_pc(quarter: str) -> list[Anomaly]:
    qs = quarters_descending(8)
    if quarter not in qs:
        qs = [quarter, *qs]
    qs = sorted(set(qs), reverse=True)[:8]
    facts = call_report_facts(qs, PC_MNEMONICS)
    banks = all_banks()

    # Per-bank time series of NBFI exposure ratio (loan-or-commit fallback).
    series: dict[str, dict[str, float | None]] = {}
    source: dict[str, str] = {}
    for b in banks:
        t = b["ticker"]
        series[t] = {}
        for q in qs:
            v, s = _nbfi_exposure(facts.get((t, q), {}))
            series[t][q] = v
            if q == quarter and s:
                source[t] = s

    cohort_values = [series[t].get(quarter) for t in series]
    peer_median = median(cohort_values)

    out: list[Anomaly] = []
    for b in banks:
        t = b["ticker"]
        cur = series[t].get(quarter)
        if cur is None:
            continue
        history = [series[t].get(q) for q in qs if q != quarter]
        z_self = rolling_zscore(history, cur)
        z_peer = cohort_zscore(cur, cohort_values)
        prev = series[t].get(previous_quarter(quarter))
        delta = (cur - prev) / prev if prev and prev > 0 else None
        src_label = "loan ratio" if source.get(t) == "loan" else "commitment ratio"

        # Composite magnitude — drives baseline severity for every bank.
        signals = [
            abs(z_self) if z_self is not None else 0.0,
            abs(z_peer) if z_peer is not None else 0.0,
            abs(delta) * 4 if delta is not None else 0.0,
        ]
        composite = max(signals)
        sev = severity(composite, category=CATEGORY, theme="private_credit")

        # Headline picks the strongest contributor.
        if z_self is not None and abs(z_self) >= 2.0:
            direction = "up" if z_self > 0 else "down"
            headline = f"NBFI {src_label} {direction} {abs(z_self):.1f}σ vs own 8Q history"
            detail = f"NBFI exposure at {cur*100:.2f}%; bank's 8-quarter band shifted notably."
        elif delta is not None and abs(delta) >= 0.25:
            direction = "expansion" if delta > 0 else "contraction"
            headline = f"NBFI book {direction}: {delta*100:+.1f}% QoQ"
            detail = f"NBFI {src_label} moved from {prev*100:.2f}% to {cur*100:.2f}% in one quarter."
        elif z_peer is not None and abs(z_peer) >= 1.5:
            headline = f"NBFI ratio {abs(z_peer):.1f}σ {'above' if z_peer > 0 else 'below'} peers"
            detail = f"Bank at {cur*100:.2f}% vs peer median {peer_median*100:.2f}%."
        else:
            headline = f"NBFI {src_label}: {cur*100:.2f}%"
            if peer_median is not None:
                detail = f"Bank at {cur*100:.2f}% vs peer median {peer_median*100:.2f}%."
            else:
                detail = f"Latest NBFI {src_label} for {t}."

        history = [
            {"quarter": q, "value": series[t][q]}
            for q in sorted(qs)
            if series[t].get(q) is not None
        ]
        out.append(
            Anomaly(
                theme="private_credit",
                category=CATEGORY,
                bank_ticker=t,
                severity=sev,
                headline=headline,
                detail=detail,
                metric_value=cur,
                peer_median=peer_median,
                z_score=z_peer if z_peer is not None else z_self,
                quarter=quarter,
                history=history,
            )
        )

    return out


def _detect_nlp(theme: str) -> list[Anomaly]:
    """Per-bank scan: pick the best exposure-language chunk for each bank."""
    grouped = topic_tagged_chunks_grouped_by_bank(theme, per_bank=40)
    out: list[Anomaly] = []
    for ticker, chunks in grouped.items():
        for c in chunks:
            text = (c["text"] or "").strip()
            if not EXPOSURE_LANG.search(text):
                continue
            excerpt = text[:280] + ("…" if len(text) > 280 else "")
            sev = severity(
                min(c["confidence"] * 5, 3.0),
                category=CATEGORY,
                theme=theme,
            )
            out.append(
                Anomaly(
                    theme=theme,
                    category=CATEGORY,
                    bank_ticker=ticker,
                    severity=sev,
                    headline=_nlp_headline(theme),
                    detail=excerpt,
                    metric_value=None,
                    peer_median=None,
                    z_score=None,
                    quarter=None,
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


def _nlp_headline(theme: str) -> str:
    return {
        "ai": "AI exposure language disclosed",
        "digital_assets": "Digital-asset exposure language disclosed",
    }.get(theme, "Exposure language disclosed")


def detect(theme: str, quarter: str | None) -> list[Anomaly]:
    q = quarter or latest_quarter_with_data()
    if theme == "private_credit" and q:
        return _detect_pc(q)
    if theme in {"ai", "digital_assets"}:
        return _detect_nlp(theme)
    return []

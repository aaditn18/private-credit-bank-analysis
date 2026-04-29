"""Disclosure / NLP detector — sentiment shifts & uncertainty-density spikes.

We compare each bank's most recent fiscal year of theme-tagged narrative
against its trailing year. Surface:

  * net_sentiment YoY drop > 0.05 (LM scale; absolute change in (pos-neg)/total)
  * uncertainty_density YoY ratio > 1.5×
"""

from __future__ import annotations

from collections import defaultdict

from ..engine import Anomaly, Citation
from ..queries import chunk_sentiment_by_bank_quarter, latest_chunk_per_bank
from ..severity import severity

CATEGORY = "disclosure_nlp"


def _by_year(theme: str) -> dict[tuple[str, int], dict[str, float]]:
    """Aggregate sentiment per (ticker, fiscal_year) for *theme*.

    fiscal_year already covers the natural reporting cadence; quarter
    granularity would be too noisy for a YoY shift signal.
    """
    quarter_level = chunk_sentiment_by_bank_quarter(theme)
    year_acc: dict[tuple[str, int], list[dict[str, float]]] = defaultdict(list)
    for (ticker, fy, _fq), s in quarter_level.items():
        year_acc[(ticker, fy)].append(s)
    out: dict[tuple[str, int], dict[str, float]] = {}
    for key, items in year_acc.items():
        total_words = sum(i["total_words"] for i in items)
        if total_words == 0:
            continue
        ws = sum(i["net_sentiment"] * i["total_words"] for i in items)
        wu = sum(i["uncertainty_density"] * i["total_words"] for i in items)
        out[key] = {
            "net_sentiment": ws / total_words,
            "uncertainty_density": wu / total_words,
            "total_words": total_words,
        }
    return out


def detect(theme: str, quarter: str | None) -> list[Anomaly]:
    by_year = _by_year(theme)
    if not by_year:
        return []
    by_ticker: dict[str, dict[int, dict[str, float]]] = defaultdict(dict)
    for (ticker, fy), s in by_year.items():
        by_ticker[ticker][fy] = s

    latest_chunks = latest_chunk_per_bank(theme)
    out: list[Anomaly] = []
    for ticker, years in by_ticker.items():
        if len(years) < 2:
            continue
        sorted_years = sorted(years.keys())
        latest_y = sorted_years[-1]
        prior_y = sorted_years[-2]
        latest = years[latest_y]
        prior = years[prior_y]

        senti_delta = latest["net_sentiment"] - prior["net_sentiment"]
        unc_ratio = (latest["uncertainty_density"] / prior["uncertainty_density"]
                     if prior["uncertainty_density"] > 0 else None)

        c = latest_chunks.get(ticker)
        cites = [
            Citation(
                kind="chunk",
                ref_id=c["chunk_id"],
                label=c.get("section_header") or c.get("doc_type"),
                bank_ticker=ticker,
                document_id=c.get("document_id"),
            )
        ] if c else []

        if senti_delta < -0.05:
            magnitude = min(abs(senti_delta) / 0.05, 4.0)
            sev = severity(magnitude, category=CATEGORY, theme=theme)
            out.append(
                Anomaly(
                    theme=theme,
                    category=CATEGORY,
                    bank_ticker=ticker,
                    severity=sev,
                    headline=f"Tone darkened YoY in {theme.replace('_',' ')} disclosures",
                    detail=f"Net LM sentiment {prior['net_sentiment']:+.3f} → {latest['net_sentiment']:+.3f} "
                           f"(FY{prior_y}→FY{latest_y}).",
                    metric_value=latest["net_sentiment"],
                    z_score=senti_delta,
                    citations=cites,
                )
            )

        if unc_ratio and unc_ratio >= 1.5:
            magnitude = min(unc_ratio, 4.0)
            sev = severity(magnitude, category=CATEGORY, theme=theme)
            out.append(
                Anomaly(
                    theme=theme,
                    category=CATEGORY,
                    bank_ticker=ticker,
                    severity=sev,
                    headline=f"Hedging language up {unc_ratio:.1f}× YoY",
                    detail=f"Uncertainty word density {prior['uncertainty_density']*100:.2f}% → "
                           f"{latest['uncertainty_density']*100:.2f}% in {theme.replace('_',' ')} narrative.",
                    metric_value=latest["uncertainty_density"],
                    z_score=unc_ratio,
                    citations=cites,
                )
            )

    return out

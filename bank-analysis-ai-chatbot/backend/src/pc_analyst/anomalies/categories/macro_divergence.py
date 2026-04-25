"""Macro-divergence detector.

Reference series (HY OAS, BDC index, BTC/ETH prices, AI equity basket) aren't
yet ingested. We return a single low-severity placeholder anomaly per theme so
the page is honest about the gap rather than silently empty.
"""

from __future__ import annotations

from ..engine import Anomaly

CATEGORY = "macro_divergence"


_BLURBS: dict[str, str] = {
    "private_credit": (
        "HY OAS, BDC index, and CRE price reference series are not yet "
        "ingested. Once loaded, this category will compare each bank's PC "
        "metric to the macro reference and flag decoupling."
    ),
    "ai": (
        "AI equity basket and AI capex-vs-revenue references are not yet "
        "ingested. This category will flag banks claiming AI productivity "
        "gains while the macro signal disagrees."
    ),
    "digital_assets": (
        "BTC/ETH prices, stablecoin market cap, and on-chain volume "
        "reference series are not yet ingested. This category will flag "
        "decoupling between bank crypto exposure and the macro signal."
    ),
}


def detect(theme: str, quarter: str | None) -> list[Anomaly]:
    if theme not in _BLURBS:
        return []
    return [
        Anomaly(
            theme=theme,
            category=CATEGORY,
            bank_ticker="-",
            severity="low",
            headline="Macro reference series not yet ingested",
            detail=_BLURBS[theme],
        )
    ]

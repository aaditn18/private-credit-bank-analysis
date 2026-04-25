"""Severity scorer that blends statistical magnitude, domain weight, and
corroboration into a single low/medium/high tier.

Keep this opaque to the frontend — analysts get tiers, not raw z-scores.
"""

from __future__ import annotations

from typing import Literal

Tier = Literal["low", "medium", "high"]


# Higher = more impactful by default. Values tuned so a 2σ move in a
# weighted category clears the medium threshold.
DOMAIN_WEIGHTS: dict[tuple[str, str], float] = {
    # category, theme
    ("credit_quality",   "private_credit"): 1.5,
    ("events_8k",        "private_credit"): 1.4,
    ("exposure",         "private_credit"): 1.2,
    ("peer_deviation",   "private_credit"): 1.2,

    ("disclosure_nlp",   "ai"): 1.4,         # AI is mostly NLP-driven this pass
    ("events_8k",        "ai"): 1.2,
    ("structural",       "ai"): 1.3,         # GPU-tenor mismatch is the AI-specific bite
    ("exposure",         "ai"): 1.3,
    ("credit_quality",   "ai"): 1.3,
    ("valuation_marks",  "ai"): 1.2,
    ("peer_deviation",   "ai"): 1.2,

    ("disclosure_nlp",   "digital_assets"): 1.4,
    ("events_8k",        "digital_assets"): 1.5,
    ("exposure",         "digital_assets"): 1.3,
    ("credit_quality",   "digital_assets"): 1.3,
    ("valuation_marks",  "digital_assets"): 1.4,   # crypto fair-value swings are central
    ("peer_deviation",   "digital_assets"): 1.2,
    ("structural",       "digital_assets"): 1.3,
}


def domain_weight(category: str, theme: str) -> float:
    return DOMAIN_WEIGHTS.get((category, theme), 1.0)


# Per-theme scalar applied to chunk confidence inside NLP detectors. DA topic
# tags have a tighter confidence range (max ~0.33) than AI/PC (max ~0.56), so
# DA needs a larger multiplier to reach the high tier on its strongest chunks.
THEME_NLP_SCALE: dict[str, float] = {
    "private_credit": 10.0,
    "ai": 10.0,
    "digital_assets": 15.0,
}


def nlp_magnitude(confidence: float, theme: str, *, cap: float = 3.5) -> float:
    return min(confidence * THEME_NLP_SCALE.get(theme, 10.0), cap)


def severity(
    magnitude: float,
    *,
    category: str,
    theme: str,
    corroboration: int = 1,
) -> Tier:
    """Translate raw signal magnitude into a tier.

    *magnitude* is whatever the detector hands in — typically |z|, or for NLP
    detectors, a 0..3 score (sentiment delta × scaling).
    """
    weight = domain_weight(category, theme)
    composite = abs(magnitude) * weight * (1 + 0.5 * (max(corroboration, 1) - 1))
    if composite >= 3.0:
        return "high"
    if composite >= 2.0:
        return "medium"
    return "low"

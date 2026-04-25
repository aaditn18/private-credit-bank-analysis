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

    ("disclosure_nlp",   "ai"): 1.4,         # AI is mostly NLP-driven this pass
    ("events_8k",        "ai"): 1.2,
    ("structural",       "ai"): 1.3,         # GPU-tenor mismatch is the AI-specific bite

    ("disclosure_nlp",   "digital_assets"): 1.4,
    ("events_8k",        "digital_assets"): 1.5,
    ("exposure",         "digital_assets"): 1.3,
}


def domain_weight(category: str, theme: str) -> float:
    return DOMAIN_WEIGHTS.get((category, theme), 1.0)


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

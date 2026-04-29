"""8-K item-code reference + per-theme severity weights.

Item codes come from SEC Form 8-K General Instructions. This is the subset
that materially moves credit / governance / event signals.
"""

from __future__ import annotations

ITEM_LABELS: dict[str, str] = {
    "1.01": "Material definitive agreement entered",
    "1.02": "Material definitive agreement terminated",
    "1.03": "Bankruptcy or receivership",
    "2.01": "Acquisition or disposition of assets",
    "2.02": "Results of operations and financial condition",
    "2.03": "Material direct financial obligation",
    "2.04": "Triggering events accelerating obligations",
    "2.05": "Costs associated with exit / disposal",
    "2.06": "Material impairment",
    "3.01": "Notice of delisting / failure to satisfy listing rule",
    "3.02": "Unregistered sales of equity securities",
    "3.03": "Material modification of rights of holders",
    "4.01": "Change in registrant's certifying accountant",
    "4.02": "Non-reliance on prior financial statements",
    "5.01": "Changes in control of registrant",
    "5.02": "Officer / director departure / appointment",
    "5.03": "Amendments to articles or bylaws",
    "5.04": "Trading suspension under retirement plans",
    "5.07": "Submission of matters to a vote of security holders",
    "5.08": "Shareholder director nominations",
    "7.01": "Regulation FD disclosure",
    "8.01": "Other events (material)",
    "9.01": "Financial statements and exhibits",
}

# Per (theme, item_code) weight. Default 1.0. Higher = more severe by default.
THEME_ITEM_WEIGHTS: dict[tuple[str, str], float] = {
    # Private credit
    ("private_credit", "5.02"): 1.5,   # credit officer exits matter
    ("private_credit", "2.06"): 1.6,   # material impairment
    ("private_credit", "4.02"): 1.8,   # non-reliance ⇒ accounting risk
    ("private_credit", "1.03"): 2.0,
    ("private_credit", "2.04"): 1.6,
    # AI
    ("ai", "1.01"): 1.3,               # major AI partnership / contract
    ("ai", "5.02"): 1.2,               # AI leadership churn
    ("ai", "8.01"): 1.1,
    # Digital assets
    ("digital_assets", "8.01"): 1.5,   # custody losses, exchange events typically here
    ("digital_assets", "2.06"): 1.5,
    ("digital_assets", "4.02"): 1.6,
    ("digital_assets", "1.03"): 1.8,
}


def item_weight(theme: str, item_code: str) -> float:
    return THEME_ITEM_WEIGHTS.get((theme, item_code), 1.0)


def item_label(item_code: str) -> str:
    return ITEM_LABELS.get(item_code, f"Item {item_code}")

"""Per-theme anchor regexes that the NLP detectors require *in the chunk text*
before treating a tile as a real anomaly.

The topic classifier sometimes tags chunks with low confidence based on a single
incidental term. Without a hard anchor check the dashboard would surface
unrelated content (e.g. a Forex chunk under digital-assets exposure).
"""

from __future__ import annotations

import re

# Strong, unambiguous vocabulary per theme. A chunk must contain at least one
# of these terms to qualify as a theme anomaly.
THEME_ANCHORS: dict[str, re.Pattern[str]] = {
    "private_credit": re.compile(
        r"\b("
        r"NBFI|non[\s-]?bank financial|private credit|direct lending|"
        r"business development compan(?:y|ies)|BDC|sponsor[\s-]?finance|"
        r"leveraged loan|leveraged lending|covenant[\s-]?lite|cov[\s-]?lite|"
        r"PIK|payment[\s-]?in[\s-]?kind|middle[\s-]?market loan|"
        r"subscription (?:line|finance|facility)|fund finance|"
        r"NAV (?:loan|facility)|asset[\s-]?based finance|ABL"
        r")\b",
        re.IGNORECASE,
    ),
    "ai": re.compile(
        r"\b("
        r"artificial intelligence|machine learning|generative ai|gen[\s-]?ai|"
        r"large language model|LLM|foundation model|"
        r"AI[\s/-](?:lending|borrower|customer|capex|investment|"
        r"governance|risk|model|ethics|policy|talent|hiring|infrastructure|"
        r"vendor|partnership|tools|technology|technologies|principles|oversight|"
        r"deployment|use|usage|application|adoption|integration|capability)|"
        r"(?:AI|A\.I\.)\s+(?:and|&)\s+(?:ML|machine learning)|"
        r"\b(?:generative|hyperscale[r]?|GPU|model risk|hallucinat\w+|"
        r"data[\s-]?center loan|data[\s-]?center financ\w+|"
        r"NVIDIA|OpenAI|Anthropic|capitalized AI|AI capex)"
        r")\b",
        re.IGNORECASE,
    ),
    "digital_assets": re.compile(
        r"\b("
        r"crypto(?:currenc(?:y|ies))?|stablecoin|digital asset|"
        r"tokeniz(?:ed|ation)|blockchain|on[\s-]?chain|"
        r"distributed ledger|DLT|"
        r"cold (?:wallet|storage)|hot wallet|crypto custody|"
        r"SAB[\s-]?121|SAB[\s-]?122|safeguarding obligation|"
        r"USDC|USDT|tether|PYUSD|bitcoin|BTC|ethereum|ether(?!\w)|"
        r"GENIUS Act|FBO (?:account|deposit)|crypto[\s-]?backed loan|"
        r"qualified custodian|assets under custody"
        r")\b",
        re.IGNORECASE,
    ),
}


def has_theme_anchor(text: str | None, theme: str) -> bool:
    if not text:
        return False
    pat = THEME_ANCHORS.get(theme)
    return bool(pat and pat.search(text))


def anchor_near(
    text: str | None,
    theme: str,
    category_pat: re.Pattern[str],
    *,
    max_chars: int = 400,
) -> tuple[bool, str | None]:
    """Return (matched, excerpt) where excerpt is a window around the
    co-occurrence. The category vocab and a theme anchor must appear within
    ``max_chars`` of each other — that's how we know the chunk is *about* the
    intersection, not just incidentally containing both words.
    """
    if not text:
        return False, None
    theme_pat = THEME_ANCHORS.get(theme)
    if theme_pat is None:
        return False, None
    theme_hits = [m.start() for m in theme_pat.finditer(text)]
    if not theme_hits:
        return False, None
    cat_hits = [(m.start(), m.end()) for m in category_pat.finditer(text)]
    if not cat_hits:
        return False, None
    for cs, ce in cat_hits:
        for ts in theme_hits:
            if abs(cs - ts) <= max_chars:
                lo = max(0, min(cs, ts) - 100)
                hi = min(len(text), max(ce, ts + 40) + 200)
                return True, text[lo:hi].strip()
    return False, None

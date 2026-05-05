#!/usr/bin/env python3
"""
Generate pc_findings.json from static JSON data ONLY (no DB access).

Inputs (all in app/frontend/public/data/):
  - pc_anomalies.json   → per-bank sentiment from NLP engine on PC-tagged chunks
                           (disclosure_nlp, exposure, credit_quality, peer_deviation, etc.)
  - pc_trends.json      → QoQ direction signals (expanding/contracting)
  - pc_rankings.json    → composite scores, 6 normalized metrics per bank
  - pc_banks.json       → bank metadata (ticker, name, peer_group)

Sentiment classification:
  BASE  = aggregate sentiment from pc_anomalies.json (which already ran LM lexicon
          on private-credit-tagged text chunks — same approach as digital assets NLP).
  OVERRIDES = QoQ expansion/contraction signals from pc_trends.json quarter_movers.

No LLM calls. No DB access. All computed from pre-populated static JSONs.
"""
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "app" / "frontend" / "public" / "data"

ANOMALIES_PATH = DATA_DIR / "pc_anomalies.json"
RANKINGS_PATH  = DATA_DIR / "pc_rankings.json"
TRENDS_PATH    = DATA_DIR / "pc_trends.json"
BANKS_PATH     = DATA_DIR / "pc_banks.json"
FINDINGS_PATH  = DATA_DIR / "pc_findings.json"   # existing (will read quotes/themes, then overwrite)
OUTPUT_PATH    = DATA_DIR / "pc_findings.json"


# ── Sentiment aggregation from anomaly signals ──────────────────────────────

def aggregate_anomaly_sentiment(anomalies: dict) -> dict:
    """Per-bank sentiment from pc_anomalies.json.

    IMPORTANT: The anomaly engine labels sentiment from a RISK perspective.
    For our private-credit classification, we need to REINTERPRET:

    - exposure "negative" (e.g. "NBFI ratio above peers") →
      For PC analysis, high NBFI = active PC player. Not negative.
    - credit_quality "negative" (e.g. "NBFI growth outpaces total loans") →
      Growing PC book faster than total loans = PC engagement signal.
    - disclosure_nlp → THIS is the real NLP-on-PC-text signal.
      "Hedging language up YoY" = genuinely cautious tone.
    - valuation_marks → Fair-value / Level 3 language = cautious signal.
    - peer_deviation → Being different from peers is neutral.

    Returns {ticker: {"disclosure_nlp": str|None, "disclosure_nlp_severity": str,
                       "valuation_cautious": bool, "categories": set, "total": int,
                       "has_exposure_flag": bool, "has_cq_flag": bool}}
    """
    bank_data = defaultdict(lambda: {
        "disclosure_nlp": None,       # the key NLP-on-text signal
        "disclosure_nlp_severity": "low",
        "valuation_cautious": False,  # Level 3 language detected
        "categories": set(),
        "total": 0,
        "has_exposure_flag": False,   # high NBFI exposure flagged
        "has_cq_flag": False,         # credit quality flag
    })

    for cat, items in anomalies.get("categories", {}).items():
        for a in items:
            ticker = a.get("bank_ticker", "")
            if not ticker or ticker == "-":
                continue

            d = bank_data[ticker]
            d["total"] += 1
            d["categories"].add(cat)

            sentiment = a.get("sentiment", "inconclusive")
            severity = a.get("severity", "low")

            # disclosure_nlp: the real LM-on-PC-text signal
            if cat == "disclosure_nlp" and sentiment != "inconclusive":
                d["disclosure_nlp"] = sentiment
                d["disclosure_nlp_severity"] = severity

            # valuation_marks with negative sentiment = cautious signal
            if cat == "valuation_marks" and sentiment == "negative":
                d["valuation_cautious"] = True

            # Track exposure/credit_quality flags (informational)
            if cat == "exposure":
                d["has_exposure_flag"] = True
            if cat == "credit_quality":
                d["has_cq_flag"] = True

    return dict(bank_data)


def classify_base_sentiment(anom: dict, rating: int) -> str:
    """Derive base sentiment from disclosure_nlp signal (LM on PC text).

    The disclosure_nlp category is the ONLY anomaly that reflects actual
    text sentiment — it ran Loughran-McDonald on private-credit-tagged
    transcript chunks and detected YoY tone shifts or hedging language.

    Other anomaly categories (exposure, credit_quality, peer_deviation)
    are quantitative flags, not text sentiment.

    Rules:
    1. disclosure_nlp "negative" (tone darkened / hedging up) → "cautious"
    2. disclosure_nlp "positive" → "positive"
    3. valuation_marks cautious (Level 3 language) → "cautious"
    4. No NLP signal + rating 4-5 → "positive" (active PC banks)
    5. No NLP signal + rating 3 → "neutral"
    6. No NLP signal + rating 1-2 → "neutral"
    """
    dnlp = anom.get("disclosure_nlp")
    dnlp_sev = anom.get("disclosure_nlp_severity", "low")
    val_cautious = anom.get("valuation_cautious", False)

    # disclosure_nlp is the key signal — direct LM on PC text
    if dnlp == "negative":
        if dnlp_sev == "high":
            return "negative"   # strong tone darkening
        return "cautious"       # hedging language increasing

    if dnlp == "positive":
        return "positive"

    # No disclosure_nlp signal — use valuation_marks as secondary
    if val_cautious:
        return "cautious"

    # No NLP text signals at all — classify by involvement level
    if rating >= 4:
        return "positive"   # actively engaged in PC, no negative NLP signals
    if rating == 3:
        return "neutral"    # moderate involvement
    return "neutral"        # low involvement


def compute_mention_frequency(chunk_count: int, total_chunks: int) -> str:
    """Classify mention frequency from pc_overview chunk counts."""
    if total_chunks == 0 or chunk_count == 0:
        return "none"
    ratio = chunk_count / total_chunks
    if ratio > 0.04:
        return "high"
    if ratio > 0.02:
        return "medium"
    if chunk_count > 0:
        return "low"
    return "none"


def main():
    # ── 1. Load static JSONs ──
    with open(BANKS_PATH) as f:
        banks_list = json.load(f)
    banks = {b["ticker"]: b["name"] for b in banks_list}
    print(f"Loaded {len(banks)} banks from pc_banks.json")

    with open(ANOMALIES_PATH) as f:
        anomalies_raw = json.load(f)
    anomaly_data = aggregate_anomaly_sentiment(anomalies_raw)
    print(f"Loaded anomalies for {len(anomaly_data)} banks")

    with open(TRENDS_PATH) as f:
        trends = json.load(f)

    # QoQ direction from quarter_movers
    qoq_data = {}
    for mover in trends.get("quarter_movers", []):
        t = mover.get("ticker", "")
        if t:
            qoq_data[t] = {
                "change": mover.get("change", 0),
                "direction": mover.get("direction", "stable"),
            }
    # Fill from pullbacks if not already present
    for pb in trends.get("pullbacks", []):
        t = pb.get("ticker", "")
        if t and t not in qoq_data:
            qoq_data[t] = {
                "change": pb.get("change", 0),
                "direction": "contracting" if pb.get("change", 0) < 0 else "expanding",
            }
    print(f"Loaded QoQ direction for {len(qoq_data)} banks")

    with open(RANKINGS_PATH) as f:
        rankings = json.load(f)
    # Build rating from rankings (NBFI ratio percentile + norm scores)
    bank_norms = {}
    for b in rankings.get("banks", []):
        bank_norms[b["ticker"]] = b.get("norm", {})

    # Compute ratings from NBFI loan ratio percentile
    nbfi_ratios = []
    for b in rankings.get("banks", []):
        raw = b.get("raw", {})
        nbfi_ratios.append((b["ticker"], raw.get("nbfi_loan_ratio", 0) or 0))
    nbfi_ratios.sort(key=lambda x: x[1])
    sorted_vals = [v for _, v in nbfi_ratios]

    def nbfi_to_rating(ratio: float) -> int:
        if not sorted_vals:
            return 3
        pct = sum(1 for r in sorted_vals if r <= ratio) / len(sorted_vals)
        if pct >= 0.85: return 5
        if pct >= 0.65: return 4
        if pct >= 0.35: return 3
        if pct >= 0.15: return 2
        return 1

    bank_ratings = {}
    for b in rankings.get("banks", []):
        raw = b.get("raw", {})
        nbfi = raw.get("nbfi_loan_ratio", 0) or 0
        bank_ratings[b["ticker"]] = nbfi_to_rating(nbfi)

    # Load existing findings for quotes/themes (preserve what we can)
    existing_findings = {}
    if FINDINGS_PATH.exists():
        with open(FINDINGS_PATH) as f:
            existing_findings = json.load(f)

    # Exposure ranking for mention frequency
    exposure_ranking = {
        e["ticker"]: e.get("rank", 50)
        for e in trends.get("exposure_ranking", [])
    }

    # ── 2. Classify sentiment per bank ──
    findings = {}
    for ticker, name in sorted(banks.items()):
        rating = bank_ratings.get(ticker, 3)
        anom = anomaly_data.get(ticker, {
            "positive": 0, "negative": 0, "inconclusive": 0,
            "high_neg": 0, "high_pos": 0, "total": 0,
            "categories": set(), "disclosure_nlp_sentiment": None,
        })

        # Sentiment purely from NLP text signals (no QoQ overrides)
        sentiment = classify_base_sentiment(anom, rating)
        qoq = qoq_data.get(ticker, {"change": 0, "direction": "stable"})

        # Mention frequency from exposure rank
        rank = exposure_ranking.get(ticker, 50)
        if rank <= 10:
            mention_freq = "high"
        elif rank <= 25:
            mention_freq = "medium"
        else:
            mention_freq = "low"

        # Preserve existing fields from current findings
        existing = existing_findings.get(ticker, {})

        # Key themes
        key_themes = existing.get("key_themes", [])

        # Strategic initiatives
        top_themes_str = ", ".join(key_themes[:5]) if key_themes else "general commercial lending"
        if rating >= 4:
            strategic = f"{name} shows significant private credit involvement, with key activities spanning {top_themes_str}. The bank's NBFI exposure ratio places it in the upper tier of peers, indicating active participation in non-bank financial institution lending."
        elif rating >= 3:
            strategic = f"{name} maintains moderate private credit exposure across {top_themes_str}. The bank's lending profile suggests selective participation in NBFI-related activities relative to its peer group."
        elif rating >= 2:
            strategic = f"{name} has limited direct private credit exposure, with some activity in {top_themes_str}. The bank's NBFI lending ratio is below the peer median."
        else:
            strategic = f"{name} has minimal private credit involvement. Disclosure language and Call Report data suggest the bank focuses primarily on traditional lending rather than NBFI-oriented activities."

        # Perceived risks from anomaly categories
        risk_themes = []
        cats = anom.get("categories", set())
        if "credit_quality" in cats:
            risk_themes.append("credit quality deterioration in NBFI-related exposures")
        if "exposure" in cats:
            risk_themes.append("concentration risk in non-bank lending")
        if "peer_deviation" in cats:
            risk_themes.append("significant deviation from peer group norms")
        if "disclosure_nlp" in cats:
            risk_themes.append("shifting disclosure tone around private credit activities")
        if "valuation_marks" in cats:
            risk_themes.append("valuation uncertainty in private credit holdings")
        if not risk_themes:
            risk_themes = ["general credit risk inherent in commercial lending activities"]
        perceived_risks = f"Key risk signals identified for {name}: {'; '.join(risk_themes)}. " + (
            f"The anomaly engine flagged {anom['total']} signals across {len(cats)} categories."
            if anom["total"] > 0 else
            "No significant anomaly signals were detected by the NLP engine."
        )

        # Risk focus analysis
        raw = {}
        for b in rankings.get("banks", []):
            if b["ticker"] == ticker:
                raw = b.get("raw", {})
                break
        nbfi_ratio = raw.get("nbfi_loan_ratio", 0) or 0
        if nbfi_ratio > 0.1:
            risk_focus = f"{name}'s NBFI loan ratio of {nbfi_ratio*100:.1f}% is substantially above the industry average, indicating heavy concentration in non-bank lending. "
        elif nbfi_ratio > 0.02:
            risk_focus = f"{name}'s NBFI loan ratio of {nbfi_ratio*100:.1f}% reflects moderate private credit market participation. "
        else:
            risk_focus = f"{name}'s NBFI loan ratio of {nbfi_ratio*100:.2f}% indicates minimal direct NBFI lending exposure. "
        dnlp_str = anom.get("disclosure_nlp") or "none"
        risk_focus += (
            f"Sentiment '{sentiment}' derived from NLP disclosure signal ('{dnlp_str}') "
            f"across {anom['total']} anomaly flags. "
            f"QoQ direction: {qoq['direction']} ({qoq['change']*100:+.1f}%)."
        )

        findings[ticker] = {
            "bank_ticker": ticker,
            "bank_name": name,
            "rating": rating,
            "mention_frequency": mention_freq,
            "sentiment": sentiment,
            "key_themes": key_themes,
            "strategic_initiatives": strategic,
            "perceived_risks": perceived_risks,
            "notable_quotes": existing.get("notable_quotes", []),
            "pullback_mentions": existing.get("pullback_mentions", ""),
            "named_competitors": existing.get("named_competitors", ""),
            "risk_focus_analysis": risk_focus,
            "involvement_rating": rating,
        }

    # Write output
    with open(OUTPUT_PATH, "w") as f:
        json.dump(findings, f, indent=2)

    # Summary stats
    sentiments = Counter(f["sentiment"] for f in findings.values())
    ratings = Counter(f["rating"] for f in findings.values())
    freqs = Counter(f["mention_frequency"] for f in findings.values())
    print(f"\nWrote {len(findings)} banks to {OUTPUT_PATH}")
    print(f"Sentiments: {dict(sentiments)}")
    print(f"Ratings:    {dict(sorted(ratings.items()))}")
    print(f"Frequency:  {dict(freqs)}")

    # Per-rating breakdown
    by_rating = defaultdict(Counter)
    for f in findings.values():
        by_rating[f["rating"]][f["sentiment"]] += 1
    print("\nSentiment by rating:")
    for r in sorted(by_rating.keys(), reverse=True):
        print(f"  Rating {r}: {dict(by_rating[r])}")


if __name__ == "__main__":
    main()

"""Generate pc_trajectory.json for the four PC Trends diagrams.

Pure-Python derivation from existing static JSONs — the SQLite DB is no
longer populated at runtime. The diagrams need four labels per bank:
trajectory bucket, 1-5 rating, $B exposure, and strategy multi-label.
Each is derived deterministically from existing fields:

  - trajectory: bucketed from QoQ relative change in NBFI ratio
                (Expanding / Stable / Contracting / Pulling Back)
  - rating:     quintile (1-5) of the same 6-metric composite the
                Rankings page uses
  - exposure:   $B from RCON1766 + RCONJ457 / RCON2122 × total loans
  - strategies: regex multi-label classification over each bank's
                key_themes + strategic_initiatives + notable_quotes
                against a fixed 8-category taxonomy

Note on naming: an earlier version called the bucket "sentiment" and used
the LLM's narrative read of disclosure prose. That diverges sharply from
what banks' books are actually doing (e.g., Stifel's narrative was
"cautious" while their NBFI ratio fell 65% relative in 2025Q4), so the
chart now labels behavior, not language. The LLM narrative read is still
preserved per-bank as `narrative_sentiment` for cross-reference.

Reads:
    app/frontend/public/data/pc_findings.json
    app/frontend/public/data/pc_rankings.json
    app/frontend/public/data/pc_trends.json
    app/frontend/public/data/pc_banks.json

Writes:
    app/frontend/public/data/pc_trajectory.json

Usage:
    python scripts/generate_pc_trajectory_data.py
"""

from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DATA_DIR = REPO_ROOT / "app" / "frontend" / "public" / "data"

# 8-category PC strategy taxonomy, ordered from most-specific to most-generic
# so the regex sweep assigns the most informative bucket first when a phrase
# matches multiple. The order also drives chart sort.
STRATEGY_TAXONOMY: list[str] = [
    "Direct Lending",
    "Sponsor Coverage",
    "Partnership / JV",
    "BDC Investment",
    "Warehouse / Fund Finance",
    "CLO / Leveraged Finance",
    "Distribution / Syndication",
    "Pulling Back",
]

# Strategy classification rules. Each rule has:
#   pattern   — case-insensitive regex run against (key_themes ∪ strategic_initiatives ∪ notable_quote topics ∪ notable_quote text)
#   strategy  — taxonomy bucket
# Match is multi-label: a bank can land in several strategies. Patterns are
# written so they're high-precision against the kind of language that shows
# up in MD&A and earnings transcripts. Adjust by inspecting the unmapped
# `key_themes` printed in the QA summary at the end.
STRATEGY_RULES: list[tuple[str, str]] = [
    # Pulling Back — checked first since it overrides positive language
    (r"\b(pulling back|reduc(?:e|ing|ed) (?:exposure|exposures|appetite)|wind[\s-]?down|exit(?:ing|ed)? (?:from )?(?:private credit|leveraged|nbfi|non[- ]bank))\b", "Pulling Back"),
    (r"\bdeemphasi[sz](?:e|ed|ing)\b", "Pulling Back"),

    # Warehouse / Fund Finance — wholesale facilities to PC funds, BDCs, mortgage originators
    (r"\bsubscription lines?\b", "Warehouse / Fund Finance"),
    (r"\b(nav facilit(?:y|ies)|fund finance|warehouse (?:line|lending|loan|facility|financing)|mortgage warehouse)\b", "Warehouse / Fund Finance"),
    (r"\b(lending to non[\s-]?depository|non[\s-]?depository financial institution|nbfi lending|loans to nbf)\b", "Warehouse / Fund Finance"),
    (r"\bcapital call (?:financing|facilit(?:y|ies)|line|loan)\b", "Warehouse / Fund Finance"),
    (r"\b(asset managers? and finance companies|loans? to (?:asset managers|finance companies)|finance compan(?:y|ies) exposure)\b", "Warehouse / Fund Finance"),

    # Asset-based / asset-backed lending — senior secured book that overlaps the PC universe
    (r"(?:\basset[\s-]?ba(?:ck|s)ed (?:lending|finance|loan)|\babl\b|\babf\b)", "Direct Lending"),

    # BDC Investment — bank invests in / partners with BDCs
    (r"(?:business development company|\bbdcs?\b|bdc lending|bdc financ)", "BDC Investment"),

    # Sponsor Coverage — relationship orientation to PE sponsors
    (r"\b(sponsor coverage|sponsor[\s-]?backed|private equity sponsor|pe[\s-]?sponsor|relationship[s]? with sponsors|sponsor finance)\b", "Sponsor Coverage"),
    (r"\bprivate equity fund (?:exposure|relationships?|lending|loans?|investments?|financing)\b", "Sponsor Coverage"),

    # Direct Lending — origination to mid-market borrowers
    (r"\b(direct lending|middle[\s-]?market (?:lending|loan|companies|focus|borrowers?)|specialty finance|unitranche|senior[\s-]?secured loans?)\b", "Direct Lending"),

    # CLO / Leveraged Finance — structured credit + leveraged loans
    (r"(?:\bclos?\b|collateralized loan obligation|securiti[sz]ation|leveraged (?:loan|lending|finance|credit)|structured (?:lending|credit|finance))", "CLO / Leveraged Finance"),

    # Distribution / Syndication — capital markets role
    (r"\bsyndicat(?:e|ed|ion|ions|ing)\b", "Distribution / Syndication"),
    (r"\b(distribution (?:strategy|business)|capital markets distribution|underwrit(?:e|ing) syndicated)\b", "Distribution / Syndication"),

    # Partnership / JV
    (r"\b(joint venture|strategic partnership|partnership with [a-z]|alliance with|co[\s-]?lending|joint origination)\b", "Partnership / JV"),
]

# Trajectory bucket colors. We use behavior verbs (Expanding/Stable/
# Contracting/Pulling Back) instead of sentiment vocabulary because what
# we're actually measuring is the bank's NBFI book direction, not the tone
# of management's language. The LLM's narrative-sentiment read is preserved
# per-bank as `narrative_sentiment` for cross-reference but does not appear
# in the chart legend.
TRAJECTORY_COLORS = {
    "Expanding":     "#10b981",   # emerald — book grew meaningfully
    "Stable":        "#3b82f6",   # blue    — book ~flat
    "Contracting":   "#f59e0b",   # amber   — single-digit pullback
    "Pulling Back":  "#dc2626",   # red     — double-digit pullback
}
TRAJECTORY_ORDER = ["Expanding", "Stable", "Contracting", "Pulling Back"]


# Buckets derived from QoQ relative change in NBFI ratio. Thresholds are
# *relative* (change / prev_ratio) to avoid penalising large books that move
# a few percentage points and missing small books that double. Calibrated
# to the empirical distribution of the 50-bank dataset where QoQ moves
# cluster between -10% and +10% with one extreme outlier (Stifel -65% in
# 2025Q4). A 10% relative pullback is already a meaningful retreat — don't
# reserve "Pulling Back" for the SF outlier alone.
TRAJECTORY_PULLING_BACK_REL = -0.10   # ≥10% relative decline → Pulling Back
TRAJECTORY_CONTRACTING_REL  = -0.03   # 3–10% relative decline → Contracting
TRAJECTORY_EXPANDING_REL    =  0.03   # ≥3% relative growth   → Expanding


def _quant_trajectory(prev_ratio: float | None, latest_ratio: float | None) -> tuple[str, float | None]:
    """Bucket a bank into {Pulling Back, Contracting, Stable, Expanding} based on
    QoQ relative change in NBFI ratio. Returns (label, relative_change)."""
    if prev_ratio is None or latest_ratio is None or prev_ratio <= 0:
        return "Stable", None
    rel = (latest_ratio - prev_ratio) / max(prev_ratio, 1e-6)
    if rel <= TRAJECTORY_PULLING_BACK_REL:
        return "Pulling Back", rel
    if rel <= TRAJECTORY_CONTRACTING_REL:
        return "Contracting", rel
    if rel >= TRAJECTORY_EXPANDING_REL:
        return "Expanding", rel
    return "Stable", rel


def _classify_strategies(finding: dict[str, Any]) -> tuple[list[str], list[str]]:
    """Return (matched_strategies, unmapped_themes) for one bank.

    Sweeps the regex rules in order over a corpus built from key_themes,
    strategic_initiatives, perceived_risks, and notable_quote topics+text.
    Multi-label: a bank can hit multiple strategies. Returns deduped list
    in taxonomy order plus any key_theme strings that didn't match any
    rule (useful for tuning the rules).
    """
    parts: list[str] = []
    parts.extend(finding.get("key_themes") or [])
    if finding.get("strategic_initiatives"):
        parts.append(str(finding["strategic_initiatives"]))
    if finding.get("perceived_risks"):
        parts.append(str(finding["perceived_risks"]))
    for q in finding.get("notable_quotes") or []:
        if isinstance(q, dict):
            if q.get("topic"):
                parts.append(str(q["topic"]))
            if q.get("quote"):
                parts.append(str(q["quote"]))
    corpus = " \n ".join(parts).lower()

    hit: set[str] = set()
    for pattern, strategy in STRATEGY_RULES:
        if re.search(pattern, corpus, re.IGNORECASE):
            hit.add(strategy)

    matched = [s for s in STRATEGY_TAXONOMY if s in hit]

    # Unmapped themes — only key_themes are reported here, since strategic_initiatives
    # is free-form prose that's expected to contain non-strategy descriptive text.
    unmapped: list[str] = []
    for theme in finding.get("key_themes") or []:
        t = str(theme).lower()
        if not any(re.search(pat, t, re.IGNORECASE) for pat, _ in STRATEGY_RULES):
            unmapped.append(theme)

    return matched, unmapped


def _exposure_billions(rankings_bank: dict[str, Any]) -> tuple[float, dict[str, float], str]:
    """Compute total NBFI exposure ($B) for one bank from pc_rankings.json fields.

    Method: total_loans = exp(loan_scale) × 1000  (loan_scale is ln(thousands USD))
            funded$     = total_loans × raw.nbfi_loan_ratio       (RCON1766 / RCON2122)
            commit$     = total_loans × raw.nbfi_commitment_ratio (RCONJ457 / RCON2122)

    For banks where RCON1766 is confidential and `sources.nbfi_loan_ratio == 'commitment_proxy'`,
    nbfi_loan_ratio == nbfi_commitment_ratio (the same RCONJ457-based proxy). In that
    case we report only the commitment-based estimate to avoid double-counting.

    Returns (total_billions, breakdown, source_label).
    """
    raw = rankings_bank.get("raw") or {}
    sources = rankings_bank.get("sources") or {}

    loan_scale = raw.get("loan_scale")
    nbfi_funded_ratio = raw.get("nbfi_loan_ratio")
    nbfi_commit_ratio = raw.get("nbfi_commitment_ratio")

    if loan_scale is None or (nbfi_funded_ratio is None and nbfi_commit_ratio is None):
        return 0.0, {"funded": 0.0, "commitments": 0.0}, "unavailable"

    total_loans_usd = math.exp(float(loan_scale)) * 1000.0  # loan_scale = ln(thousands)

    is_proxy = sources.get("nbfi_loan_ratio") == "commitment_proxy"

    if is_proxy:
        # Funded balance is confidential — report only commitments.
        commit_usd = total_loans_usd * float(nbfi_commit_ratio or 0)
        total_usd = commit_usd
        breakdown = {"funded": 0.0, "commitments": commit_usd / 1e9}
        source_label = "commitment_proxy"
    else:
        funded_usd = total_loans_usd * float(nbfi_funded_ratio or 0)
        commit_usd = total_loans_usd * float(nbfi_commit_ratio or 0)
        total_usd = funded_usd + commit_usd
        breakdown = {"funded": funded_usd / 1e9, "commitments": commit_usd / 1e9}
        source_label = "funded_plus_commitments"

    return total_usd / 1e9, breakdown, source_label


def _first_quote(finding: dict[str, Any]) -> str:
    """First notable_quote text, or empty string."""
    quotes = finding.get("notable_quotes") or []
    if quotes and isinstance(quotes[0], dict):
        return str(quotes[0].get("quote", "")).strip()
    return ""


# Composite-score weights — must match the values in
# app/frontend/components/panels/trends/PCPositioningQuadrant.tsx (and
# RankingsPanel / ComparePanel) so the rating users see here is the same
# 0–1 score they see ranked elsewhere.
COMPOSITE_WEIGHTS = {
    "nbfi_loan_ratio":       35,
    "nbfi_commitment_ratio": 25,
    "nbfi_growth":           15,
    "ci_ratio":              10,
    "pe_exposure":           10,
    "loan_scale":             5,
}


def _composite_score(rankings_bank: dict[str, Any], metrics: list[dict[str, Any]]) -> float:
    """Same weighted-norm formula as PCPositioningQuadrant.compositeScore."""
    norm = rankings_bank.get("norm") or {}
    s = 0.0
    total_w = 0.0
    for m in metrics:
        w = COMPOSITE_WEIGHTS.get(m["key"])
        if not w:
            continue
        v = norm.get(m["key"])
        if v is None:
            continue
        try:
            v = float(v)
        except (TypeError, ValueError):
            continue
        adjusted = v if m.get("higher_is_better", True) else 1.0 - v
        s += (w / 100.0) * adjusted
        total_w += w / 100.0
    return s / total_w if total_w > 0 else 0.0


def _quintile_rating(score: float, all_scores: list[float]) -> int:
    """Map a composite score to 1..5 by quintile rank within the dataset."""
    if not all_scores:
        return 0
    sorted_scores = sorted(all_scores)
    # Position from bottom (0..n-1)
    n = len(sorted_scores)
    # Count how many scores are strictly less than this one — 0..n
    rank_below = sum(1 for s in sorted_scores if s < score)
    # Map to 1..5: bottom 20% = 1, top 20% = 5
    pct = rank_below / max(n - 1, 1)
    if pct < 0.20:
        return 1
    if pct < 0.40:
        return 2
    if pct < 0.60:
        return 3
    if pct < 0.80:
        return 4
    return 5


def build_dataset(data_dir: Path) -> dict[str, Any]:
    findings: dict[str, Any] = json.loads((data_dir / "pc_findings.json").read_text())
    rankings: dict[str, Any] = json.loads((data_dir / "pc_rankings.json").read_text())
    trends: dict[str, Any] = json.loads((data_dir / "pc_trends.json").read_text())
    banks_meta: list[dict[str, Any]] = json.loads((data_dir / "pc_banks.json").read_text())

    rankings_by_ticker = {b["ticker"]: b for b in rankings.get("banks", [])}
    bank_meta_by_ticker = {b["ticker"]: b for b in banks_meta}
    movers_by_ticker = {m["ticker"]: m for m in trends.get("quarter_movers", [])}
    metrics = rankings.get("metrics", [])

    # Pre-compute composite scores for every bank so the rating quintile is
    # derived against the full distribution.
    composite_by_ticker: dict[str, float] = {
        t: _composite_score(rb, metrics) for t, rb in rankings_by_ticker.items()
    }
    all_scores = list(composite_by_ticker.values())

    out_banks: list[dict[str, Any]] = []
    unmapped_corpus: dict[str, int] = {}

    for ticker, finding in findings.items():
        rb = rankings_by_ticker.get(ticker)
        meta = bank_meta_by_ticker.get(ticker)
        if rb is None or meta is None:
            # Bank present in findings but missing from rankings/banks — skip
            # rather than fabricate fields. Keeps the dataset honest.
            continue

        # Quant-grounded trajectory from QoQ change in NBFI ratio.
        mover = movers_by_ticker.get(ticker, {})
        trajectory, rel_change = _quant_trajectory(
            mover.get("prev_ratio"), mover.get("latest_ratio")
        )

        # Rating from quintile of the same 0..1 composite the rest of the
        # page uses. NBFI growth is one of the six metrics, so a sharp
        # pullback like SF in 2025Q4 drags the score down — and therefore
        # the rating — without any ad-hoc penalty here.
        composite = composite_by_ticker.get(ticker, 0.0)
        rating = _quintile_rating(composite, all_scores)

        strategies, unmapped = _classify_strategies(finding)
        for u in unmapped:
            unmapped_corpus[u] = unmapped_corpus.get(u, 0) + 1

        exposure_b, breakdown, source_label = _exposure_billions(rb)

        # Build a short rationale explaining the trajectory bucket so the chart
        # tooltips can show *why* a bank landed where it did. The LLM's
        # narrative sentiment is kept alongside as a secondary signal.
        narrative_sentiment = (finding.get("sentiment") or "").strip().lower() or None
        if rel_change is None:
            rationale = "No prior-quarter NBFI ratio available."
        else:
            pp = (mover.get("latest_ratio", 0) - mover.get("prev_ratio", 0)) * 100
            rationale = (
                f"NBFI ratio {pp:+.1f} pp QoQ ({rel_change*100:+.1f}% relative)"
                f" — {trajectory.lower()} bucket."
            )
            if narrative_sentiment:
                rationale += f" LLM narrative sentiment: {narrative_sentiment}."

        out_banks.append({
            "ticker": ticker,
            "name": meta.get("name") or finding.get("bank_name") or ticker,
            "peer_group": meta.get("peer_group", ""),
            "trajectory": trajectory,
            "trajectory_rel_change": round(rel_change, 4) if rel_change is not None else None,
            "narrative_sentiment": narrative_sentiment,
            "rating": rating,
            "composite_score": round(composite, 4),
            "trajectory_rationale": rationale,
            "strategic_initiatives": (finding.get("strategic_initiatives") or "")[:600],
            "exposure_billions": round(exposure_b, 3),
            "exposure_breakdown": {
                "funded": round(breakdown["funded"], 3),
                "commitments": round(breakdown["commitments"], 3),
            },
            "exposure_source": source_label,
            "strategies": strategies,
        })

    # Trajectory counts (used to render the donut without recomputing in JS)
    trajectory_counts = {label: 0 for label in TRAJECTORY_ORDER}
    for b in out_banks:
        trajectory_counts[b["trajectory"]] += 1

    # Strategy → list of {ticker, rating, trajectory} for the right-panel scatter
    strategy_pairs: dict[str, list[dict[str, Any]]] = {s: [] for s in STRATEGY_TAXONOMY}
    for b in out_banks:
        for s in b["strategies"]:
            strategy_pairs[s].append({
                "ticker": b["ticker"],
                "rating": b["rating"],
                "trajectory": b["trajectory"],
            })

    return {
        "as_of": rankings.get("quarter", ""),
        "method": {
            "trajectory": (
                "Quant-grounded label from QoQ relative change in the bank's NBFI loan ratio "
                "(pc_trends.json quarter_movers). Thresholds: ≤−10% → Pulling Back, −10% to −3% → "
                "Contracting, −3% to +3% → Stable, ≥+3% → Expanding. NOT a sentiment label — "
                "it measures book direction, not management's tone of language. The LLM's "
                "narrative sentiment from pc_findings.json is preserved per-bank as "
                "`narrative_sentiment` for cross-reference but does not drive the bucket."
            ),
            "rating": (
                "Quintile (1–5) of the 6-metric PC composite — same weighted-norm score used by "
                "the Rankings page, ComparePanel, and PCPositioningQuadrant. Weights: NBFI ratio "
                "35, NBFI commitment 25, NBFI growth 15, C&I ratio 10, PE exposure 10, loan "
                "scale 5. Because growth is in the composite, banks pulling back materially get "
                "demoted automatically."
            ),
            "exposure": (
                "NBFI exposure proxy from FFIEC Call Reports: total_loans × (RCON1766 + RCONJ457) / RCON2122. "
                "For banks where RCON1766 is confidential, RCONJ457 alone is reported (exposure_source="
                "'commitment_proxy'). 'Private credit' is not a Call Report line — this is the same "
                "proxy the Rankings page uses."
            ),
            "strategies": (
                "Multi-label deterministic regex classification over each bank's key_themes + "
                "strategic_initiatives + perceived_risks + notable_quotes from pc_findings.json, "
                "mapped to a fixed 8-category taxonomy. A bank can appear in multiple strategies. "
                "Unmapped themes are listed in the diagnostics block."
            ),
        },
        "taxonomy": STRATEGY_TAXONOMY,
        "trajectory_colors": TRAJECTORY_COLORS,
        "trajectory_counts": trajectory_counts,
        "total_banks": len(out_banks),
        "banks": out_banks,
        "strategy_pairs": strategy_pairs,
        "diagnostics": {
            "unmapped_themes": dict(sorted(unmapped_corpus.items(), key=lambda x: -x[1])),
        },
    }


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR), help="dir containing pc_*.json")
    p.add_argument("--out", default=None, help="output path (default: <data-dir>/pc_trajectory.json)")
    args = p.parse_args()

    data_dir = Path(args.data_dir)
    out_path = Path(args.out) if args.out else data_dir / "pc_trajectory.json"

    dataset = build_dataset(data_dir)
    out_path.write_text(json.dumps(dataset, indent=2) + "\n")

    # QA summary to stdout — quick sanity check after each run.
    print(f"wrote {out_path}")
    print(f"  banks: {dataset['total_banks']}")
    print(f"  trajectory counts: {dataset['trajectory_counts']}")
    print(f"  rating distribution:")
    rating_dist: dict[int, int] = {}
    for b in dataset["banks"]:
        rating_dist[b["rating"]] = rating_dist.get(b["rating"], 0) + 1
    for r in sorted(rating_dist):
        print(f"    rating {r}: {rating_dist[r]}")
    print(f"  banks per strategy:")
    for s in STRATEGY_TAXONOMY:
        n = len(dataset["strategy_pairs"][s])
        print(f"    {s:<32s} {n}")
    if dataset["diagnostics"]["unmapped_themes"]:
        print(f"  top unmapped themes (consider adding a rule):")
        for theme, count in list(dataset["diagnostics"]["unmapped_themes"].items())[:10]:
            print(f"    {count:3d}  {theme}")


if __name__ == "__main__":
    main()

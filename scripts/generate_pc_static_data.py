"""Generate static JSON files for private-credit panels from FFIEC Call Report CSVs.

Outputs (relative to repo root):
  app/frontend/public/data/pc_banks.json      — same shape as GET /banks
  app/frontend/public/data/pc_rankings.json   — same shape as GET /rankings
  app/frontend/public/data/pc_trends.json     — same shape as GET /trends
  app/frontend/public/data/pc_anomalies.json  — same shape as GET /anomalies/private-credit
  app/frontend/public/data/pc_timelines.json  — same shape as GET /timeline/{ticker}, keyed by ticker

IMPORTANT — use the sec_env Python (has yfinance 1.3.0, pandas):
  /Users/rahul24/opt/anaconda3/envs/sec_env/bin/python3 scripts/generate_pc_static_data.py
"""

from __future__ import annotations

import csv
import json
import math
import statistics
import time
from datetime import date, timedelta
from pathlib import Path

# ── bank registry (copied from app/backend/src/pc_analyst/banks.py) ───────────

BANK_REGISTRY: dict[str, dict] = {
    "JPM":   {"name": "JPMorgan Chase & Co.",             "rssd_id": "852218",  "peer_group": "GSIB"},
    "BAC":   {"name": "Bank of America Corporation",      "rssd_id": "480228",  "peer_group": "GSIB"},
    "C":     {"name": "Citigroup Inc.",                   "rssd_id": "476810",  "peer_group": "GSIB"},
    "WFC":   {"name": "Wells Fargo & Company",            "rssd_id": "451965",  "peer_group": "GSIB"},
    "GS":    {"name": "The Goldman Sachs Group",          "rssd_id": "2182786", "peer_group": "trust-ib"},
    "MS":    {"name": "Morgan Stanley",                   "rssd_id": "1456501", "peer_group": "trust-ib"},
    "BK":    {"name": "The Bank of New York Mellon",      "rssd_id": "541101",  "peer_group": "trust-ib"},
    "STT":   {"name": "State Street Corporation",         "rssd_id": "35301",   "peer_group": "trust-ib"},
    "NTRS":  {"name": "Northern Trust Corporation",       "rssd_id": "210434",  "peer_group": "trust-ib"},
    "RJF":   {"name": "Raymond James Financial",          "rssd_id": "2193616", "peer_group": "trust-ib"},
    "SCHW":  {"name": "The Charles Schwab Corporation",   "rssd_id": "3150447", "peer_group": "trust-ib"},
    "USB":   {"name": "U.S. Bancorp",                     "rssd_id": "504713",  "peer_group": "regional"},
    "PNC":   {"name": "The PNC Financial Services Group", "rssd_id": "817824",  "peer_group": "regional"},
    "TFC":   {"name": "Truist Financial",                 "rssd_id": "852320",  "peer_group": "regional"},
    "COF":   {"name": "Capital One Financial",            "rssd_id": "112837",  "peer_group": "regional"},
    "AXP":   {"name": "American Express Company",         "rssd_id": "1394676", "peer_group": "regional"},
    "MTB":   {"name": "M&T Bank Corporation",             "rssd_id": "501105",  "peer_group": "regional"},
    "RF":    {"name": "Regions Financial Corporation",    "rssd_id": "233031",  "peer_group": "regional"},
    "CFG":   {"name": "Citizens Financial Group",         "rssd_id": "3303298", "peer_group": "regional"},
    "HBAN":  {"name": "Huntington Bancshares",            "rssd_id": "12311",   "peer_group": "regional"},
    "FITB":  {"name": "Fifth Third Bancorp",              "rssd_id": "723112",  "peer_group": "regional"},
    "KEY":   {"name": "KeyCorp",                          "rssd_id": "280110",  "peer_group": "regional"},
    "ALLY":  {"name": "Ally Financial Inc.",              "rssd_id": "3284070", "peer_group": "regional"},
    "SYF":   {"name": "Synchrony Financial",              "rssd_id": "1216022", "peer_group": "regional"},
    "DFS":   {"name": "Discover Financial Services",      "rssd_id": "30810",   "peer_group": "regional"},
    "SOFI":  {"name": "SoFi Technologies",                "rssd_id": "962966",  "peer_group": "regional"},
    "FHN":   {"name": "First Horizon Corporation",        "rssd_id": "485559",  "peer_group": "regional"},
    "FLG":   {"name": "Flagstar Financial",               "rssd_id": "694904",  "peer_group": "regional"},
    "CMA":   {"name": "Comerica Incorporated",            "rssd_id": "60143",   "peer_group": "regional"},
    "ZION":  {"name": "Zions Bancorporation",             "rssd_id": "276579",  "peer_group": "regional"},
    "SNV":   {"name": "Synovus Financial Corp.",          "rssd_id": "395238",  "peer_group": "regional"},
    "CFR":   {"name": "Cullen/Frost Bankers",             "rssd_id": "682563",  "peer_group": "regional"},
    "WAL":   {"name": "Western Alliance Bancorporation",  "rssd_id": "3138146", "peer_group": "regional"},
    "EWBC":  {"name": "East West Bancorp",                "rssd_id": "197478",  "peer_group": "regional"},
    "WTFC":  {"name": "Wintrust Financial Corporation",   "rssd_id": "2239288", "peer_group": "regional"},
    "PNFP":  {"name": "Pinnacle Financial Partners",      "rssd_id": "2925666", "peer_group": "regional"},
    "UMBF":  {"name": "UMB Financial Corporation",        "rssd_id": "936855",  "peer_group": "regional"},
    "BOKF":  {"name": "BOK Financial Corporation",        "rssd_id": "339858",  "peer_group": "regional"},
    "WBS":   {"name": "Webster Financial Corporation",    "rssd_id": "761806",  "peer_group": "regional"},
    "FCNCA": {"name": "First Citizens BancShares",        "rssd_id": "491224",  "peer_group": "regional"},
    "VLY":   {"name": "Valley National Bancorp",          "rssd_id": "229801",  "peer_group": "regional"},
    "COLB":  {"name": "Columbia Banking System",          "rssd_id": "143662",  "peer_group": "regional"},
    "ASB":   {"name": "Associated Banc-Corp",             "rssd_id": "917742",  "peer_group": "regional"},
    "FNB":   {"name": "F.N.B. Corporation",               "rssd_id": "379920",  "peer_group": "regional"},
    "ONB":   {"name": "Old National Bancorp",             "rssd_id": "208244",  "peer_group": "regional"},
    "BPOP":  {"name": "Popular, Inc.",                    "rssd_id": "940311",  "peer_group": "regional"},
    "BKU":   {"name": "BankUnited, Inc.",                 "rssd_id": "3938186", "peer_group": "regional"},
    "PB":    {"name": "Prosperity Bancshares",            "rssd_id": "664756",  "peer_group": "regional"},
    "SSB":   {"name": "SouthState Corporation",           "rssd_id": "1929247", "peer_group": "regional"},
    "SF":    {"name": "Stifel Financial Corp.",           "rssd_id": "3076220", "peer_group": "regional"},
}

RSSD_TO_TICKER = {v["rssd_id"]: k for k, v in BANK_REGISTRY.items()}

MNEMONICS = {"RCON1763", "RCON2122", "RCON1766", "RCONJ457", "RCOA8274"}

QUARTER_MAP = {
    "20240331": "2024Q1",
    "20240630": "2024Q2",
    "20240930": "2024Q3",
    "20241231": "2024Q4",
    "20250331": "2025Q1",
    "20250630": "2025Q2",
    "20250930": "2025Q3",
    "20251231": "2025Q4",
}

# Quarter-end dates used to derive approximate filing dates
QUARTER_END_DATES: dict[str, date] = {
    "2024Q1": date(2024, 3, 31),
    "2024Q2": date(2024, 6, 30),
    "2024Q3": date(2024, 9, 30),
    "2024Q4": date(2024, 12, 31),
    "2025Q1": date(2025, 3, 31),
    "2025Q2": date(2025, 6, 30),
    "2025Q3": date(2025, 9, 30),
    "2025Q4": date(2025, 12, 31),
}

METRICS = [
    {
        "key": "ci_ratio",
        "label": "C&I Concentration",
        "description": "C&I loans as % of total loans.",
        "higher_is_better": True,
    },
    {
        "key": "loan_scale",
        "label": "Loan Book Scale",
        "description": "Log-normalized total loan balance.",
        "higher_is_better": True,
    },
    {
        "key": "nbfi_loan_ratio",
        "label": "NBFI Loan Ratio",
        "description": "C&I loans to non-bank financial institutions as % of total loans (RCON1766). Falls back to RCONJ457 when confidential.",
        "higher_is_better": True,
    },
    {
        "key": "nbfi_commitment_ratio",
        "label": "NBFI Commitment Pipeline",
        "description": "Unused loan commitments to NBFIs as % of total loans (RCONJ457).",
        "higher_is_better": True,
    },
    {
        "key": "pe_exposure",
        "label": "Private Equity Exposure",
        "description": "PE/equity investment holdings as % of total loans (RCOA8274).",
        "higher_is_better": True,
    },
    {
        "key": "nbfi_growth",
        "label": "NBFI Loan Growth (QoQ)",
        "description": "Quarter-over-quarter change in the NBFI loan ratio.",
        "higher_is_better": True,
    },
]


# ── CSV loading ────────────────────────────────────────────────────────────────

def _num(val: str) -> float | None:
    s = val.strip()
    if not s or s.upper() in ("CONF", "NA", ""):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def load_all_quarters(csv_dir: Path) -> dict[str, dict[str, dict[str, float | None]]]:
    """Return {quarter: {ticker: {mnemonic: value}}}."""
    data: dict[str, dict[str, dict[str, float | None]]] = {}
    for fname, quarter in QUARTER_MAP.items():
        path = csv_dir / f"{fname}.csv"
        if not path.exists():
            print(f"  warning: {path} not found, skipping")
            continue
        with open(path, newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        quarter_data: dict[str, dict[str, float | None]] = {}
        for row in rows:
            rssd = str(row.get("IDRSSD", "")).strip()
            ticker = RSSD_TO_TICKER.get(rssd)
            if not ticker:
                continue
            quarter_data[ticker] = {m: _num(row.get(m, "")) for m in MNEMONICS}
        data[quarter] = quarter_data
        print(f"  loaded {quarter}: {len(quarter_data)} banks matched")
    return data


# ── shared helpers ─────────────────────────────────────────────────────────────

def ratio(num: float | None, den: float | None) -> float | None:
    if num is None or den is None or den == 0:
        return None
    return num / den


def _metrics_for_quarter(d: dict[str, float | None]) -> dict[str, float | None]:
    """Compute the 5 per-quarter metric values from a raw mnemonic dict."""
    total = d.get("RCON2122")
    nbfi_loan = ratio(d.get("RCON1766"), total)
    nbfi_commit = ratio(d.get("RCONJ457"), total)
    nbfi_exposure = nbfi_loan if nbfi_loan is not None else nbfi_commit
    return {
        "ci_ratio": ratio(d.get("RCON1763"), total),
        "loan_scale": math.log(total) if total and total > 0 else None,
        "nbfi_loan_ratio": nbfi_exposure,
        "nbfi_commitment_ratio": nbfi_commit,
        "pe_exposure": ratio(d.get("RCOA8274"), total),
    }


# ── pc_banks.json ──────────────────────────────────────────────────────────────

def build_banks() -> list[dict]:
    """[{ticker, name, peer_group}] — same shape as GET /banks."""
    return [
        {"ticker": t, "name": v["name"], "peer_group": v["peer_group"]}
        for t, v in sorted(BANK_REGISTRY.items())
    ]


# ── pc_rankings.json ───────────────────────────────────────────────────────────

def build_rankings(
    all_data: dict[str, dict[str, dict[str, float | None]]],
    quarter: str = "2025Q4",
) -> dict:
    y, q = int(quarter[:4]), int(quarter[5])
    prev_q = q - 1 if q > 1 else 4
    prev_y = y if q > 1 else y - 1
    prev_quarter = f"{prev_y}Q{prev_q}"

    cur_data = all_data.get(quarter, {})
    prev_data = all_data.get(prev_quarter, {})

    bank_raw: dict[str, dict] = {}
    bank_sources: dict[str, dict] = {}

    for ticker, d in cur_data.items():
        total = d.get("RCON2122")
        prev_d = prev_data.get(ticker, {})
        prev_total = prev_d.get("RCON2122")

        nbfi_cur = ratio(d.get("RCON1766"), total)
        nbfi_src = "loan"
        if nbfi_cur is None:
            nbfi_cur = ratio(d.get("RCONJ457"), total)
            nbfi_src = "commitment_proxy" if nbfi_cur is not None else "missing"

        nbfi_prev_loan = ratio(prev_d.get("RCON1766"), prev_total)
        nbfi_prev_commit = ratio(prev_d.get("RCONJ457"), prev_total)

        if nbfi_src == "loan" and nbfi_prev_loan is not None and nbfi_prev_loan > 0:
            growth = (nbfi_cur - nbfi_prev_loan) / nbfi_prev_loan
            growth_src = "loan"
        elif nbfi_src == "commitment_proxy" and nbfi_prev_commit is not None and nbfi_prev_commit > 0:
            growth = (nbfi_cur - nbfi_prev_commit) / nbfi_prev_commit
            growth_src = "commitment_proxy"
        else:
            growth = None
            growth_src = "missing"

        bank_raw[ticker] = {
            "ci_ratio": ratio(d.get("RCON1763"), total),
            "loan_scale": math.log(total) if total and total > 0 else None,
            "nbfi_loan_ratio": nbfi_cur,
            "nbfi_commitment_ratio": ratio(d.get("RCONJ457"), total),
            "pe_exposure": ratio(d.get("RCOA8274"), total),
            "nbfi_growth": growth,
        }
        bank_sources[ticker] = {"nbfi_loan_ratio": nbfi_src, "nbfi_growth": growth_src}

    for ticker in BANK_REGISTRY:
        if ticker not in bank_raw:
            bank_raw[ticker] = {k: None for k in ["ci_ratio", "loan_scale", "nbfi_loan_ratio",
                                                    "nbfi_commitment_ratio", "pe_exposure", "nbfi_growth"]}
            bank_sources[ticker] = {}

    metric_keys = [m["key"] for m in METRICS]

    def minmax(vals):
        v = [x for x in vals if x is not None]
        if not v or min(v) == max(v):
            return 0.0, 1.0
        return min(v), max(v)

    mins_maxs = {k: minmax([bank_raw[t].get(k) for t in bank_raw]) for k in metric_keys}

    def normalize(key, val):
        if val is None:
            return 0.0
        lo, hi = mins_maxs[key]
        return 0.5 if hi == lo else (val - lo) / (hi - lo)

    banks_out = []
    for ticker, meta in BANK_REGISTRY.items():
        raw = bank_raw.get(ticker, {})
        norm = {k: normalize(k, raw.get(k)) for k in metric_keys}
        banks_out.append({
            "ticker": ticker,
            "name": meta["name"],
            "peer_group": meta["peer_group"],
            "raw": raw,
            "norm": norm,
            "sources": bank_sources.get(ticker, {}),
        })

    return {"quarter": quarter, "prev_quarter": prev_quarter, "metrics": METRICS, "banks": banks_out}


# ── pc_trends.json ─────────────────────────────────────────────────────────────

def build_trends(all_data: dict[str, dict[str, dict[str, float | None]]]) -> dict:
    all_quarters = sorted(all_data.keys())
    banks_meta = {t: {"ticker": t, "name": v["name"], "peer_group": v["peer_group"]}
                  for t, v in BANK_REGISTRY.items()}

    metrics_over_time: dict[str, dict[str, dict]] = {}
    for quarter in all_quarters:
        for ticker, d in all_data[quarter].items():
            metrics_over_time.setdefault(ticker, {})[quarter] = _metrics_for_quarter(d)

    industry_trend = []
    for q in all_quarters:
        nbfi_vals, ci_vals = [], []
        for ticker in metrics_over_time:
            m = metrics_over_time[ticker].get(q, {})
            if m.get("nbfi_loan_ratio") is not None:
                nbfi_vals.append(m["nbfi_loan_ratio"])
            if m.get("ci_ratio") is not None:
                ci_vals.append(m["ci_ratio"])
        industry_trend.append({
            "quarter": q,
            "avg_nbfi_ratio": sum(nbfi_vals) / len(nbfi_vals) if nbfi_vals else None,
            "avg_ci_ratio": sum(ci_vals) / len(ci_vals) if ci_vals else None,
            "reporting_banks": len(nbfi_vals),
        })

    pullbacks = []
    for ticker, quarters in metrics_over_time.items():
        sorted_qs = sorted(quarters.keys())
        if len(sorted_qs) >= 2:
            latest, prev = quarters[sorted_qs[-1]], quarters[sorted_qs[-2]]
            if latest.get("nbfi_loan_ratio") is not None and prev.get("nbfi_loan_ratio") is not None:
                change = latest["nbfi_loan_ratio"] - prev["nbfi_loan_ratio"]
                if change < 0:
                    pullbacks.append({
                        **banks_meta.get(ticker, {"ticker": ticker, "name": ticker, "peer_group": ""}),
                        "prev_quarter": sorted_qs[-2], "latest_quarter": sorted_qs[-1],
                        "prev_ratio": prev["nbfi_loan_ratio"], "latest_ratio": latest["nbfi_loan_ratio"],
                        "change": change,
                    })
    pullbacks.sort(key=lambda x: x["change"])

    exposure_ranking = []
    for ticker, quarters in metrics_over_time.items():
        sorted_qs = sorted(quarters.keys())
        if not sorted_qs:
            continue
        m = quarters[sorted_qs[-1]]
        if m.get("nbfi_loan_ratio") is not None:
            exposure_ranking.append({
                **banks_meta.get(ticker, {"ticker": ticker, "name": ticker, "peer_group": ""}),
                "latest_quarter": sorted_qs[-1],
                "nbfi_ratio": m["nbfi_loan_ratio"],
                "ci_ratio": m.get("ci_ratio"),
                "commitment_ratio": m.get("nbfi_commitment_ratio"),
                "pe_exposure": m.get("pe_exposure"),
            })
    exposure_ranking.sort(key=lambda x: x["nbfi_ratio"], reverse=True)
    for i, item in enumerate(exposure_ranking, 1):
        item["rank"] = i

    quarter_movers = []
    for ticker, quarters in metrics_over_time.items():
        sorted_qs = sorted(quarters.keys())
        if len(sorted_qs) >= 2:
            lq, pq = sorted_qs[-1], sorted_qs[-2]
            lm, pm = quarters[lq], quarters[pq]
            if lm.get("nbfi_loan_ratio") is not None and pm.get("nbfi_loan_ratio") is not None:
                change = lm["nbfi_loan_ratio"] - pm["nbfi_loan_ratio"]
                quarter_movers.append({
                    **banks_meta.get(ticker, {"ticker": ticker, "name": ticker, "peer_group": ""}),
                    "prev_quarter": pq, "latest_quarter": lq,
                    "prev_ratio": pm["nbfi_loan_ratio"], "latest_ratio": lm["nbfi_loan_ratio"],
                    "change": change,
                    "direction": "expanding" if change >= 0 else "contracting",
                })
    quarter_movers.sort(key=lambda x: abs(x["change"]), reverse=True)

    peer_group_comparison: dict[str, dict] = {}
    for q in all_quarters:
        group_nbfi: dict[str, list] = {}
        group_ci: dict[str, list] = {}
        for ticker in metrics_over_time:
            pg = BANK_REGISTRY.get(ticker, {}).get("peer_group", "Unknown")
            m = metrics_over_time[ticker].get(q, {})
            if m.get("nbfi_loan_ratio") is not None:
                group_nbfi.setdefault(pg, []).append(m["nbfi_loan_ratio"])
            if m.get("ci_ratio") is not None:
                group_ci.setdefault(pg, []).append(m["ci_ratio"])
        for pg in set(list(group_nbfi) + list(group_ci)):
            peer_group_comparison.setdefault(pg, {})[q] = {
                "avg_nbfi_ratio": sum(group_nbfi[pg]) / len(group_nbfi[pg]) if pg in group_nbfi and group_nbfi[pg] else None,
                "avg_ci_ratio": sum(group_ci[pg]) / len(group_ci[pg]) if pg in group_ci and group_ci[pg] else None,
                "bank_count": len(group_nbfi.get(pg, [])),
            }

    return {
        "banks": list(banks_meta.values()),
        "metrics_over_time": metrics_over_time,
        "industry_trend": industry_trend,
        "pullbacks": pullbacks,
        "exposure_ranking": exposure_ranking,
        "quarter_movers": quarter_movers,
        "peer_group_comparison": peer_group_comparison,
    }


# ── pc_anomalies.json ──────────────────────────────────────────────────────────

def _median(vals: list) -> float | None:
    v = [x for x in vals if x is not None]
    if not v:
        return None
    return statistics.median(v)


def _zscore(val: float, all_vals: list) -> float | None:
    vals = [x for x in all_vals if x is not None]
    if len(vals) < 2:
        return None
    try:
        mu = statistics.mean(vals)
        sd = statistics.stdev(vals)
        return None if sd == 0 else (val - mu) / sd
    except Exception:
        return None


def _rolling_zscore(history: list, cur: float) -> float | None:
    h = [x for x in history if x is not None]
    if len(h) < 2:
        return None
    try:
        mu = statistics.mean(h)
        sd = statistics.stdev(h)
        return None if sd == 0 else (cur - mu) / sd
    except Exception:
        return None


def _severity(composite: float) -> str:
    if composite >= 2.5:
        return "high"
    if composite >= 1.5:
        return "medium"
    return "low"


def _anomaly(category, ticker, severity, headline, detail, *, metric_value=None,
              peer_median=None, z_score=None, quarter=None, history=None, sentiment="inconclusive"):
    return {
        "theme": "private_credit", "category": category, "bank_ticker": ticker,
        "severity": severity, "headline": headline, "detail": detail,
        "metric_value": metric_value, "peer_median": peer_median, "z_score": z_score,
        "quarter": quarter, "citations": [], "sentiment": sentiment,
        "full_detail": None, "history": history or [],
    }


def _prev_q(q: str) -> str:
    y, qn = int(q[:4]), int(q[5])
    pq = qn - 1 if qn > 1 else 4
    py = y if qn > 1 else y - 1
    return f"{py}Q{pq}"


def build_anomalies(all_data: dict[str, dict[str, dict[str, float | None]]], quarter: str) -> dict:
    latest_8 = sorted(all_data.keys(), reverse=True)[:8]

    series: dict[str, dict[str, float | None]] = {}
    source: dict[str, str] = {}
    for ticker in BANK_REGISTRY:
        series[ticker] = {}
        for q in latest_8:
            d = all_data.get(q, {}).get(ticker, {})
            total = d.get("RCON2122")
            nbfi = ratio(d.get("RCON1766"), total)
            src = "loan"
            if nbfi is None:
                nbfi = ratio(d.get("RCONJ457"), total)
                src = "commit" if nbfi is not None else ""
            series[ticker][q] = nbfi
            if q == quarter and src:
                source[ticker] = src

    cohort_values = [series[t].get(quarter) for t in series]
    peer_median_val = _median(cohort_values)
    peer_med_by_q = {q: _median([series[t].get(q) for t in series if series[t].get(q) is not None])
                     for q in latest_8}

    exposure_anomalies = []
    for ticker in BANK_REGISTRY:
        cur = series[ticker].get(quarter)
        if cur is None:
            continue
        history_vals = [series[ticker].get(q) for q in latest_8 if q != quarter]
        z_self = _rolling_zscore(history_vals, cur)
        z_peer = _zscore(cur, cohort_values)
        prev = series[ticker].get(_prev_q(quarter))
        delta = (cur - prev) / prev if prev and prev > 0 else None
        src_label = "loan ratio" if source.get(ticker) == "loan" else "commitment ratio"
        composite = max(abs(z_self) if z_self else 0, abs(z_peer) if z_peer else 0,
                        abs(delta) * 4 if delta else 0)
        sev = _severity(composite)

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
            detail = f"Bank at {cur*100:.2f}% vs peer median {(peer_median_val or 0)*100:.2f}%."
        else:
            headline = f"NBFI {src_label}: {cur*100:.2f}%"
            detail = f"Bank at {cur*100:.2f}% vs peer median {(peer_median_val or 0)*100:.2f}%."

        history = [{"quarter": q, "value": series[ticker][q], "peer_value": peer_med_by_q.get(q)}
                   for q in sorted(latest_8) if series[ticker].get(q) is not None]
        sent = "inconclusive"
        if z_peer is not None:
            sent = "negative" if z_peer > 0 else "positive"
        elif z_self is not None:
            sent = "negative" if z_self > 0 else "positive"
        exposure_anomalies.append(_anomaly(
            "exposure", ticker, sev, headline, detail,
            metric_value=cur, peer_median=peer_median_val,
            z_score=z_peer if z_peer is not None else z_self,
            quarter=quarter, history=history, sentiment=sent,
        ))

    peer_deviation_anomalies = []
    for ticker in BANK_REGISTRY:
        d = all_data.get(quarter, {}).get(ticker, {})
        total = d.get("RCON2122")
        ci = ratio(d.get("RCON1763"), total)
        if ci is None:
            continue
        pg = BANK_REGISTRY[ticker]["peer_group"]
        pg_vals = []
        for t2 in BANK_REGISTRY:
            if BANK_REGISTRY[t2]["peer_group"] == pg:
                d2 = all_data.get(quarter, {}).get(t2, {})
                v = ratio(d2.get("RCON1763"), d2.get("RCON2122"))
                if v is not None:
                    pg_vals.append(v)
        pg_med = _median(pg_vals)
        z = _zscore(ci, pg_vals)
        if z is None or abs(z) < 1.0:
            continue
        sev = _severity(abs(z))
        direction = "above" if z > 0 else "below"
        sent = "negative" if z > 0 else "positive"
        peer_deviation_anomalies.append(_anomaly(
            "peer_deviation", ticker, sev,
            f"C&I ratio {abs(z):.1f}σ {direction} {pg} peers",
            f"C&I ratio {ci*100:.2f}% vs peer median {(pg_med or 0)*100:.2f}% ({pg}).",
            metric_value=ci, peer_median=pg_med, z_score=z, quarter=quarter, sentiment=sent,
        ))

    macro_divergence_anomalies = []
    industry_latest = peer_med_by_q.get(quarter)
    industry_prev = peer_med_by_q.get(_prev_q(quarter))
    industry_delta = (industry_latest - industry_prev) / industry_prev \
        if industry_latest is not None and industry_prev and industry_prev > 0 else None

    for ticker in BANK_REGISTRY:
        cur = series[ticker].get(quarter)
        if cur is None or industry_delta is None:
            continue
        prev = series[ticker].get(_prev_q(quarter))
        if prev is None or prev == 0:
            continue
        bank_delta = (cur - prev) / prev
        divergence = bank_delta - industry_delta
        if abs(divergence) < 0.10:
            continue
        sev = _severity(abs(divergence) * 5)
        direction = "faster" if divergence > 0 else "slower"
        sent = "negative" if divergence > 0 else "positive"
        macro_divergence_anomalies.append(_anomaly(
            "macro_divergence", ticker, sev,
            f"NBFI growth {direction} than industry ({divergence*100:+.1f}% divergence)",
            f"Bank NBFI ratio changed {bank_delta*100:+.1f}% QoQ vs industry average {industry_delta*100:+.1f}%.",
            metric_value=cur, peer_median=industry_latest,
            z_score=divergence, quarter=quarter, sentiment=sent,
        ))

    def sev_rank(a):
        return {"high": 3, "medium": 2, "low": 1}.get(a["severity"], 0)

    for lst in (exposure_anomalies, peer_deviation_anomalies, macro_divergence_anomalies):
        lst.sort(key=lambda a: (sev_rank(a), abs(a["z_score"] or 0)), reverse=True)

    categories = {
        "exposure": exposure_anomalies, "credit_quality": [],
        "peer_deviation": peer_deviation_anomalies, "disclosure_nlp": [],
        "events_8k": [], "valuation_marks": [],
        "structural": [], "macro_divergence": macro_divergence_anomalies,
    }
    counts = {c: len(v) for c, v in categories.items()}
    return {
        "theme": "private_credit", "theme_slug": "private-credit",
        "quarter": quarter, "peer_group": None,
        "categories": categories, "counts": counts, "total": sum(counts.values()),
    }


# ── pc_timelines.json ──────────────────────────────────────────────────────────

def _filing_date_for_quarter(quarter: str) -> str:
    """Approximate SEC filing date: 10-Q ~45 days after quarter-end, 10-K (Q4) ~65 days."""
    end = QUARTER_END_DATES.get(quarter)
    if end is None:
        return ""
    qn = int(quarter[5])
    offset = 65 if qn == 4 else 45
    filed = end + timedelta(days=offset)
    return filed.strftime("%Y-%m-%d")


def _derive_filings(quarters: list[str]) -> list[dict]:
    """Synthetic filing records derived from the quarters we have Call Report data for."""
    filings = []
    for q in sorted(quarters):
        y, qn = int(q[:4]), int(q[5])
        doc_type = "10-K" if qn == 4 else "10-Q"
        filed_at = _filing_date_for_quarter(q)
        if filed_at:
            filings.append({
                "doc_type": doc_type,
                "fiscal_year": y,
                "fiscal_quarter": qn,
                "filed_at": filed_at,
                "title": None,
            })
    return filings


def _fetch_stock_prices(ticker: str) -> list[dict]:
    """Fetch 2yr daily stock price history via yfinance. Returns [] on any failure."""
    try:
        import yfinance as yf
        hist = yf.Ticker(ticker).history(period="2y")
        if hist.empty:
            return []
        prices = []
        for idx, row in hist.iterrows():
            prices.append({
                "date": idx.strftime("%Y-%m-%d"),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]) if row["Volume"] else None,
            })
        return prices
    except Exception as e:
        print(f"    yfinance failed for {ticker}: {e}")
        return []


def build_timelines(
    all_data: dict[str, dict[str, dict[str, float | None]]],
    trends_data: dict,
) -> dict:
    """
    Returns {ticker: {ticker, name, peer_group, metrics_by_quarter, stock_prices, filings}}.
    metrics_by_quarter comes from pre-computed trends data (no extra CSV work).
    stock_prices fetched live from yfinance.
    filings are approximated from the quarters present in metrics_by_quarter.
    """
    metrics_over_time: dict[str, dict] = trends_data["metrics_over_time"]
    timelines: dict[str, dict] = {}

    tickers = list(BANK_REGISTRY.keys())
    total = len(tickers)

    for i, ticker in enumerate(tickers, 1):
        meta = BANK_REGISTRY[ticker]
        print(f"  [{i}/{total}] {ticker} — fetching stock prices...", end=" ", flush=True)

        mbq = metrics_over_time.get(ticker, {})
        filings = _derive_filings(list(mbq.keys()))
        stock_prices = _fetch_stock_prices(ticker)

        print(f"{len(stock_prices)} price points")

        timelines[ticker] = {
            "ticker": ticker,
            "name": meta["name"],
            "peer_group": meta["peer_group"],
            "filings": filings,
            "metrics_by_quarter": mbq,
            "stock_prices": stock_prices,
            "news": [],
        }

        # Polite pause to avoid hammering Yahoo Finance
        if i < total:
            time.sleep(0.3)

    return timelines


# ── main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    repo_root = Path(__file__).parent.parent
    csv_dir = repo_root / "Call_Reports" / "CSV"
    out_dir = repo_root / "app" / "frontend" / "public" / "data"
    out_dir.mkdir(parents=True, exist_ok=True)

    print("Loading Call Reports CSVs...")
    all_data = load_all_quarters(csv_dir)
    if not all_data:
        print("No CSV data found — check Call_Reports/CSV/")
        return
    latest_quarter = sorted(all_data.keys())[-1]
    print(f"Latest quarter: {latest_quarter}\n")

    print("Building pc_banks.json...")
    banks = build_banks()
    (out_dir / "pc_banks.json").write_text(json.dumps(banks, indent=2))
    print(f"  wrote pc_banks.json ({len(banks)} banks)\n")

    print("Building pc_rankings.json...")
    rankings = build_rankings(all_data, quarter=latest_quarter)
    (out_dir / "pc_rankings.json").write_text(json.dumps(rankings, indent=2))
    print(f"  wrote pc_rankings.json ({len(rankings['banks'])} banks)\n")

    print("Building pc_trends.json...")
    trends = build_trends(all_data)
    (out_dir / "pc_trends.json").write_text(json.dumps(trends, indent=2))
    print(f"  wrote pc_trends.json\n")

    print("Building pc_anomalies.json...")
    anomalies = build_anomalies(all_data, quarter=latest_quarter)
    (out_dir / "pc_anomalies.json").write_text(json.dumps(anomalies, indent=2))
    print(f"  wrote pc_anomalies.json ({anomalies['total']} anomalies)\n")

    print("Building pc_timelines.json (fetches stock prices from Yahoo Finance)...")
    timelines = build_timelines(all_data, trends)
    (out_dir / "pc_timelines.json").write_text(json.dumps(timelines, indent=2))
    banks_with_prices = sum(1 for t in timelines.values() if t["stock_prices"])
    print(f"  wrote pc_timelines.json ({len(timelines)} banks, {banks_with_prices} with stock prices)\n")

    print("Done.")


if __name__ == "__main__":
    main()

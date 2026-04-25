"""Peer-deviation detector — banks in top/bottom 5% of their peer group.

PC: percentile of NBFI loan ratio (RCON1766/RCON2122) within peer_group.
AI / DA: percentile of theme-tagged chunk count per bank within peer_group
   (proxy for "mention frequency / disclosure intensity").
"""

from __future__ import annotations

from collections import defaultdict

from ...db import cursor, fetchall_dicts, render_sql
from ..engine import Anomaly
from ..queries import (
    all_banks,
    call_report_facts,
    latest_quarter_with_data,
)
from ..severity import severity
from ..stats import median, percentile_rank

CATEGORY = "peer_deviation"


def _ratio(num, den):
    if num is None or den is None or den == 0:
        return None
    return num / den


def _pick_nbfi_ratio(d: dict) -> tuple[float | None, str]:
    tot = d.get("RCON2122")
    if tot is None or tot == 0:
        return None, ""
    if d.get("RCON1766") is not None:
        return d["RCON1766"] / tot, "loan"
    if d.get("RCONJ457") is not None:
        return d["RCONJ457"] / tot, "commit"
    return None, ""


def _detect_pc(quarter: str) -> list[Anomaly]:
    facts = call_report_facts([quarter], ["RCON1766", "RCONJ457", "RCON2122"])
    banks = all_banks()
    by_peer: dict[str, list[tuple[str, float, str]]] = defaultdict(list)

    for b in banks:
        t = b["ticker"]
        r, src = _pick_nbfi_ratio(facts.get((t, quarter), {}))
        if r is not None:
            by_peer[b["peer_group"] or "unknown"].append((t, r, src))

    out: list[Anomaly] = []
    for peer, triples in by_peer.items():
        if len(triples) < 3:
            continue
        values = [v for _, v, _ in triples]
        peer_med = median(values)
        for ticker, val, src in triples:
            pct = percentile_rank(val, values)
            if pct is None:
                continue
            # Top/bottom 20% — scale with how extreme.
            if pct >= 80.0 or pct <= 20.0:
                magnitude = abs(pct - 50.0) / 20.0   # 50→0, 100→2.5, 0→2.5
                sev = severity(magnitude, category=CATEGORY, theme="private_credit")
                where = (
                    "top 5%" if pct >= 95.0
                    else "top 20%" if pct >= 80.0
                    else "bottom 5%" if pct <= 5.0
                    else "bottom 20%"
                )
                src_label = "loan" if src == "loan" else "commit"
                out.append(
                    Anomaly(
                        theme="private_credit",
                        category=CATEGORY,
                        bank_ticker=ticker,
                        severity=sev,
                        headline=f"NBFI {src_label} ratio in peer-group {where} ({peer})",
                        detail=f"Bank at {val*100:.2f}% (P{pct:.0f}) vs peer median {peer_med*100:.2f}%.",
                        metric_value=val,
                        peer_median=peer_med,
                        z_score=None,
                        quarter=quarter,
                    )
                )
    return out


def _detect_nlp_peer(theme: str) -> list[Anomaly]:
    """For non-PC themes: how concentrated is each bank's *mention frequency*
    relative to peers? Banks blowing past peers in disclosure volume are worth
    a peer-deviation flag.
    """
    sql = render_sql(
        "SELECT b.ticker, b.peer_group, COUNT(ct.chunk_id) AS hits "
        "FROM bank b "
        "LEFT JOIN document d ON d.bank_ticker = b.ticker "
        "LEFT JOIN chunk c ON c.document_id = d.id "
        "LEFT JOIN chunk_topic ct ON ct.chunk_id = c.id AND ct.theme = ? "
        "GROUP BY b.ticker, b.peer_group"
    )
    with cursor() as (_, cur):
        cur.execute(sql, (theme,))
        rows = fetchall_dicts(cur)

    by_peer: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for r in rows:
        by_peer[r["peer_group"] or "unknown"].append((r["ticker"], int(r["hits"] or 0)))

    out: list[Anomaly] = []
    for peer, pairs in by_peer.items():
        if len(pairs) < 4:
            continue
        values = [v for _, v in pairs]
        peer_med = median(values)
        for ticker, val in pairs:
            if val == 0:
                continue
            pct = percentile_rank(val, values)
            if pct is None:
                continue
            if pct >= 90.0:
                magnitude = (pct - 50.0) / 25.0
                sev = severity(magnitude, category=CATEGORY, theme=theme)
                out.append(
                    Anomaly(
                        theme=theme,
                        category=CATEGORY,
                        bank_ticker=ticker,
                        severity=sev,
                        headline=f"Disclosure intensity in peer-group top tier ({peer})",
                        detail=f"{val} {theme.replace('_',' ')}-tagged chunks vs peer median {peer_med:g}. "
                               f"P{pct:.0f}.",
                        metric_value=float(val),
                        peer_median=peer_med,
                    )
                )
    return out


def detect(theme: str, quarter: str | None) -> list[Anomaly]:
    q = quarter or latest_quarter_with_data()
    if theme == "private_credit" and q:
        return _detect_pc(q)
    if theme in {"ai", "digital_assets"}:
        return _detect_nlp_peer(theme)
    return []

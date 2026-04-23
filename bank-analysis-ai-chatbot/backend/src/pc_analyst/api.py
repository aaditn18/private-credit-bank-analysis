"""FastAPI HTTP surface.

Routes:
  POST /search                 -> run the agent loop
  GET  /runs/{id}              -> fetch a persisted run + its trace
  GET  /citations/{chunk_id}   -> resolve a citation (context + highlight)
  GET  /banks                  -> list known banks
  GET  /concepts               -> list taxonomy concepts
"""

from __future__ import annotations

import json
import logging
import traceback
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("pc_analyst")

from .agent.loop import AgentLoop
from .config import settings
from .db import cursor, fetchall_dicts, fetchone_dict, render_sql
from .mcp_tools import TOOLS
from .retrieval.taxonomy import load_taxonomy

app = FastAPI(title="Private Credit Analyst Tool", version="0.1.0")


@app.on_event("startup")
def _warmup() -> None:
    """Pre-load embedding + reranker models so the first request isn't slow."""
    from .retrieval.embeddings import embed
    from .retrieval.reranker import rerank
    embed(["warmup"])
    rerank("warmup", [("warmup text", 1.0)])


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def catch_all(request: Request, exc: Exception) -> JSONResponse:
    """Log the full traceback so 500s are visible in the backend log."""
    tb = traceback.format_exc()
    log.error("Unhandled error on %s %s: %s\n%s", request.method, request.url.path, exc, tb)
    return JSONResponse(status_code=500, content={"detail": str(exc), "type": type(exc).__name__})


class SearchRequest(BaseModel):
    question: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/banks")
def list_banks() -> list[dict[str, Any]]:
    with cursor() as (handle, cur):
        cur.execute(render_sql("SELECT ticker, name, peer_group FROM bank ORDER BY ticker"))
        return fetchall_dicts(cur)


@app.get("/concepts")
def list_concepts() -> list[dict[str, Any]]:
    tax = load_taxonomy()
    return [
        {
            "key": c.key,
            "label": c.label,
            "synonyms": c.synonyms,
            "call_report_lines": [
                {"schedule": li.schedule, "line_item": li.line_item, "mnemonic": li.mnemonic, "label": li.label}
                for li in c.call_report_lines
            ],
        }
        for c in tax.concepts.values()
    ]


@app.post("/search")
def search(req: SearchRequest) -> dict[str, Any]:
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="question is required")
    result = AgentLoop().run(req.question)
    return {
        "run_id": result.run_id,
        "question": result.question,
        "answer_markdown": result.answer_markdown,
        "citations": result.citations,
        "reasoning_steps": result.reasoning_steps,
        "disclosure_drift": result.disclosure_drift,
    }


@app.get("/runs/{run_id}")
def get_run(run_id: int) -> dict[str, Any]:
    with cursor() as (handle, cur):
        cur.execute(
            render_sql(
                "SELECT id, question, answer, citations_json, started_at, finished_at, "
                "llm_provider, llm_model, status FROM agent_run WHERE id = ?"
            ),
            (run_id,),
        )
        run = fetchone_dict(cur)
        if not run:
            raise HTTPException(status_code=404, detail="run not found")
        cur.execute(
            render_sql(
                "SELECT step_index, step_type, tool_name, tool_arguments, tool_result, summary, created_at "
                "FROM reasoning_step WHERE run_id = ? ORDER BY step_index"
            ),
            (run_id,),
        )
        steps = fetchall_dicts(cur)

    for step in steps:
        for key in ("tool_arguments", "tool_result"):
            val = step.get(key)
            if isinstance(val, str):
                try:
                    step[key] = json.loads(val)
                except Exception:
                    pass
    cits = run.get("citations_json")
    if isinstance(cits, str):
        try:
            run["citations_json"] = json.loads(cits)
        except Exception:
            pass
    run["reasoning_steps"] = steps
    return run


@app.get("/rankings")
def get_rankings(quarter: str = "2025Q4") -> dict[str, Any]:
    import math

    METRICS = [
        {
            "key": "ci_ratio",
            "label": "C&I Concentration",
            "description": "C&I loans as % of total loans. Measures how commercially-focused the bank's lending book is — higher means more corporate/commercial DNA.",
            "higher_is_better": True,
            "mnemonic_num": "RCON1763",
            "mnemonic_den": "RCON2122",
        },
        {
            "key": "loan_scale",
            "label": "Loan Book Scale",
            "description": "Log-normalized total loan balance. Larger books mean more capacity to originate and hold private credit positions.",
            "higher_is_better": True,
            "mnemonic_num": "RCON2122",
            "mnemonic_den": None,
        },
        {
            "key": "nbfi_loan_ratio",
            "label": "NBFI Loan Ratio",
            "description": "C&I loans to non-bank financial institutions as % of total loans (FFIEC RCON1766). Direct measure of how much the bank lends to private credit funds and NBFIs.",
            "higher_is_better": True,
            "mnemonic_num": "RCON1766",
            "mnemonic_den": "RCON2122",
        },
        {
            "key": "nbfi_commitment_ratio",
            "label": "NBFI Commitment Pipeline",
            "description": "Unused loan commitments to NBFIs as % of total loans (RCONJ457). Forward-looking indicator of private credit lending pipeline.",
            "higher_is_better": True,
            "mnemonic_num": "RCONJ457",
            "mnemonic_den": "RCON2122",
        },
        {
            "key": "pe_exposure",
            "label": "Private Equity Exposure",
            "description": "PE/equity investment holdings as % of total loans (RCOA8274). Banks with direct PE investments often have the closest relationships with private credit sponsors.",
            "higher_is_better": True,
            "mnemonic_num": "RCOA8274",
            "mnemonic_den": "RCON2122",
        },
        {
            "key": "nbfi_growth",
            "label": "NBFI Loan Growth (QoQ)",
            "description": "Quarter-over-quarter change in the NBFI loan ratio. Positive = bank is growing its private credit lending book.",
            "higher_is_better": True,
            "mnemonic_num": "RCON1766",
            "mnemonic_den": "RCON2122",
        },
    ]

    # Derive the previous quarter for growth calculation
    y, q = int(quarter[:4]), int(quarter[5])
    prev_q = q - 1 if q > 1 else 4
    prev_y = y if q > 1 else y - 1
    prev_quarter = f"{prev_y}Q{prev_q}"

    mnemonics = {"RCON1763", "RCON2122", "RCON1766", "RCONJ457", "RCOA8274"}

    with cursor() as (handle, cur):
        # Fetch current quarter
        cur.execute(
            render_sql(
                "SELECT b.ticker, b.name, b.peer_group, c.line_item, c.value_numeric "
                "FROM bank b "
                "LEFT JOIN call_report_fact c ON c.bank_ticker = b.ticker AND c.quarter = ? "
                "WHERE b.ticker IS NOT NULL"
            ),
            (quarter,),
        )
        rows = fetchall_dicts(cur)

        # Fetch previous quarter for growth
        cur.execute(
            render_sql(
                "SELECT bank_ticker, line_item, value_numeric FROM call_report_fact "
                "WHERE quarter = ?"
            ),
            (prev_quarter,),
        )
        prev_rows = fetchall_dicts(cur)

    # Build per-bank mnemonic maps
    bank_meta: dict[str, dict] = {}
    bank_data: dict[str, dict[str, float | None]] = {}
    for row in rows:
        t = row["ticker"]
        if t not in bank_meta:
            bank_meta[t] = {"ticker": t, "name": row["name"], "peer_group": row["peer_group"]}
            bank_data[t] = {}
        if row["line_item"] in mnemonics and row["value_numeric"] is not None:
            bank_data[t][row["line_item"]] = row["value_numeric"]

    prev_data: dict[str, dict[str, float | None]] = {}
    for row in prev_rows:
        t = row["bank_ticker"]
        if row["line_item"] in mnemonics and row["value_numeric"] is not None:
            prev_data.setdefault(t, {})[row["line_item"]] = row["value_numeric"]

    # Compute raw metric values per bank
    def ratio(num: float | None, den: float | None) -> float | None:
        if num is None or den is None or den == 0:
            return None
        return num / den

    bank_raw: dict[str, dict[str, float | None]] = {}
    for t, d in bank_data.items():
        total = d.get("RCON2122")
        prev_total = prev_data.get(t, {}).get("RCON2122")
        nbfi_cur = ratio(d.get("RCON1766"), total)
        nbfi_prev = ratio(prev_data.get(t, {}).get("RCON1766"), prev_total)
        growth = None
        if nbfi_cur is not None and nbfi_prev is not None and nbfi_prev > 0:
            growth = (nbfi_cur - nbfi_prev) / nbfi_prev

        bank_raw[t] = {
            "ci_ratio": ratio(d.get("RCON1763"), total),
            "loan_scale": math.log(total) if total and total > 0 else None,
            "nbfi_loan_ratio": nbfi_cur,
            "nbfi_commitment_ratio": ratio(d.get("RCONJ457"), total),
            "pe_exposure": ratio(d.get("RCOA8274"), total),
            "nbfi_growth": growth,
        }

    # Min-max normalize each metric across banks that have values
    def minmax(values: list[float]) -> tuple[float, float]:
        v = [x for x in values if x is not None]
        if not v or min(v) == max(v):
            return 0.0, 1.0
        return min(v), max(v)

    metric_keys = [m["key"] for m in METRICS]
    mins_maxs: dict[str, tuple[float, float]] = {}
    for key in metric_keys:
        vals = [bank_raw[t].get(key) for t in bank_raw if bank_raw[t].get(key) is not None]
        mins_maxs[key] = minmax(vals)  # type: ignore[arg-type]

    def normalize(key: str, val: float | None) -> float:
        if val is None:
            return 0.0
        lo, hi = mins_maxs[key]
        if hi == lo:
            return 0.5
        return (val - lo) / (hi - lo)

    banks_out = []
    for t, meta in bank_meta.items():
        raw = bank_raw.get(t, {})
        norm = {k: normalize(k, raw.get(k)) for k in metric_keys}
        banks_out.append({**meta, "raw": raw, "norm": norm})

    return {
        "quarter": quarter,
        "prev_quarter": prev_quarter,
        "metrics": METRICS,
        "banks": banks_out,
    }


@app.get("/citations/{chunk_id}")
def resolve_citation(chunk_id: int) -> dict[str, Any]:
    result = TOOLS["resolve_citation"].handler(chunk_id=chunk_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.get("/stock/{ticker}")
def get_stock(ticker: str, period: str = "2y") -> list[dict[str, Any]]:
    """Fetch stock price history, caching in DB."""
    from datetime import datetime, timedelta

    with cursor() as (handle, cur):
        cur.execute(
            render_sql("SELECT date, close, volume FROM stock_price WHERE bank_ticker = ? ORDER BY date"),
            (ticker,),
        )
        rows = fetchall_dicts(cur)

    if rows:
        last = rows[-1]["date"]
        last_dt = datetime.strptime(str(last)[:10], "%Y-%m-%d") if isinstance(last, str) else last
        if (datetime.now() - last_dt).days < 7:
            return rows
    # If DB is empty, always try to fetch (no staleness check needed)

    try:
        import yfinance as yf
        hist = yf.Ticker(ticker).history(period=period)
        if hist.empty:
            return rows

        with cursor() as (handle, cur):
            for idx, row in hist.iterrows():
                d = idx.strftime("%Y-%m-%d")
                c = round(float(row["Close"]), 2)
                v = int(row["Volume"]) if row["Volume"] else None
                if handle.backend == "postgres":
                    cur.execute(
                        render_sql(
                            "INSERT INTO stock_price (bank_ticker, date, close, volume) "
                            "VALUES (?, ?, ?, ?) ON CONFLICT (bank_ticker, date) DO UPDATE SET close=EXCLUDED.close, volume=EXCLUDED.volume"
                        ),
                        (ticker, d, c, v),
                    )
                else:
                    cur.execute(
                        "INSERT OR REPLACE INTO stock_price (bank_ticker, date, close, volume) VALUES (?, ?, ?, ?)",
                        (ticker, d, c, v),
                    )

            cur.execute(
                render_sql("SELECT date, close, volume FROM stock_price WHERE bank_ticker = ? ORDER BY date"),
                (ticker,),
            )
            return fetchall_dicts(cur)
    except Exception as e:
        log.warning("yfinance fetch failed for %s: %s", ticker, e)
        return rows


@app.get("/news/{ticker}")
def get_news(ticker: str) -> list[dict[str, Any]]:
    """Fetch news for a bank ticker via Alpha Vantage, cache in DB."""
    from datetime import datetime

    # Check cache first
    with cursor() as (handle, cur):
        cur.execute(
            render_sql("SELECT headline, url, published_at, sentiment_score FROM news_article WHERE bank_ticker = ? ORDER BY published_at DESC"),
            (ticker,),
        )
        cached = fetchall_dicts(cur)

    # If we have recent articles (any from last 3 days), return cache
    if cached:
        try:
            latest = datetime.strptime(str(cached[0]["published_at"])[:10], "%Y-%m-%d")
            if (datetime.now() - latest).days < 3:
                return cached
        except Exception:
            pass

    # Fetch from Alpha Vantage
    api_key = settings.alphavantage_api_key
    if not api_key:
        return cached

    try:
        import httpx
        resp = httpx.get(
            "https://www.alphavantage.co/query",
            params={"function": "NEWS_SENTIMENT", "tickers": ticker, "apikey": api_key},
            timeout=15,
        )
        data = resp.json()
        feed = data.get("feed", [])

        articles = []
        with cursor() as (handle, cur):
            for item in feed[:25]:  # limit to 25 articles
                # Find ticker-specific sentiment
                sentiment = None
                for ts in item.get("ticker_sentiment", []):
                    if ts.get("ticker") == ticker:
                        try:
                            sentiment = float(ts["ticker_sentiment_score"])
                        except (ValueError, KeyError):
                            pass
                        break
                if sentiment is None:
                    try:
                        sentiment = float(item.get("overall_sentiment_score", 0))
                    except (ValueError, TypeError):
                        sentiment = 0.0

                time_str = item.get("time_published", "")
                try:
                    pub_date = datetime.strptime(time_str[:8], "%Y%m%d").strftime("%Y-%m-%d")
                except Exception:
                    pub_date = datetime.now().strftime("%Y-%m-%d")

                headline = item.get("title", "")
                url = item.get("url", "")

                if handle.backend == "postgres":
                    cur.execute(
                        render_sql(
                            "INSERT INTO news_article (bank_ticker, headline, url, published_at, sentiment_score) "
                            "VALUES (?, ?, ?, ?, ?) ON CONFLICT (bank_ticker, url) DO UPDATE SET sentiment_score=EXCLUDED.sentiment_score"
                        ),
                        (ticker, headline, url, pub_date, sentiment),
                    )
                else:
                    cur.execute(
                        "INSERT OR REPLACE INTO news_article (bank_ticker, headline, url, published_at, sentiment_score) VALUES (?, ?, ?, ?, ?)",
                        (ticker, headline, url, pub_date, sentiment),
                    )
                articles.append({"headline": headline, "url": url, "published_at": pub_date, "sentiment_score": sentiment})

        return articles if articles else cached
    except Exception as e:
        log.warning("Alpha Vantage fetch failed for %s: %s", ticker, e)
        return cached


@app.get("/trends")
def get_trends() -> dict[str, Any]:
    """Cross-bank trend data for the trends dashboard."""
    import math

    mnemonics = {"RCON1763", "RCON2122", "RCON1766", "RCONJ457", "RCOA8274"}

    with cursor() as (handle, cur):
        # All call report data
        cur.execute(render_sql(
            "SELECT b.ticker, b.name, b.peer_group, c.quarter, c.line_item, c.value_numeric "
            "FROM bank b LEFT JOIN call_report_fact c ON c.bank_ticker = b.ticker "
            "WHERE b.ticker IS NOT NULL ORDER BY b.ticker, c.quarter"
        ))
        cr_rows = fetchall_dicts(cur)

    # Build bank metadata
    banks: dict[str, dict] = {}
    # Build metrics by bank by quarter
    bank_quarter_data: dict[str, dict[str, dict[str, float | None]]] = {}

    for row in cr_rows:
        t = row["ticker"]
        if t not in banks:
            banks[t] = {"ticker": t, "name": row["name"], "peer_group": row["peer_group"]}
        q = row.get("quarter")
        li = row.get("line_item")
        val = row.get("value_numeric")
        if q and li in mnemonics and val is not None:
            bank_quarter_data.setdefault(t, {}).setdefault(q, {})[li] = val

    def ratio(num, den):
        if num is None or den is None or den == 0:
            return None
        return num / den

    # Compute ratios per bank per quarter
    metrics_over_time: dict[str, dict[str, dict[str, float | None]]] = {}
    for t, quarters in bank_quarter_data.items():
        metrics_over_time[t] = {}
        for q, d in sorted(quarters.items()):
            total = d.get("RCON2122")
            nbfi_loan = ratio(d.get("RCON1766"), total)
            nbfi_commit = ratio(d.get("RCONJ457"), total)
            # For GSIBs that lack RCON1766 (domestic NBFI loans), use commitment
            # ratio as the best available proxy for NBFI exposure.
            nbfi_exposure = nbfi_loan if nbfi_loan is not None else nbfi_commit
            metrics_over_time[t][q] = {
                "ci_ratio": ratio(d.get("RCON1763"), total),
                "loan_scale": math.log(total) if total and total > 0 else None,
                "nbfi_loan_ratio": nbfi_exposure,
                "nbfi_commitment_ratio": nbfi_commit,
                "pe_exposure": ratio(d.get("RCOA8274"), total),
            }

    # Aggregate industry trends: average NBFI ratio across banks per quarter
    all_quarters = sorted(set(q for bq in bank_quarter_data.values() for q in bq))
    industry_trend = []
    for q in all_quarters:
        nbfi_vals = []
        ci_vals = []
        for t in bank_quarter_data:
            m = metrics_over_time.get(t, {}).get(q, {})
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

    # Pullback detection: banks whose NBFI ratio decreased in latest quarter
    pullbacks = []
    for t, quarters in metrics_over_time.items():
        sorted_qs = sorted(quarters.keys())
        if len(sorted_qs) >= 2:
            latest = quarters[sorted_qs[-1]]
            prev = quarters[sorted_qs[-2]]
            if latest.get("nbfi_loan_ratio") is not None and prev.get("nbfi_loan_ratio") is not None:
                change = latest["nbfi_loan_ratio"] - prev["nbfi_loan_ratio"]
                if change < 0:
                    pullbacks.append({
                        **banks.get(t, {}),
                        "prev_quarter": sorted_qs[-2],
                        "latest_quarter": sorted_qs[-1],
                        "prev_ratio": prev["nbfi_loan_ratio"],
                        "latest_ratio": latest["nbfi_loan_ratio"],
                        "change": change,
                    })
    pullbacks.sort(key=lambda x: x["change"])

    # Exposure ranking: all banks sorted by latest NBFI loan ratio (descending)
    exposure_ranking = []
    for t, quarters in metrics_over_time.items():
        sorted_qs = sorted(quarters.keys())
        if not sorted_qs:
            continue
        latest_q = sorted_qs[-1]
        m = quarters[latest_q]
        if m.get("nbfi_loan_ratio") is not None:
            exposure_ranking.append({
                **banks.get(t, {}),
                "latest_quarter": latest_q,
                "nbfi_ratio": m["nbfi_loan_ratio"],
                "ci_ratio": m.get("ci_ratio"),
                "commitment_ratio": m.get("nbfi_commitment_ratio"),
                "pe_exposure": m.get("pe_exposure"),
            })
    exposure_ranking.sort(key=lambda x: x["nbfi_ratio"], reverse=True)
    for i, item in enumerate(exposure_ranking, 1):
        item["rank"] = i

    # Quarter movers: biggest QoQ change in NBFI ratio
    quarter_movers = []
    for t, quarters in metrics_over_time.items():
        sorted_qs = sorted(quarters.keys())
        if len(sorted_qs) >= 2:
            latest_q = sorted_qs[-1]
            prev_q = sorted_qs[-2]
            latest_m = quarters[latest_q]
            prev_m = quarters[prev_q]
            if latest_m.get("nbfi_loan_ratio") is not None and prev_m.get("nbfi_loan_ratio") is not None:
                change = latest_m["nbfi_loan_ratio"] - prev_m["nbfi_loan_ratio"]
                quarter_movers.append({
                    **banks.get(t, {}),
                    "prev_quarter": prev_q,
                    "latest_quarter": latest_q,
                    "prev_ratio": prev_m["nbfi_loan_ratio"],
                    "latest_ratio": latest_m["nbfi_loan_ratio"],
                    "change": change,
                    "direction": "expanding" if change >= 0 else "contracting",
                })
    quarter_movers.sort(key=lambda x: abs(x["change"]), reverse=True)

    # Peer group comparison: average metrics per peer group per quarter
    peer_group_comparison: dict[str, dict[str, dict[str, float | None]]] = {}
    for q in all_quarters:
        group_nbfi: dict[str, list[float]] = {}
        group_ci: dict[str, list[float]] = {}
        for t in bank_quarter_data:
            pg = banks.get(t, {}).get("peer_group", "Unknown")
            m = metrics_over_time.get(t, {}).get(q, {})
            if m.get("nbfi_loan_ratio") is not None:
                group_nbfi.setdefault(pg, []).append(m["nbfi_loan_ratio"])
            if m.get("ci_ratio") is not None:
                group_ci.setdefault(pg, []).append(m["ci_ratio"])
        all_groups = set(list(group_nbfi.keys()) + list(group_ci.keys()))
        for pg in all_groups:
            peer_group_comparison.setdefault(pg, {})[q] = {
                "avg_nbfi_ratio": sum(group_nbfi[pg]) / len(group_nbfi[pg]) if pg in group_nbfi and group_nbfi[pg] else None,
                "avg_ci_ratio": sum(group_ci[pg]) / len(group_ci[pg]) if pg in group_ci and group_ci[pg] else None,
                "bank_count": len(group_nbfi.get(pg, [])),
            }

    return {
        "banks": list(banks.values()),
        "metrics_over_time": metrics_over_time,
        "industry_trend": industry_trend,
        "pullbacks": pullbacks,
        "exposure_ranking": exposure_ranking,
        "quarter_movers": quarter_movers,
        "peer_group_comparison": peer_group_comparison,
    }


@app.get("/timeline/{ticker}")
def get_timeline(ticker: str) -> dict[str, Any]:
    """All timeline data for a single bank."""
    import math

    mnemonics = {"RCON1763", "RCON2122", "RCON1766", "RCONJ457", "RCOA8274"}

    with cursor() as (handle, cur):
        # Bank info
        cur.execute(render_sql("SELECT ticker, name, peer_group FROM bank WHERE ticker = ?"), (ticker,))
        bank = fetchone_dict(cur)
        if not bank:
            raise HTTPException(status_code=404, detail=f"Bank {ticker} not found")

        # Filing history
        cur.execute(render_sql(
            "SELECT doc_type, fiscal_year, fiscal_quarter, filed_at, title "
            "FROM document WHERE bank_ticker = ? ORDER BY fiscal_year, fiscal_quarter"
        ), (ticker,))
        filings = fetchall_dicts(cur)

        # Call report data
        cur.execute(render_sql(
            "SELECT quarter, line_item, value_numeric FROM call_report_fact "
            "WHERE bank_ticker = ? ORDER BY quarter"
        ), (ticker,))
        cr_rows = fetchall_dicts(cur)

        # Stock prices
        cur.execute(render_sql(
            "SELECT date, close, volume FROM stock_price WHERE bank_ticker = ? ORDER BY date"
        ), (ticker,))
        stocks = fetchall_dicts(cur)

        # News
        cur.execute(render_sql(
            "SELECT headline, url, published_at, sentiment_score FROM news_article "
            "WHERE bank_ticker = ? ORDER BY published_at DESC LIMIT 50"
        ), (ticker,))
        news = fetchall_dicts(cur)

    # Compute metrics by quarter
    quarter_data: dict[str, dict[str, float | None]] = {}
    for row in cr_rows:
        q = row["quarter"]
        li = row["line_item"]
        val = row["value_numeric"]
        if li in mnemonics and val is not None:
            quarter_data.setdefault(q, {})[li] = val

    def ratio(num, den):
        if num is None or den is None or den == 0:
            return None
        return num / den

    metrics_by_quarter: dict[str, dict[str, float | None]] = {}
    for q, d in sorted(quarter_data.items()):
        total = d.get("RCON2122")
        nbfi_loan = ratio(d.get("RCON1766"), total)
        nbfi_commit = ratio(d.get("RCONJ457"), total)
        nbfi_exposure = nbfi_loan if nbfi_loan is not None else nbfi_commit
        metrics_by_quarter[q] = {
            "ci_ratio": ratio(d.get("RCON1763"), total),
            "loan_scale": math.log(total) if total and total > 0 else None,
            "nbfi_loan_ratio": nbfi_exposure,
            "nbfi_commitment_ratio": nbfi_commit,
            "pe_exposure": ratio(d.get("RCOA8274"), total),
        }

    return {
        "ticker": bank["ticker"],
        "name": bank["name"],
        "peer_group": bank["peer_group"],
        "filings": filings,
        "metrics_by_quarter": metrics_by_quarter,
        "stock_prices": stocks,
        "news": news,
    }


@app.get("/findings")
def get_findings() -> list[dict[str, Any]]:
    """Private credit findings per bank from LLM analysis."""
    with cursor() as (handle, cur):
        cur.execute(render_sql(
            "SELECT bank_ticker, bank_name, rating, mention_frequency, sentiment, "
            "key_themes, strategic_initiatives, perceived_risks, notable_quotes, "
            "pullback_mentions, named_competitors, risk_focus_analysis, involvement_rating "
            "FROM pc_finding ORDER BY involvement_rating DESC, bank_ticker"
        ))
        rows = fetchall_dicts(cur)
    # Parse JSON fields
    import json as _json
    for row in rows:
        for field in ("key_themes", "notable_quotes"):
            val = row.get(field)
            if isinstance(val, str):
                try:
                    row[field] = _json.loads(val)
                except Exception:
                    pass
    return rows


@app.get("/findings/{ticker}")
def get_finding(ticker: str) -> dict[str, Any]:
    """Private credit finding for a single bank."""
    with cursor() as (handle, cur):
        cur.execute(render_sql(
            "SELECT bank_ticker, bank_name, rating, mention_frequency, sentiment, "
            "key_themes, strategic_initiatives, perceived_risks, notable_quotes, "
            "pullback_mentions, named_competitors, risk_focus_analysis, involvement_rating "
            "FROM pc_finding WHERE bank_ticker = ?"
        ), (ticker,))
        row = fetchone_dict(cur)
    if not row:
        raise HTTPException(status_code=404, detail=f"No findings for {ticker}")
    import json as _json
    for field in ("key_themes", "notable_quotes"):
        val = row.get(field)
        if isinstance(val, str):
            try:
                row[field] = _json.loads(val)
            except Exception:
                pass
    return row


if __name__ == "__main__":
    import uvicorn
    from .config import settings
    uvicorn.run(
        "pc_analyst.api:app",
        host="0.0.0.0",
        port=settings.backend_port,
        reload=False,
        # Next.js keeps HTTP/1.1 connections open; default 5s keepalive drops them
        # between requests, causing ECONNRESET on the next proxy attempt.
        timeout_keep_alive=120,
        # Don't silently reject slow requests
        timeout_graceful_shutdown=10,
        # CPU-only inference: any more than this causes thread contention on
        # the model locks and risks OOM. Excess requests queue instead of
        # crashing the process.
        limit_concurrency=8,
    )

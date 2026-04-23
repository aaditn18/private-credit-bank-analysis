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

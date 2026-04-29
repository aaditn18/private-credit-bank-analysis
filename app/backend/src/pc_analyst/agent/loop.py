"""Agent orchestration loop.

1. Decompose the question into a plan.
2. Execute every planned tool call.
3. Detect disclosure drift (qualitative vs quantitative mismatch).
4. Synthesize an answer with inline citations.
5. Persist the agent_run + reasoning_step rows so the UI can render a trace.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from typing import Any

from ..db import cursor, fetchone_dict, render_sql
from ..mcp_tools import TOOLS
from ..retrieval.taxonomy import load_taxonomy
from .decomposer import Plan, decompose
from .synthesizer import Synthesis, synthesize


@dataclass
class AgentResult:
    run_id: int
    question: str
    answer_markdown: str
    citations: list[dict[str, Any]]
    reasoning_steps: list[dict[str, Any]]
    disclosure_drift: list[dict[str, Any]]


class AgentLoop:
    def run(self, question: str) -> AgentResult:
        run_id = self._start_run(question)
        steps: list[dict[str, Any]] = []

        plan: Plan = decompose(question)
        self._log_step(
            run_id=run_id,
            step_index=len(steps),
            step_type="decompose",
            tool_name=None,
            tool_arguments=None,
            tool_result={
                "banks": plan.banks,
                "concepts": plan.concepts,
                "quarter": plan.quarter,
                "planned_calls": [{"tool": c.tool, "arguments": c.arguments, "rationale": c.rationale} for c in plan.calls],
            },
            summary=(
                f"Identified banks={plan.banks} concepts={plan.concepts} quarter={plan.quarter}; "
                f"planned {len(plan.calls)} tool call(s)."
            ),
            steps=steps,
        )

        tool_results: list[dict[str, Any]] = []
        for call in plan.calls:
            spec = TOOLS.get(call.tool)
            if not spec:
                continue
            try:
                result = spec.handler(**call.arguments)
            except Exception as e:
                result = {"error": repr(e)}
            tool_results.append({"tool": call.tool, "arguments": call.arguments, "result": result})
            self._log_step(
                run_id=run_id,
                step_index=len(steps),
                step_type="tool_call",
                tool_name=call.tool,
                tool_arguments=call.arguments,
                tool_result=result,
                summary=_summarize_result(call.tool, result),
                steps=steps,
            )

        drift = _detect_drift(plan, tool_results)
        if drift:
            self._log_step(
                run_id=run_id,
                step_index=len(steps),
                step_type="note",
                tool_name=None,
                tool_arguments=None,
                tool_result={"drift": drift},
                summary=f"Detected {len(drift)} potential disclosure-drift signal(s).",
                steps=steps,
            )

        synthesis: Synthesis = synthesize(question, tool_results)
        self._log_step(
            run_id=run_id,
            step_index=len(steps),
            step_type="synthesize",
            tool_name=None,
            tool_arguments={"provider": synthesis.provider, "model": synthesis.model},
            tool_result={"answer_markdown": synthesis.answer_markdown},
            summary=f"Synthesized answer via {synthesis.provider}.",
            steps=steps,
        )

        citations = [asdict(c) for c in synthesis.citations]
        self._finish_run(run_id, synthesis, citations)
        return AgentResult(
            run_id=run_id,
            question=question,
            answer_markdown=synthesis.answer_markdown,
            citations=citations,
            reasoning_steps=steps,
            disclosure_drift=drift,
        )

    # ------------------------------------------------------------------

    def _start_run(self, question: str) -> int:
        from ..config import settings

        with cursor() as (handle, cur):
            if handle.backend == "postgres":
                cur.execute(
                    "INSERT INTO agent_run (question, llm_provider, llm_model, status) "
                    "VALUES (%s, %s, %s, 'running') RETURNING id",
                    (question, settings.llm_provider, settings.anthropic_model if settings.llm_provider == "anthropic" else None),
                )
                row = cur.fetchone()
                return int(row[0])
            else:
                cur.execute(
                    render_sql(
                        "INSERT INTO agent_run (question, llm_provider, llm_model, status) "
                        "VALUES (?, ?, ?, 'running')"
                    ),
                    (question, settings.llm_provider, settings.anthropic_model if settings.llm_provider == "anthropic" else None),
                )
                return int(cur.lastrowid)

    def _log_step(
        self,
        *,
        run_id: int,
        step_index: int,
        step_type: str,
        tool_name: str | None,
        tool_arguments: dict[str, Any] | None,
        tool_result: Any,
        summary: str,
        steps: list[dict[str, Any]],
    ) -> None:
        step = {
            "step_index": step_index,
            "step_type": step_type,
            "tool_name": tool_name,
            "tool_arguments": tool_arguments,
            "tool_result": tool_result,
            "summary": summary,
        }
        steps.append(step)
        with cursor() as (handle, cur):
            args_json = json.dumps(tool_arguments, default=str) if tool_arguments is not None else None
            result_json = json.dumps(tool_result, default=str)
            if handle.backend == "postgres":
                cur.execute(
                    "INSERT INTO reasoning_step (run_id, step_index, step_type, tool_name, "
                    "tool_arguments, tool_result, summary) VALUES (%s, %s, %s, %s, %s::jsonb, %s::jsonb, %s)",
                    (run_id, step_index, step_type, tool_name, args_json, result_json, summary),
                )
            else:
                cur.execute(
                    render_sql(
                        "INSERT INTO reasoning_step (run_id, step_index, step_type, tool_name, "
                        "tool_arguments, tool_result, summary) VALUES (?, ?, ?, ?, ?, ?, ?)"
                    ),
                    (run_id, step_index, step_type, tool_name, args_json, result_json, summary),
                )

    def _finish_run(self, run_id: int, synthesis: Synthesis, citations: list[dict[str, Any]]) -> None:
        with cursor() as (handle, cur):
            citations_json = json.dumps(citations, default=str)
            if handle.backend == "postgres":
                cur.execute(
                    "UPDATE agent_run SET answer = %s, citations_json = %s::jsonb, "
                    "finished_at = NOW(), status = 'done' WHERE id = %s",
                    (synthesis.answer_markdown, citations_json, run_id),
                )
            else:
                cur.execute(
                    render_sql(
                        "UPDATE agent_run SET answer = ?, citations_json = ?, "
                        "finished_at = CURRENT_TIMESTAMP, status = 'done' WHERE id = ?"
                    ),
                    (synthesis.answer_markdown, citations_json, run_id),
                )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _summarize_result(tool: str, result: Any) -> str:
    if not isinstance(result, dict):
        return f"{tool} returned non-dict"
    if "error" in result:
        return f"{tool} error: {result['error']}"
    if tool == "search_documents":
        hits = result.get("hits", [])
        return f"{len(hits)} hits; top bank(s)={list({h['bank'] for h in hits})[:3]}"
    if tool == "query_call_report":
        facts = result.get("facts", [])
        return f"{len(facts)} call-report facts"
    if tool == "compare_peers":
        rows = result.get("rows", [])
        return f"peer table with {len(rows)} banks"
    if tool == "resolve_citation":
        return f"resolved chunk {result.get('id')}"
    return f"{tool} ok"


def _detect_drift(plan: Plan, tool_results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Flag if narrative sentiment and call-report direction disagree.

    Cheap heuristic: if any search hit for a concept contains 'down' keywords
    while call-report values for the same bank+concept are rising (or vice
    versa) between the two most recent quarters we have, flag it.
    """
    tax = load_taxonomy()
    drift: list[dict[str, Any]] = []
    if not plan.concepts:
        return drift
    concept = plan.concepts[0]
    rule = tax.drift_rule(concept)
    if not rule:
        return drift

    # Collect narrative sentiment signals by bank
    sentiment: dict[str, str] = {}
    for r in tool_results:
        if r.get("tool") != "search_documents":
            continue
        for h in r["result"].get("hits", []):
            low = h["text"].lower()
            if any(k in low for k in rule.down_keywords):
                sentiment.setdefault(h["bank"], "down")
            elif any(k in low for k in rule.up_keywords):
                sentiment.setdefault(h["bank"], "up")

    # Collect quantitative direction. Drift requires a time-series on the
    # same (bank, schedule, line_item); mixing line items at one quarter is
    # not a trend and would produce spurious flags.
    cr_rows: list[dict[str, Any]] = []
    for r in tool_results:
        if r.get("tool") == "query_call_report":
            cr_rows.extend(r["result"].get("facts", []))

    by_series: dict[tuple[str, str, str], list[dict[str, Any]]] = {}
    for f in cr_rows:
        key = (f["bank_ticker"], f["schedule"], f["line_item"])
        by_series.setdefault(key, []).append(f)

    for (bank, _, _), rows in by_series.items():
        rows.sort(key=lambda r: r.get("quarter") or "")
        if len({r["quarter"] for r in rows}) < 2:
            continue
        first, last = rows[0], rows[-1]
        if first.get("value_numeric") is None or last.get("value_numeric") is None:
            continue
        direction = "up" if last["value_numeric"] > first["value_numeric"] else "down"
        narrative = sentiment.get(bank)
        if narrative and narrative != direction:
            drift.append(
                {
                    "bank": bank,
                    "concept": concept,
                    "schedule": first["schedule"],
                    "line_item": first["line_item"],
                    "narrative_direction": narrative,
                    "quantitative_direction": direction,
                    "first_quarter": first["quarter"],
                    "last_quarter": last["quarter"],
                    "first_value": first["value_numeric"],
                    "last_value": last["value_numeric"],
                }
            )
    return drift


# Convenience accessor for the API & CLI

def run_agent(question: str) -> AgentResult:
    return AgentLoop().run(question)

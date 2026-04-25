"""Answer synthesizer.

Two strategies:

- ``extractive``: pulls the top-ranked span(s) from ``search_documents``
  and assembles a cite-tagged answer. Fully deterministic; no LLM. This
  is the default when ``LLM_PROVIDER=none``.
- ``anthropic``: calls Claude with the tool results and a strict
  system prompt that demands inline ``[n]`` citations.

Both emit the same ``Synthesis`` shape so the rest of the pipeline is
provider-agnostic.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from ..config import settings


@dataclass
class Citation:
    marker: int
    chunk_id: int
    bank: str
    doc_type: str
    fiscal_year: int | None
    fiscal_quarter: int | None
    section: str | None
    char_start: int
    char_end: int
    text: str


@dataclass
class Synthesis:
    answer_markdown: str
    citations: list[Citation]
    provider: str
    model: str | None


# ---------------------------------------------------------------------------
# Extractive synthesizer (LLM-free)
# ---------------------------------------------------------------------------

def extractive(question: str, tool_results: list[dict[str, Any]]) -> Synthesis:
    search_results: list[dict[str, Any]] = []
    call_report_results: list[dict[str, Any]] = []
    peer_results: list[dict[str, Any]] = []
    for r in tool_results:
        if r.get("tool") == "search_documents":
            search_results.append(r["result"])
        elif r.get("tool") == "query_call_report":
            call_report_results.append(r["result"])
        elif r.get("tool") == "compare_peers":
            peer_results.append(r["result"])

    hits: list[dict[str, Any]] = []
    for sr in search_results:
        hits.extend(sr.get("hits", []))

    top = hits[:4]
    citations: list[Citation] = []
    lines: list[str] = []
    if top:
        lines.append("## AI overview\n")
        lines.append(f"**Question:** {question}\n")
        lines.append("Based on the filings retrieved for this query:\n")
        for idx, h in enumerate(top, start=1):
            citations.append(
                Citation(
                    marker=idx,
                    chunk_id=h["chunk_id"],
                    bank=h["bank"],
                    doc_type=h["doc_type"],
                    fiscal_year=h.get("fiscal_year"),
                    fiscal_quarter=h.get("fiscal_quarter"),
                    section=h.get("section"),
                    char_start=h["char_start"],
                    char_end=h["char_end"],
                    text=h["text"],
                )
            )
            quote = _shorten(h["text"], 320)
            bank = h["bank"]
            dtag = f"{h['doc_type']} {h.get('fiscal_year')}Q{h.get('fiscal_quarter')}"
            lines.append(f"- {bank} ({dtag}): \u201c{quote}\u201d [{idx}]")
        lines.append("")
    else:
        lines.append("## AI overview\n")
        lines.append(
            "No narrative passages matched the query in the current index. Try broadening the "
            "question or expanding the ingested filings."
        )

    # Call Report ground-truth
    if call_report_results:
        lines.append("## Call Report facts\n")
        for cr in call_report_results:
            facts = cr.get("facts", [])
            if not facts:
                continue
            lines.append(f"**Concept:** {cr.get('concept_label') or cr.get('concept')}")
            for f in facts:
                val = _format_value(f.get("value_numeric"))
                lines.append(
                    f"- {f['bank_ticker']} {f['quarter']} {f['schedule']} {f['line_item']} "
                    f"({f.get('label') or ''}): {val}"
                )
            lines.append("")

    # Peer comparison
    if peer_results:
        pr = peer_results[0]
        lines.append(f"## Peer comparison — {pr.get('concept_label') or pr.get('concept')} ({pr.get('quarter')})\n")
        cohort = pr.get("cohort", {})
        if cohort.get("median") is not None:
            lines.append(
                f"Cohort n={cohort.get('count')}, median={_format_value(cohort['median'])}, "
                f"p90={_format_value(cohort.get('p90'))}"
            )
        for row in pr.get("rows", [])[:10]:
            lines.append(f"- #{row.get('rank')} {row['bank']}: {_format_value(row.get('value'))}")
        lines.append("")

    return Synthesis(
        answer_markdown="\n".join(lines).rstrip() + "\n",
        citations=citations,
        provider="extractive",
        model=None,
    )


def _shorten(text: str, limit: int) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "\u2026"


def _format_value(value: float | None) -> str:
    if value is None:
        return "n/a"
    if abs(value) >= 1_000_000:
        return f"${value/1000:.1f}M (thousands)"
    if abs(value) >= 1_000:
        return f"${value:,.0f} thousand"
    return f"{value:,.2f}"


# ---------------------------------------------------------------------------
# Anthropic synthesizer
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are a risk-analyst assistant. Answer the question using ONLY the
materials in the provided tool results. Every factual claim MUST end with a
citation marker like [1]. Never invent a citation. If the retrieved materials
are insufficient, say so plainly.

Structure (scale with the question — single-bank questions stay brief,
multi-bank or multi-topic comparisons can run longer with sub-sections):
- Lead answer with inline [n] citations.
- If Call Report facts are present, include a 'Quantitative' section.
- If peer_comparison is present, include a 'Peer context' section.
- For compare-style questions, give each bank its own sub-section, then a
  short 'Side-by-side' or 'Bottom line' summary.
- Flag any contradiction between narrative and numeric evidence as a
  'Disclosure drift' bullet.

Always finish your final sentence — do not stop mid-thought.
"""


def anthropic_synthesize(question: str, tool_results: list[dict[str, Any]]) -> Synthesis:
    import anthropic

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    # Build citation table from search hits so the model has stable [n] -> chunk ids.
    citations: list[Citation] = []
    ref_lines: list[str] = []
    for r in tool_results:
        if r.get("tool") != "search_documents":
            continue
        for i, h in enumerate(r["result"].get("hits", []), start=1 + len(citations)):
            citations.append(
                Citation(
                    marker=i,
                    chunk_id=h["chunk_id"],
                    bank=h["bank"],
                    doc_type=h["doc_type"],
                    fiscal_year=h.get("fiscal_year"),
                    fiscal_quarter=h.get("fiscal_quarter"),
                    section=h.get("section"),
                    char_start=h["char_start"],
                    char_end=h["char_end"],
                    text=h["text"],
                )
            )
            ref_lines.append(
                f"[{i}] {h['bank']} {h['doc_type']} {h.get('fiscal_year')}Q{h.get('fiscal_quarter')} "
                f"(chunk {h['chunk_id']}): {_shorten(h['text'], 600)}"
            )

    user_message = (
        f"Question: {question}\n\n"
        f"Search hits (use these for citations):\n" + "\n".join(ref_lines) + "\n\n"
        f"Other tool results (JSON):\n{json.dumps([r for r in tool_results if r.get('tool') != 'search_documents'], default=str, indent=2)}"
    )

    resp = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=4000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )
    answer = "".join(block.text for block in resp.content if block.type == "text")
    if getattr(resp, "stop_reason", None) == "max_tokens":
        answer += "\n\n_[response truncated — raise max_tokens]_"
    return Synthesis(
        answer_markdown=answer,
        citations=citations,
        provider="anthropic",
        model=settings.anthropic_model,
    )


def gemini_synthesize(question: str, tool_results: list[dict[str, Any]]) -> Synthesis:
    import urllib.request

    citations: list[Citation] = []
    ref_lines: list[str] = []
    for r in tool_results:
        if r.get("tool") != "search_documents":
            continue
        for i, h in enumerate(r["result"].get("hits", []), start=1 + len(citations)):
            citations.append(
                Citation(
                    marker=i,
                    chunk_id=h["chunk_id"],
                    bank=h["bank"],
                    doc_type=h["doc_type"],
                    fiscal_year=h.get("fiscal_year"),
                    fiscal_quarter=h.get("fiscal_quarter"),
                    section=h.get("section"),
                    char_start=h["char_start"],
                    char_end=h["char_end"],
                    text=h["text"],
                )
            )
            ref_lines.append(
                f"[{i}] {h['bank']} {h['doc_type']} {h.get('fiscal_year')}Q{h.get('fiscal_quarter')} "
                f"(chunk {h['chunk_id']}): {_shorten(h['text'], 600)}"
            )

    user_message = (
        f"Question: {question}\n\n"
        f"Search hits (use these for citations):\n" + "\n".join(ref_lines) + "\n\n"
        f"Other tool results (JSON):\n"
        + json.dumps(
            [r for r in tool_results if r.get("tool") != "search_documents"],
            default=str,
            indent=2,
        )
    )

    payload = json.dumps({
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": user_message}]}],
        "generationConfig": {"maxOutputTokens": 4000},
    }).encode()

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.gemini_model}:generateContent?key={settings.gemini_api_key}"
    )
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read())

    candidate = data["candidates"][0]
    answer = candidate["content"]["parts"][0]["text"]
    if candidate.get("finishReason") == "MAX_TOKENS":
        answer += "\n\n_[response truncated — raise maxOutputTokens]_"
    return Synthesis(answer_markdown=answer, citations=citations, provider="gemini", model=settings.gemini_model)


def synthesize(question: str, tool_results: list[dict[str, Any]]) -> Synthesis:
    import logging
    if settings.llm_provider == "gemini" and settings.gemini_api_key:
        try:
            return gemini_synthesize(question, tool_results)
        except Exception as e:
            logging.warning("Gemini synthesis failed (%s), falling back to extractive.", e)
            return extractive(question, tool_results)
    if settings.llm_provider == "anthropic" and settings.anthropic_api_key:
        try:
            return anthropic_synthesize(question, tool_results)
        except Exception as e:
            logging.warning("Anthropic synthesis failed (%s), falling back to extractive.", e)
            return extractive(question, tool_results)
    return extractive(question, tool_results)

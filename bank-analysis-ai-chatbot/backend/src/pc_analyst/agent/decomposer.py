"""Deterministic question decomposer.

The decomposer inspects the question for bank tickers, taxonomy
concepts, and time references, and builds a plan of tool calls. It's
deliberately rules-based so the system is predictable and testable
offline; an LLM-backed decomposer can slot in later as a drop-in
replacement (same ``Plan`` shape).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from ..banks import BANK_REGISTRY
from ..retrieval.taxonomy import Taxonomy, load_taxonomy


@dataclass
class ToolCall:
    tool: str
    arguments: dict[str, Any]
    rationale: str


@dataclass
class Plan:
    question: str
    banks: list[str] = field(default_factory=list)
    concepts: list[str] = field(default_factory=list)
    quarter: str | None = None
    calls: list[ToolCall] = field(default_factory=list)


TICKER_RE = re.compile(r"\b([A-Z]{1,5})\b")
QUARTER_RE = re.compile(r"\b(20\d{2})\s*Q([1-4])\b", re.IGNORECASE)
YEAR_RE = re.compile(r"\b(20\d{2})\b")

COMPARISON_KEYWORDS = (
    "compare", "compared", "comparison", "versus", "vs", "peer", "peers",
    "benchmark", "median", "across", "ranking", "rank",
)


def decompose(question: str, taxonomy: Taxonomy | None = None) -> Plan:
    tax = taxonomy or load_taxonomy()
    plan = Plan(question=question)

    # Banks
    known_tickers = set(BANK_REGISTRY.keys())
    ticker_hits: list[str] = []
    for tok in TICKER_RE.findall(question):
        if tok in known_tickers and tok not in ticker_hits:
            ticker_hits.append(tok)
    plan.banks = ticker_hits

    # Concepts
    plan.concepts = tax.match_concepts(question)

    # Quarter (supports "2024Q4" or "2024 Q4" or "Q4 2024")
    m = QUARTER_RE.search(question)
    if m:
        plan.quarter = f"{m.group(1)}Q{m.group(2)}"
    else:
        alt = re.search(r"\bQ([1-4])\s*(20\d{2})\b", question, re.IGNORECASE)
        if alt:
            plan.quarter = f"{alt.group(2)}Q{alt.group(1)}"

    # Plan tool calls --------------------------------------------------
    plan.calls.append(
        ToolCall(
            tool="search_documents",
            arguments={"query": question, "bank": plan.banks[0] if len(plan.banks) == 1 else None, "top_k": 8},
            rationale="Retrieve the most relevant narrative passages to answer the question.",
        )
    )

    if plan.concepts and plan.banks:
        plan.calls.append(
            ToolCall(
                tool="query_call_report",
                arguments={
                    "banks": plan.banks,
                    "concept": plan.concepts[0],
                    "quarters": [plan.quarter] if plan.quarter else None,
                },
                rationale="Pull matching Call Report line items for the concept to ground the narrative quantitatively.",
            )
        )

    # Peer comparison triggers
    wants_peer = any(k in question.lower() for k in COMPARISON_KEYWORDS) or (
        len(plan.banks) == 1 and plan.concepts
    )
    if wants_peer and plan.concepts:
        plan.calls.append(
            ToolCall(
                tool="compare_peers",
                arguments={
                    "concept": plan.concepts[0],
                    "quarter": plan.quarter or _default_quarter(),
                    "banks": plan.banks or None,
                },
                rationale="Surface peer benchmark so the bank's value has context.",
            )
        )

    return plan


def _default_quarter() -> str:
    # Cheap fallback — the most recent quarter we seed.
    return "2024Q4"

"""MCP-style tool layer.

Each tool is a pure function: arguments -> JSON-serializable result. The
agent loop and the MCP server both dispatch to the same ``TOOLS``
registry so they can't drift apart.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from .compare_peers import compare_peers
from .query_call_report import query_call_report
from .resolve_citation import resolve_citation
from .search_documents import search_documents


@dataclass
class ToolSpec:
    name: str
    description: str
    schema: dict[str, Any]
    handler: Callable[..., Any]


TOOLS: dict[str, ToolSpec] = {
    "search_documents": ToolSpec(
        name="search_documents",
        description=(
            "Search narrative filings (10-K, 10-Q, 8-K, prepared remarks) with hybrid "
            "BM25 + vector retrieval. Returns span-cited chunks."
        ),
        schema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Analyst question or topic"},
                "bank": {"type": "string", "description": "Optional ticker filter"},
                "doc_type": {
                    "type": "string",
                    "enum": ["10-K", "10-Q", "8-K", "prepared_remarks"],
                },
                "fiscal_year": {"type": "integer"},
                "fiscal_quarter": {"type": "integer"},
                "top_k": {"type": "integer", "default": 8},
            },
            "required": ["query"],
        },
        handler=search_documents,
    ),
    "query_call_report": ToolSpec(
        name="query_call_report",
        description=(
            "Pull FFIEC Call Report facts for one or more banks/quarters. Supports "
            "taxonomy concepts (e.g. 'nbfi_exposure') or raw MDRM mnemonics."
        ),
        schema={
            "type": "object",
            "properties": {
                "banks": {"type": "array", "items": {"type": "string"}},
                "quarters": {"type": "array", "items": {"type": "string"}},
                "concept": {
                    "type": "string",
                    "description": "Taxonomy concept key (e.g. 'nbfi_exposure')",
                },
                "mnemonics": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["banks"],
        },
        handler=query_call_report,
    ),
    "compare_peers": ToolSpec(
        name="compare_peers",
        description="Peer benchmark of a concept / metric across banks for a quarter.",
        schema={
            "type": "object",
            "properties": {
                "concept": {"type": "string"},
                "banks": {"type": "array", "items": {"type": "string"}},
                "quarter": {"type": "string"},
            },
            "required": ["concept", "quarter"],
        },
        handler=compare_peers,
    ),
    "resolve_citation": ToolSpec(
        name="resolve_citation",
        description="Return full source context and highlight offsets for a chunk id.",
        schema={
            "type": "object",
            "properties": {"chunk_id": {"type": "integer"}},
            "required": ["chunk_id"],
        },
        handler=resolve_citation,
    ),
}


__all__ = ["TOOLS", "ToolSpec", "search_documents", "query_call_report", "compare_peers", "resolve_citation"]

"""Sanity tests for taxonomy loading + deterministic decomposer."""

from __future__ import annotations

from pc_analyst.agent.decomposer import decompose
from pc_analyst.retrieval.taxonomy import load_taxonomy


def test_taxonomy_loads():
    tax = load_taxonomy()
    assert "nbfi_exposure" in tax.concepts
    assert any(li.schedule == "RC-C" for li in tax.concepts["nbfi_exposure"].call_report_lines)


def test_taxonomy_matches_synonyms():
    tax = load_taxonomy()
    hits = tax.match_concepts("exposure to nondepository financial institutions")
    assert "nbfi_exposure" in hits


def test_decomposer_extracts_bank_and_concept():
    plan = decompose("How much of DFS's investments are in private credit?")
    assert "DFS" in plan.banks
    assert "direct_lending" in plan.concepts or "nbfi_exposure" in plan.concepts
    tools = [c.tool for c in plan.calls]
    assert "search_documents" in tools
    assert "query_call_report" in tools  # triggered because bank + concept present


def test_decomposer_peer_comparison_trigger():
    plan = decompose("Compare NBFI exposure across FHN, FLG, and DFS in 2024Q4")
    assert set(["FHN", "FLG", "DFS"]).issubset(set(plan.banks))
    assert plan.quarter == "2024Q4"
    tools = [c.tool for c in plan.calls]
    assert "compare_peers" in tools

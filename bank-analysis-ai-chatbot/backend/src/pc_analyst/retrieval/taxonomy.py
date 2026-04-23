"""Load and query the private-credit taxonomy YAML."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

import yaml

from ..config import PACKAGE_ROOT


TAXONOMY_PATH = PACKAGE_ROOT / "taxonomy" / "private_credit.yaml"


@dataclass
class LineItem:
    schedule: str
    line_item: str
    mnemonic: str | None
    label: str | None


@dataclass
class Concept:
    key: str
    label: str
    synonyms: list[str]
    call_report_lines: list[LineItem] = field(default_factory=list)
    notes: str | None = None


@dataclass
class DriftRule:
    concept: str
    up_keywords: list[str]
    down_keywords: list[str]


@dataclass
class Taxonomy:
    version: int
    concepts: dict[str, Concept]
    drift_rules: list[DriftRule]

    # ------------------------------------------------------------------
    def all_terms(self) -> list[str]:
        terms: set[str] = set()
        for c in self.concepts.values():
            terms.add(c.label.lower())
            for s in c.synonyms:
                terms.add(s.lower())
        return sorted(terms)

    def match_concepts(self, text: str) -> list[str]:
        """Return concept keys whose label/synonyms appear in *text*."""
        lower = text.lower()
        hits: list[str] = []
        for key, concept in self.concepts.items():
            probes = [concept.label.lower(), *[s.lower() for s in concept.synonyms]]
            if any(_word_in(lower, p) for p in probes):
                hits.append(key)
        return hits

    def expand_query(self, query: str) -> str:
        """Append synonyms of any concept present in the query (for BM25)."""
        hits = self.match_concepts(query)
        expansions: list[str] = []
        for key in hits:
            concept = self.concepts[key]
            expansions.extend(concept.synonyms)
        if not expansions:
            return query
        return query + " " + " ".join(dict.fromkeys(expansions))

    def concept_line_items(self, concept_key: str) -> list[LineItem]:
        return self.concepts[concept_key].call_report_lines if concept_key in self.concepts else []

    def drift_rule(self, concept_key: str) -> DriftRule | None:
        for rule in self.drift_rules:
            if rule.concept == concept_key:
                return rule
        return None


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

_WORD_SPLIT = re.compile(r"\b")


def _word_in(haystack: str, needle: str) -> bool:
    # Whole-phrase substring match; avoids matching inside longer words when
    # the needle is a single token.
    if " " in needle:
        return needle in haystack
    pattern = rf"\b{re.escape(needle)}\b"
    return re.search(pattern, haystack) is not None


def load_taxonomy(path: Path | str = TAXONOMY_PATH) -> Taxonomy:
    raw = yaml.safe_load(Path(path).read_text())
    concepts: dict[str, Concept] = {}
    for key, cfg in raw.get("concepts", {}).items():
        items = [
            LineItem(
                schedule=li["schedule"],
                line_item=str(li["line_item"]),
                mnemonic=li.get("mnemonic"),
                label=li.get("label"),
            )
            for li in cfg.get("call_report_lines", []) or []
        ]
        concepts[key] = Concept(
            key=key,
            label=cfg.get("label", key),
            synonyms=list(cfg.get("synonyms", []) or []),
            call_report_lines=items,
            notes=cfg.get("notes"),
        )
    rules = [
        DriftRule(
            concept=r["concept"],
            up_keywords=list(r.get("up_keywords", []) or []),
            down_keywords=list(r.get("down_keywords", []) or []),
        )
        for r in raw.get("drift_rules", []) or []
    ]
    return Taxonomy(version=int(raw.get("version", 1)), concepts=concepts, drift_rules=rules)


def iter_all_synonyms(tax: Taxonomy) -> Iterable[tuple[str, str]]:
    """Yield (concept_key, term) pairs for every label and synonym."""
    for key, concept in tax.concepts.items():
        yield key, concept.label
        for s in concept.synonyms:
            yield key, s

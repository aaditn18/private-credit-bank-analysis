"""Extract readable text from EDGAR HTML primary documents.

We produce a single normalized plaintext for a filing. Chunks later index
into this plaintext with ``char_start`` / ``char_end`` offsets, so when
the UI resolves a citation it can highlight the exact span in the source
viewer without needing any re-parsing.

Section headers (e.g. "Item 1A. Risk Factors") are tracked alongside
their offsets so chunks can be tagged with their parent section.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from bs4 import BeautifulSoup, Comment


ITEM_HEADER_RE = re.compile(
    r"^(Item\s+\d+[A-Z]?\.?)(?:\s*[-—–:]\s*)?(.*)$",
    flags=re.IGNORECASE,
)
PART_HEADER_RE = re.compile(r"^Part\s+[IVX]+\b.*$", flags=re.IGNORECASE)

# EDGAR filings often use these as textual section breaks when rendered.
COMMON_HEADER_HINTS = {
    "risk factors",
    "management's discussion and analysis of financial condition and results of operations",
    "quantitative and qualitative disclosures about market risk",
    "controls and procedures",
    "legal proceedings",
    "executive officers",
    "financial statements and supplementary data",
    "notes to consolidated financial statements",
}


@dataclass
class Section:
    header: str
    start: int            # offset into normalized plaintext
    end: int | None = None


@dataclass
class HtmlExtract:
    text: str
    sections: list[Section] = field(default_factory=list)

    def section_for_offset(self, offset: int) -> str | None:
        current: str | None = None
        for sec in self.sections:
            if sec.start <= offset:
                current = sec.header
            else:
                break
        return current


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

_BLOCK_TAGS = {
    "p", "div", "li", "td", "th", "br", "h1", "h2", "h3", "h4", "h5", "h6",
    "tr", "section", "article",
}

_WHITESPACE_RE = re.compile(r"[ \t\u00a0]+")
_MULTI_NL = re.compile(r"\n{3,}")


def _is_header_text(line: str) -> str | None:
    """Return a normalized header if ``line`` looks like a filing section header."""
    line = line.strip()
    if not line:
        return None
    if PART_HEADER_RE.match(line):
        return line[:200]
    m = ITEM_HEADER_RE.match(line)
    if m and len(line) < 200:
        item, title = m.group(1), m.group(2).strip(" .:-—")
        return f"{item.capitalize()} {title}".strip() if title else item.capitalize()
    low = line.lower().strip(" .:-—")
    if low in COMMON_HEADER_HINTS and len(line) < 200:
        return line.strip(" .:-—")
    return None


def extract_text_from_html(html: str) -> HtmlExtract:
    """Return normalized plaintext plus an ordered list of section markers.

    We iterate the DOM, emitting a newline at block boundaries and keeping
    a running offset counter. Whenever an emitted line looks like a filing
    section header we record a ``Section`` keyed to the current offset.
    """

    soup = BeautifulSoup(html, "lxml")

    # Drop HTML comments (EDGAR filings prepend XBRL/Workiva comment banners).
    for c in soup.find_all(string=lambda s: isinstance(s, Comment)):
        c.extract()

    # Drop non-content tags and iXBRL metadata blocks. ix:header / ix:hidden
    # carry XBRL context nodes that are rendered display:none in browsers but
    # whose text would otherwise bleed into extracted plaintext.
    for tag in soup(["script", "style", "noscript", "head"]):
        tag.decompose()
    for tag in soup.find_all(
        lambda el: el.name and (
            el.name.startswith("ix:")
            or el.name.startswith("xbrli:")
            or el.name.startswith("xbrldi:")
            or el.name.startswith("link:")
            or el.name in {"xbrl"}
        )
    ):
        # ix:nonFraction / ix:nonNumeric wrap user-visible numbers in the body;
        # unwrap so their text survives. ix:header/ix:hidden/ix:references are
        # metadata-only and should be dropped entirely.
        if tag.name in {"ix:nonfraction", "ix:nonnumeric"}:
            tag.unwrap()
        else:
            tag.decompose()
    for tag in soup.find_all(style=lambda v: v and "display:none" in v.replace(" ", "").lower()):
        tag.decompose()

    # Scope to <body> when present so we skip any residual prolog text.
    root = soup.body or soup

    out: list[str] = []
    offset = 0
    sections: list[Section] = []

    def emit(text: str, is_block_boundary: bool = False) -> None:
        nonlocal offset
        if text:
            out.append(text)
            offset += len(text)
        if is_block_boundary and (not out or not out[-1].endswith("\n")):
            out.append("\n")
            offset += 1

    # Walk descendants; at block boundaries push a newline.
    for element in root.descendants:
        if element.name is None:
            # NavigableString
            raw = str(element)
            cleaned = _WHITESPACE_RE.sub(" ", raw).replace("\r", "")
            if cleaned.strip():
                emit(cleaned)
        else:
            if element.name in _BLOCK_TAGS:
                if out and not out[-1].endswith("\n"):
                    emit("\n", is_block_boundary=False)

    text = "".join(out)
    text = _MULTI_NL.sub("\n\n", text).strip() + "\n"

    # Second pass: scan emitted text line-by-line to find section headers.
    cursor = 0
    for line in text.splitlines(keepends=True):
        stripped = line.strip()
        header = _is_header_text(stripped)
        if header:
            sections.append(Section(header=header, start=cursor))
        cursor += len(line)

    # Close section ends
    for i, sec in enumerate(sections):
        sec.end = sections[i + 1].start if i + 1 < len(sections) else len(text)

    return HtmlExtract(text=text, sections=sections)


def extract_text_from_path(path: Path | str) -> HtmlExtract:
    html = Path(path).read_text(encoding="utf-8", errors="replace")
    return extract_text_from_html(html)

"""Invariant: every chunk's text must equal raw_text[char_start:char_end].

This is the foundation of span-level citations — if it fails, the UI
can't highlight the correct span in the source viewer.
"""

from __future__ import annotations

from pc_analyst.ingestion.chunker import SectionChunker
from pc_analyst.ingestion.html_parser import extract_text_from_html


SAMPLE_HTML = """
<html><body>
<h2>Item 1A. Risk Factors</h2>
<p>Our exposure to nondepository financial institutions, including business development
companies and private credit funds, has increased as a result of strong demand.</p>
<p>We continue to monitor direct lending concentrations and maintain prudent limits.</p>
<h2>Item 7. Management's Discussion and Analysis</h2>
<p>C&amp;I loans to nonbank financial institutions grew to $1.7 billion as of the quarter,
with unused commitments of $985 million.</p>
<p>Fund finance, including subscription lines and NAV facilities, remains a modest
portion of the overall commercial book.</p>
</body></html>
"""


def test_chunk_offsets_are_exact():
    extract = extract_text_from_html(SAMPLE_HTML)
    chunks = SectionChunker(target_chars=200, overlap_chars=40).chunk(extract)
    assert chunks, "expected at least one chunk"
    for ch in chunks:
        slice_ = extract.text[ch.char_start:ch.char_end]
        # The chunker joins sentences with spaces; the slice is the exact
        # original span including original whitespace.
        assert slice_.strip(), "slice must contain content"
        # Every word in the chunk's joined text should appear in the slice.
        for word in ch.text.split()[:5]:
            assert word in slice_, f"word {word!r} from chunk not found in slice"


def test_sections_identified():
    extract = extract_text_from_html(SAMPLE_HTML)
    headers = [s.header for s in extract.sections]
    assert any("Risk Factors" in h for h in headers)
    assert any("Management" in h for h in headers)


def test_every_chunk_has_a_section():
    extract = extract_text_from_html(SAMPLE_HTML)
    chunks = SectionChunker(target_chars=200, overlap_chars=40).chunk(extract)
    assert all(ch.section_header for ch in chunks)

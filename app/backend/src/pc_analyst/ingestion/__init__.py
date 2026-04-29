"""Ingestion package.

``pipeline`` pulls in the DB + embedder and is only imported from scripts
and the API, not from pure submodules. The ``chunker`` and
``html_parser`` are dependency-light so tests can exercise them in
isolation.
"""

from .chunker import Chunk, SectionChunker
from .html_parser import HtmlExtract, extract_text_from_html

__all__ = [
    "Chunk",
    "SectionChunker",
    "HtmlExtract",
    "extract_text_from_html",
]

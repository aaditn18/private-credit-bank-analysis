"""Prepared-remarks fetcher (bank IR sites).

We deliberately keep this minimal: hit a configured URL, extract visible
text, normalize it, and hand it to the generic ingestion pipeline. Real
IR sites vary wildly in structure — the expand_banks script wires in
per-bank selectors when needed.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from ..config import settings
from .html_parser import HtmlExtract, extract_text_from_html


@dataclass
class PreparedRemarks:
    ticker: str
    fiscal_year: int
    fiscal_quarter: int
    source_url: str
    html: str


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=6))
def fetch_remarks(url: str) -> str:
    with httpx.Client(headers={"User-Agent": settings.sec_user_agent}) as client:
        resp = client.get(url, timeout=30)
        resp.raise_for_status()
        return resp.text


def load_local_remarks(path: Path) -> HtmlExtract:
    return extract_text_from_html(path.read_text(encoding="utf-8", errors="replace"))

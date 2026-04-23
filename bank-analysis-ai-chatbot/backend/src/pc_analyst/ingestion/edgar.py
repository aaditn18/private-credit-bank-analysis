"""SEC EDGAR integration.

Two modes:

1. **Local mode** (default for the scaffold): read already-downloaded
   filings from a directory layout like::

       <root>/<TICKER>/<DOC_TYPE>/<TICKER>_<DOC_TYPE>_<YEAR>_Q<N>/primary-document.html

   This matches the DFS/FHN/FLG folders shipped with this repo.

2. **Remote mode**: fetch filings directly from EDGAR via the submissions
   JSON + primary document URL. Used by the ``expand_banks`` script.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from ..config import settings


FOLDER_RE = re.compile(
    r"^(?P<ticker>[A-Z]+)_(?P<doc>10-K|10-Q|8-K)_(?P<year>\d{4})_Q(?P<q>\d)(?:_\d+)?$"
)


@dataclass
class LocalFiling:
    ticker: str
    doc_type: str
    fiscal_year: int
    fiscal_quarter: int
    source_path: Path


def discover_local_filings(root: Path, tickers: list[str] | None = None) -> list[LocalFiling]:
    """Walk ``<root>/<TICKER>/<DOC_TYPE>/...`` and return discovered filings."""
    filings: list[LocalFiling] = []
    if not root.exists():
        return filings
    for bank_dir in sorted(root.iterdir()):
        if not bank_dir.is_dir():
            continue
        ticker = bank_dir.name
        if tickers and ticker not in tickers:
            continue
        for doc_dir in sorted(bank_dir.iterdir()):
            if not doc_dir.is_dir():
                continue
            if doc_dir.name not in {"10-K", "10-Q", "8-K"}:
                continue
            for filing_dir in sorted(doc_dir.iterdir()):
                if not filing_dir.is_dir():
                    continue
                m = FOLDER_RE.match(filing_dir.name)
                if not m:
                    continue
                primary = filing_dir / "primary-document.html"
                if not primary.exists():
                    continue
                filings.append(
                    LocalFiling(
                        ticker=m["ticker"],
                        doc_type=m["doc"],
                        fiscal_year=int(m["year"]),
                        fiscal_quarter=int(m["q"]),
                        source_path=primary,
                    )
                )
    return filings


# ---------------------------------------------------------------------------
# Remote EDGAR fetcher (used by expand_banks)
# ---------------------------------------------------------------------------

EDGAR_HOST = "https://data.sec.gov"


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
def _get(url: str, client: httpx.Client) -> httpx.Response:
    resp = client.get(url, timeout=30)
    resp.raise_for_status()
    return resp


def fetch_submissions(cik: str) -> dict:
    """Fetch /submissions/CIK##########.json for a given CIK (10 digit, zero-padded)."""
    cik_z = cik.zfill(10)
    url = f"{EDGAR_HOST}/submissions/CIK{cik_z}.json"
    with httpx.Client(headers={"User-Agent": settings.sec_user_agent}) as client:
        return _get(url, client).json()


def fetch_primary_document(cik: str, accession: str, primary_doc: str) -> str:
    """Fetch the primary filing document as HTML text."""
    cik_z = cik.lstrip("0")
    accession_nodash = accession.replace("-", "")
    url = f"https://www.sec.gov/Archives/edgar/data/{cik_z}/{accession_nodash}/{primary_doc}"
    with httpx.Client(headers={"User-Agent": settings.sec_user_agent}) as client:
        return _get(url, client).text


def list_recent_filings(cik: str, forms: Iterable[str], limit: int = 8) -> list[dict]:
    """Return the most recent filings of the requested forms.

    Each dict contains: ``form``, ``filingDate``, ``accessionNumber``, ``primaryDocument``.
    """
    submissions = fetch_submissions(cik)
    recent = submissions.get("filings", {}).get("recent", {})
    keys = ["form", "filingDate", "accessionNumber", "primaryDocument", "reportDate"]
    rows = list(
        zip(
            recent.get("form", []),
            recent.get("filingDate", []),
            recent.get("accessionNumber", []),
            recent.get("primaryDocument", []),
            recent.get("reportDate", []),
            strict=False,
        )
    )
    forms_set = set(forms)
    out = []
    for form, filing_date, accession, primary, report_date in rows:
        if form in forms_set:
            out.append(
                {
                    "form": form,
                    "filingDate": filing_date,
                    "reportDate": report_date,
                    "accessionNumber": accession,
                    "primaryDocument": primary,
                }
            )
            if len(out) >= limit:
                break
    return out

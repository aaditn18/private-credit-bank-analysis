"""
Download the two most recent 10-K filings for each bank from SEC EDGAR.

Usage:
    python download_10k_filings.py

Creates:
    banks/
      {TICKER}/
        10-K/
          {accession_number}/
            primary-document.html
"""

import os
import json
import time
import urllib.request
import urllib.error
from pathlib import Path

HEADERS = {
    "User-Agent": "BUFN403-Research aaditnilay@example.com",
    "Accept": "application/json",
}

BANKS = {
    "PNFP": "Pinnacle Financial Partners",
    "CFR":  "Cullen/Frost Bankers",
    "BOKF": "BOK Financial Corp",
    "FNB":  "F.N.B. Corporation",
    "SOFI": "SoFi Technologies",
    "ASB":  "Associated Banc-Corp",
    "SF":   "Stifel Financial Corp",
    "PB":   "Prosperity Bancshares",
    "BKU":  "BankUnited Inc",
}

OUTPUT_ROOT = Path(__file__).parent / "banks"


def fetch_json(url: str) -> dict:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        return resp.read().decode("utf-8", errors="replace")


def resolve_cik(ticker: str) -> str:
    """Look up the 10-digit zero-padded CIK for a ticker."""
    url = "https://www.sec.gov/files/company_tickers.json"
    data = fetch_json(url)
    for entry in data.values():
        if entry["ticker"].upper() == ticker.upper():
            return str(entry["cik_str"]).zfill(10)
    raise ValueError(f"Ticker {ticker} not found in SEC company_tickers.json")


def get_10k_filings(cik: str, count: int = 2) -> list[dict]:
    """Return the `count` most recent 10-K filing metadata entries."""
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    data = fetch_json(url)

    recent = data.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    accessions = recent.get("accessionNumber", [])
    dates = recent.get("filingDate", [])
    primary_docs = recent.get("primaryDocument", [])

    filings = []
    for i, form in enumerate(forms):
        if form == "10-K":
            filings.append({
                "accession": accessions[i],
                "date": dates[i],
                "primary_doc": primary_docs[i],
            })
        if len(filings) >= count:
            break

    return filings


def download_filing(cik: str, filing: dict, dest_dir: Path) -> None:
    """Download the primary document of a filing."""
    accession_no_dash = filing["accession"].replace("-", "")
    primary_doc = filing["primary_doc"]
    url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession_no_dash}/{primary_doc}"

    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / "primary-document.html"

    if dest_path.exists():
        print(f"    Already downloaded: {dest_path}")
        return

    print(f"    Downloading: {url}")
    html = fetch_text(url)
    dest_path.write_text(html, encoding="utf-8")
    print(f"    Saved: {dest_path} ({len(html):,} chars)")


def main():
    cik_cache = {}

    for ticker, name in BANKS.items():
        print(f"\n{'='*60}")
        print(f"  {ticker} — {name}")
        print(f"{'='*60}")

        try:
            if ticker not in cik_cache:
                print(f"  Looking up CIK for {ticker}...")
                cik = resolve_cik(ticker)
                cik_cache[ticker] = cik
                time.sleep(0.3)
            else:
                cik = cik_cache[ticker]

            print(f"  CIK: {cik}")

            filings = get_10k_filings(cik, count=2)
            if not filings:
                print(f"  WARNING: No 10-K filings found!")
                continue

            print(f"  Found {len(filings)} 10-K filing(s)")

            for f in filings:
                folder_name = f["date"]
                dest_dir = OUTPUT_ROOT / ticker / "10-K" / folder_name
                print(f"  Filing: {f['date']} (accession: {f['accession']})")
                download_filing(cik, f, dest_dir)
                time.sleep(0.5)

        except Exception as e:
            print(f"  ERROR: {e}")

    print(f"\n\nDone! Data saved to: {OUTPUT_ROOT.resolve()}")


if __name__ == "__main__":
    main()

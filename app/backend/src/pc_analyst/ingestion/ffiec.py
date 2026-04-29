"""FFIEC Call Report ingestion.

The FFIEC CDR exposes a REST API (and legacy SOAP) via
``ffiec-data-connect``. To keep the scaffold runnable without FFIEC
credentials we support three paths:

- **API mode**: when ``FFIEC_USERNAME`` and ``FFIEC_TOKEN`` are set, pull
  specific MDRM mnemonics for a list of RSSD ids and quarters.
- **CSV bulk mode**: read already-downloaded FFIEC bulk CSVs from a
  directory.
- **Seed mode**: read ``data/seed/call_report_seed.json`` so the demo
  works offline.
"""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from ..config import REPO_ROOT, settings


SEED_PATH = REPO_ROOT / "data" / "seed" / "call_report_seed.json"


@dataclass
class CallReportFact:
    rssd_id: str
    bank_ticker: str | None
    quarter: str
    schedule: str
    line_item: str
    label: str | None
    value_numeric: float | None
    value_text: str | None
    as_of_date: str | None = None
    source_url: str | None = None


def load_seed_facts(path: Path = SEED_PATH) -> list[CallReportFact]:
    if not path.exists():
        return []
    raw = json.loads(path.read_text())
    return [CallReportFact(**row) for row in raw]


# ---------------------------------------------------------------------------
# CSV bulk reader (FFIEC "Call Reports -- Single Period" downloads)
# ---------------------------------------------------------------------------

def load_bulk_csv(csv_path: Path, quarter: str, ticker_by_rssd: dict[str, str]) -> list[CallReportFact]:
    facts: list[CallReportFact] = []
    with csv_path.open() as f:
        reader = csv.DictReader(f)
        for row in reader:
            rssd = row.get("IDRSSD") or row.get("rssd_id")
            if not rssd:
                continue
            for mnemonic, value in row.items():
                if not mnemonic or mnemonic in {"IDRSSD", "rssd_id", "Name"}:
                    continue
                try:
                    numeric: float | None = float(value) if value not in {"", None} else None
                except ValueError:
                    numeric = None
                facts.append(
                    CallReportFact(
                        rssd_id=rssd,
                        bank_ticker=ticker_by_rssd.get(rssd),
                        quarter=quarter,
                        schedule="BULK",
                        line_item=mnemonic,
                        label=mnemonic,
                        value_numeric=numeric,
                        value_text=None if numeric is not None else str(value),
                    )
                )
    return facts


# ---------------------------------------------------------------------------
# Live API (stub; activated when ffiec-data-connect is installed + creds)
# ---------------------------------------------------------------------------

def fetch_api_facts(
    rssd_ids: Iterable[str],
    quarters: Iterable[str],
    mnemonics: Iterable[str],
) -> list[CallReportFact]:
    if not (settings.ffiec_username and settings.ffiec_token):
        raise RuntimeError(
            "FFIEC_USERNAME / FFIEC_TOKEN not set; use seed mode or bulk CSV instead."
        )
    try:
        import ffiec_data_connect as fdc  # type: ignore
    except ImportError as e:  # pragma: no cover
        raise RuntimeError("pip install ffiec-data-connect to use API mode") from e

    creds = fdc.WebserviceCredentials(username=settings.ffiec_username, password=settings.ffiec_token)
    session = fdc.create_session(creds)

    out: list[CallReportFact] = []
    for rssd in rssd_ids:
        for quarter in quarters:
            data = fdc.collect_data(
                session=session,
                reporting_period=quarter,
                rssd_id=rssd,
                series="call",
            )
            for row in data:
                if row.get("mdrm") not in mnemonics:
                    continue
                out.append(
                    CallReportFact(
                        rssd_id=rssd,
                        bank_ticker=None,
                        quarter=quarter,
                        schedule=row.get("schedule", "UNKNOWN"),
                        line_item=row.get("mdrm"),
                        label=row.get("description"),
                        value_numeric=row.get("int_data"),
                        value_text=row.get("text_data"),
                        as_of_date=quarter,
                    )
                )
    return out

#!/usr/bin/env python3
"""
Keyword-match private credit pipeline: read 10-Ks from ../banks/, run Phase 1 + 2 + presentation.

Run from any working directory:
  python /path/to/BUFN403/Keyword_match_method/run_pipeline.py

Requires: pandas, google-genai
Environment: GEMINI_API_KEY in BUFN403/.env (python-dotenv) or in the shell.
              Optional: GEMINI_API_KEYS=key1,key2,... for rotation.

Outputs (default): Keyword_match_method/output/
  - phase1_findings.csv
  - findings_with_phase2.csv
  - Presentation_Findings.md
  - Presentation_Findings.json
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

from pipeline_core import (
    SYSTEM_PROMPT_PHASE1,
    SYSTEM_PROMPT_PHASE2,
    build_dossier_phase1,
    build_dossier_phase2,
    call_gemini_json,
    write_presentation_files,
    _api_key_cycle,
)

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
BANKS_ROOT = REPO_ROOT / "sec-edgar-filings"
OUTPUT_DIR = SCRIPT_DIR / "output"

BANKS = {
    "PNFP": {"name": "Pinnacle Financial Partners"},
    "CFR": {"name": "Cullen/Frost Bankers"},
    "BOKF": {"name": "BOK Financial Corp."},
    "FNB": {"name": "F.N.B. Corporation"},
    "SOFI": {"name": "SoFi Technologies"},
    "ASB": {"name": "Associated Banc-Corp"},
    "SF": {"name": "Stifel Financial Corp."},
    "PB": {"name": "Prosperity Bancshares"},
    "BKU": {"name": "BankUnited, Inc."},
}

TICKERS_TO_RUN = list(BANKS.keys())

PHASE1_CSV = "phase1_findings.csv"
PHASE2_CSV = "findings_with_phase2.csv"
PRESENTATION_MD = "Presentation_Findings.md"
PRESENTATION_JSON = "Presentation_Findings.json"


def _phase1_user_prompt(bank_name: str, dossier: str) -> str:
    return f"Bank: {bank_name}\n\nDossier:\n{dossier}"


def run_phase1(
    banks_root: Path,
    output_dir: Path,
    tickers: list[str],
    *,
    banks_dict: dict,
) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    out_csv = output_dir / PHASE1_CSV
    api_cycle = _api_key_cycle()

    results = []
    n = len(tickers)
    for i, ticker in enumerate(tickers, start=1):
        if ticker not in banks_dict:
            print(f"[SKIP] Unknown ticker: {ticker}")
            continue
        meta = banks_dict[ticker]
        bank_name = meta["name"]
        print(f"\n[{i}/{n}] Phase 1 — {bank_name} ({ticker})")

        dossier = build_dossier_phase1(
            ticker,
            bank_name,
            banks_root=banks_root,
            script_dir=SCRIPT_DIR,
            repo_root=REPO_ROOT,
        )

        if len(dossier) < 150:
            print("  -> No targeted keyword mentions in dossier sources. Skipping LLM.")
            results.append(
                {
                    "bank_name": bank_name,
                    "ticker": ticker,
                    "mention_frequency": "None",
                    "sentiment": "Neutral",
                }
            )
            continue

        try:
            user = _phase1_user_prompt(bank_name, dossier)
            result_json = call_gemini_json(SYSTEM_PROMPT_PHASE1, user, api_cycle)
            result_json["ticker"] = ticker
            if "bank_name" not in result_json:
                result_json["bank_name"] = bank_name
            results.append(result_json)
            print(f"  -> Success. Sentiment: {result_json.get('sentiment')}")
        except Exception as e:
            print(f"  -> ERROR: {type(e).__name__}: {e}")
            results.append({"bank_name": bank_name, "ticker": ticker, "error": str(e)})

    if not results:
        print("No results to write.")
        return out_csv

    df = pd.json_normalize(results)
    for col in ["key_themes", "notable_quotes"]:
        if col in df.columns:
            df[col] = df[col].apply(lambda x: " | ".join(x) if isinstance(x, list) else x)

    cols = ["bank_name", "ticker"] + [c for c in df.columns if c not in ("bank_name", "ticker")]
    df = df[[c for c in cols if c in df.columns]]
    df.to_csv(out_csv, index=False)
    print(f"\nPhase 1 saved: {out_csv}")
    return out_csv


def run_phase2(
    banks_root: Path,
    output_dir: Path,
    phase1_csv: Path,
) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    out_csv = output_dir / PHASE2_CSV
    api_cycle = _api_key_cycle()

    df = pd.read_csv(phase1_csv)
    for col in ["pullback_mentions", "named_competitors", "risk_focus_analysis"]:
        if col not in df.columns:
            df[col] = ""

    n = len(df)
    for index, row in df.iterrows():
        bank_name = row["bank_name"]
        ticker = row["ticker"]
        print(f"\n[{index + 1}/{n}] Phase 2 — {bank_name} ({ticker})")

        dossier = build_dossier_phase2(
            ticker,
            bank_name,
            banks_root=banks_root,
            script_dir=SCRIPT_DIR,
            repo_root=REPO_ROOT,
        )

        if len(dossier) < 150:
            print("    -> Insufficient dossier text.")
            df.at[index, "pullback_mentions"] = "Insufficient data"
            df.at[index, "named_competitors"] = "Insufficient data"
            df.at[index, "risk_focus_analysis"] = "Insufficient data"
            continue

        try:
            user = _phase1_user_prompt(bank_name, dossier)
            result_json = call_gemini_json(SYSTEM_PROMPT_PHASE2, user, api_cycle)
            df.at[index, "pullback_mentions"] = result_json.get("pullback_mentions", "N/A")
            df.at[index, "named_competitors"] = result_json.get("named_competitors", "N/A")
            df.at[index, "risk_focus_analysis"] = result_json.get("risk_focus_analysis", "N/A")
            print("    -> Phase 2 success.")
        except Exception as e:
            print(f"    -> ERROR: {e}")

    df.to_csv(out_csv, index=False)
    print(f"\nPhase 2 saved: {out_csv}")
    return out_csv


def run_presentation(phase2_csv: Path, output_dir: Path) -> None:
    df = pd.read_csv(phase2_csv)
    md_path = output_dir / PRESENTATION_MD
    json_path = output_dir / PRESENTATION_JSON
    write_presentation_files(df, md_path, json_path)
    print(f"Presentation: {md_path}")
    print(f"Presentation: {json_path}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Keyword-match pipeline from sec-edgar-filings/ 10-Ks.")
    parser.add_argument(
        "--banks-root",
        type=Path,
        default=BANKS_ROOT,
        help=f"Root folder with ticker/10-K/... (default: {BANKS_ROOT})",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=OUTPUT_DIR,
        help=f"Output directory (default: {OUTPUT_DIR})",
    )
    parser.add_argument(
        "--tickers",
        type=str,
        default=",".join(TICKERS_TO_RUN),
        help="Comma-separated tickers (default: all nine BUFN banks).",
    )
    parser.add_argument("--phase1-only", action="store_true", help="Only run Phase 1.")
    parser.add_argument("--skip-phase2", action="store_true", help="Skip Phase 2.")
    parser.add_argument("--skip-presentation", action="store_true", help="Skip MD/JSON export.")
    args = parser.parse_args()

    banks_root = args.banks_root.resolve()
    output_dir = args.output_dir.resolve()

    if not banks_root.is_dir():
        print(f"Error: banks root not found: {banks_root}", file=sys.stderr)
        return 1

    tickers = [t.strip().upper() for t in args.tickers.split(",") if t.strip()]

    try:
        _api_key_cycle()
    except EnvironmentError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    phase1_path = run_phase1(banks_root, output_dir, tickers, banks_dict=BANKS)

    if args.phase1_only or args.skip_phase2:
        if not args.skip_presentation:
            df = pd.read_csv(phase1_path)
            for col in ["pullback_mentions", "named_competitors", "risk_focus_analysis"]:
                if col not in df.columns:
                    df[col] = "N/A"
            stub = output_dir / PHASE2_CSV
            df.to_csv(stub, index=False)
            run_presentation(stub, output_dir)
        print("Done (phase 1 only or Phase 2 skipped).")
        return 0

    phase2_path = run_phase2(banks_root, output_dir, phase1_path)

    if not args.skip_presentation:
        run_presentation(phase2_path, output_dir)

    print("\nAll steps complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

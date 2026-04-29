"""
Shared helpers for keyword-based private-credit dossiers (Phase 1 & Phase 2).
Used by run_pipeline.py and optionally by legacy primary_analysis / secondary_analysis.
"""

from __future__ import annotations

import itertools
import json
import os
import re
import time
from pathlib import Path
from typing import Iterator

# Load BUFN403/.env (GEMINI_API_KEY) before any os.environ reads
try:
    from dotenv import load_dotenv

    _BUFN_ENV = Path(__file__).resolve().parent.parent / ".env"
    if _BUFN_ENV.is_file():
        load_dotenv(_BUFN_ENV, override=False)
except ImportError:
    pass

import pandas as pd
from google import genai

# --- Phase 1 (primary_analysis keywords & prompt) ---
TARGET_KEYWORDS_PHASE1 = [
    "private credit",
    "direct lending",
    "alternative credit",
    "middle market loan",
    "middle-market loan",
    "sponsor finance",
    "collateralized loan",
    "CLO",
    "non-bank lender",
    "shadow banking",
    "leveraged finance",
    "syndicated loan",
    "syndicated corporate loan",
]

SYSTEM_PROMPT_PHASE1 = """
You are a lead financial sector analyst. You will be provided with a targeted dossier of a bank's recent SEC filings, earnings transcripts, and Schedule RC-C data.
The text excerpts specifically surround mentions of Private Credit, Leveraged Finance, and Syndicated Loans.
Your task is to conduct an exploratory qualitative analysis.

Respond with ONLY a valid JSON object. No preamble.
Schema:
{
  "bank_name": "string",
  "mention_frequency": "High, Medium, Low, or None",
  "key_themes": ["List 2-3 brief themes the bank focuses on regarding private credit or leveraged finance"],
  "sentiment": "Positive, Cautious, Negative, or Neutral",
  "strategic_initiatives": "Brief summary of any specific actions, partnerships, or divisions mentioned. If none, write 'None mentioned'.",
  "perceived_risks": "Brief summary of risks the bank associates with these lending activities.",
  "notable_quotes": ["Extract 1-2 direct, highly relevant quotes from the text. Keep them concise."]
}
"""

# --- Phase 2 (secondary_analysis keywords & prompt) ---
TARGET_KEYWORDS_PHASE2 = [
    "private credit",
    "direct lending",
    "alternative credit",
    "middle market loan",
    "middle-market loan",
    "sponsor finance",
    "collateralized loan",
    "CLO",
    "non-bank lender",
    "shadow banking",
    "leveraged finance",
    "syndicated loan",
    "syndicated corporate loan",
    "Apollo",
    "Blackstone",
    "Ares",
    "Blue Owl",
    "Golub",
    "KKR",
]

SYSTEM_PROMPT_PHASE2 = """
You are a lead financial sector analyst. You will be provided with a targeted dossier of a bank's recent SEC filings, earnings transcripts, and Schedule RC-C data.
We are conducting a Phase 2 deep-dive analysis on specific private credit dynamics.

Based on the text provided, answer the following three questions and respond with ONLY a valid JSON object. No preamble.
Schema:
{
  "pullback_mentions": "Is the bank explicitly mentioning pulling back from or reducing their exposure to CLOs, covenant-lite loans, or Alternative Credit? Quote the exact sentences. If no pullback is mentioned, write 'No pullback mentioned.'",
  "named_competitors": "Identify any specific external alternative asset managers/non-bank lenders mentioned by name (e.g., Apollo, Blackstone, Ares, Blue Owl) that they view as a threat to their lending margins or as major market players. If none are named, write 'No specific competitors named.'",
  "risk_focus_analysis": "Analyze how management describes 'Perceived Risks' in private credit. Do their fears align more with a universal depository bank (fearing systemic shadow banking risks, retail contagion, regulatory capital constraints) or a pure investment bank (fearing disintermediation, loss of advisory fees, illiquid valuation risks)? Briefly explain."
}
"""

GEMINI_MODEL = "gemini-2.5-flash"
DOSSIER_CHAR_CAP = 400_000


def extract_json(raw_text: str) -> dict:
    match = re.search(r"\{[\s\S]*\}", raw_text)
    if match:
        return json.loads(match.group(0))
    raise ValueError("No JSON object found in the LLM output.")


def clean_sec_text_phase1(raw_text: str) -> str:
    clean_text = re.sub(r"<[^>]+>", " ", raw_text)
    return " ".join(clean_text.split())


def clean_sec_text_phase2(raw_text: str) -> str:
    clean_text = re.sub(r"<[^>]+>", " ", raw_text)
    clean_text = re.sub(r"[A-Za-z0-9+/=]{100,}", " ", clean_text)
    return re.sub(r"\s+", " ", clean_text).strip()


def extract_relevant_context_phase1(raw_text: str, window: int = 800) -> str:
    text_lower = raw_text.lower()
    if not any(kw.lower() in text_lower for kw in TARGET_KEYWORDS_PHASE1):
        return ""

    clean_text_str = clean_sec_text_phase1(raw_text)
    clean_text_lower = clean_text_str.lower()

    snippets = []
    last_end = 0
    pattern = re.compile(
        r"\b(?:" + "|".join(map(re.escape, TARGET_KEYWORDS_PHASE1)) + r")\b",
        re.IGNORECASE,
    )

    for m in pattern.finditer(clean_text_lower):
        start = max(0, m.start() - window)
        end = min(len(clean_text_str), m.end() + window)
        if start < last_end:
            start = last_end
        if start < end:
            snippets.append("... " + clean_text_str[start:end].strip() + " ...")
            last_end = end

    return "\n\n".join(snippets)


def extract_relevant_context_phase2(text: str, window: int = 800) -> str:
    text_lower = text.lower()
    snippets = []
    last_end = 0
    pattern = re.compile(
        r"\b(?:" + "|".join(map(re.escape, TARGET_KEYWORDS_PHASE2)) + r")\b",
        re.IGNORECASE,
    )

    for m in pattern.finditer(text_lower):
        start = max(0, m.start() - window)
        end = min(len(text), m.end() + window)
        if start < last_end:
            start = last_end
        if start < end:
            while start > 0 and text[start - 1] != " ":
                start -= 1
            while end < len(text) and text[end] != " ":
                end += 1
            snippets.append("... " + text[start:end].strip() + " ...")
            last_end = end
    return "\n\n".join(snippets)


def _api_key_cycle() -> Iterator[str]:
    env = os.environ.get("GEMINI_API_KEY", "").strip()
    if env:
        return itertools.cycle([env])
    multi = os.environ.get("GEMINI_API_KEYS", "")
    keys = [k.strip() for k in multi.split(",") if k.strip()]
    if keys:
        return itertools.cycle(keys)
    raise EnvironmentError(
        "Set GEMINI_API_KEY (or GEMINI_API_KEYS comma-separated) in the environment."
    )


def call_gemini_json(
    system_prompt: str,
    user_content: str,
    api_cycle: Iterator[str],
    *,
    max_retries: int = 5,
    temperature: float = 0.2,
) -> dict:
    last_err: Exception | None = None
    for attempt in range(max_retries):
        api_key = next(api_cycle)
        try:
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=user_content,
                config={
                    "system_instruction": system_prompt,
                    "temperature": temperature,
                },
            )
            return extract_json(response.text)
        except Exception as e:
            last_err = e
            err_s = str(e)
            if "API_KEY_INVALID" in err_s or "API key not valid" in err_s:
                raise RuntimeError("Invalid Gemini API key. Check GEMINI_API_KEY.") from e
            if "429" in err_s and attempt < max_retries - 1:
                wait = 15 * (attempt + 1)
                print(f"    -> Rate limited; waiting {wait}s (attempt {attempt + 1}/{max_retries})...")
                time.sleep(wait)
            else:
                print(f"    -> Attempt {attempt + 1} failed: {type(e).__name__}: {e}. Retrying in 5s...")
                time.sleep(5)
    raise RuntimeError(f"Max retries exceeded: {last_err}") from last_err


def latest_n_10k_dirs(banks_root: Path, ticker: str, n: int = 2) -> list[Path]:
    tenk = banks_root / ticker / "10-K"
    if not tenk.exists():
        return []
    dirs = sorted([p for p in tenk.iterdir() if p.is_dir()], key=lambda p: p.name)
    return dirs[-n:] if n else dirs


def load_filing_text(filing_dir: Path) -> str | None:
    for name in ("primary-document.html", "full-submission.txt", "full_submission.txt"):
        p = filing_dir / name
        if p.exists():
            return p.read_text(encoding="utf-8", errors="ignore")
    return None


def append_banks_10k_excerpts_phase1(
    dossier: str,
    ticker: str,
    banks_root: Path,
    *,
    window: int = 1000,
    max_dirs: int = 2,
) -> str:
    for d in latest_n_10k_dirs(banks_root, ticker, n=max_dirs):
        text = load_filing_text(d)
        if not text:
            continue
        extracted = extract_relevant_context_phase1(text, window=window)
        if extracted:
            dossier += f"Source: sec-edgar-filings/{ticker}/10-K/{d.name}\n{extracted}\n\n"
    return dossier


def append_banks_10k_excerpts_phase2(
    dossier: str,
    ticker: str,
    banks_root: Path,
    *,
    window: int = 1000,
    max_dirs: int = 2,
) -> str:
    dossier += "### SEC FILINGS EXCERPTS (from sec-edgar-filings/) ###\n"
    for d in latest_n_10k_dirs(banks_root, ticker, n=max_dirs):
        text = load_filing_text(d)
        if not text:
            continue
        cleaned = clean_sec_text_phase2(text)
        extracted = extract_relevant_context_phase2(cleaned, window=window)
        if extracted:
            dossier += f"Source: sec-edgar-filings/{ticker}/10-K/{d.name}\n{extracted}\n\n"
    return dossier


def append_transcripts_phase1(dossier: str, ticker: str, search_roots: list[Path]) -> str:
    for base in search_roots:
        transcript_dir = base / "Earnings Calls" / "transcripts_final"
        if not transcript_dir.exists():
            continue
        for file in transcript_dir.glob(f"{ticker}_*.txt"):
            try:
                extracted = extract_relevant_context_phase1(file.read_text(encoding="utf-8", errors="ignore"))
                if extracted:
                    dossier += f"Source: {file.name}\n{extracted}\n\n"
            except Exception:
                pass
    return dossier


def append_transcripts_phase2(dossier: str, ticker: str, search_roots: list[Path]) -> str:
    dossier += "### EARNINGS TRANSCRIPTS EXCERPTS ###\n"
    for base in search_roots:
        transcript_dir = base / "Earnings Calls" / "transcripts_final"
        if not transcript_dir.exists():
            continue
        for file in transcript_dir.glob(f"{ticker}_*.txt"):
            try:
                raw = file.read_text(encoding="utf-8", errors="ignore")
                extracted = extract_relevant_context_phase2(raw)
                if extracted:
                    dossier += f"Source: {file.name}\n{extracted}\n\n"
            except Exception:
                pass
    return dossier


def append_sec_edgar_phase1(dossier: str, ticker: str, search_roots: list[Path]) -> str:
    for base in search_roots:
        sec_dir = base / "sec-edgar-filings" / ticker
        if not sec_dir.exists():
            continue
        for file in sec_dir.rglob("full*submission.txt"):
            try:
                extracted = extract_relevant_context_phase1(
                    file.read_text(encoding="utf-8", errors="ignore"),
                    window=1000,
                )
                if extracted:
                    dossier += f"Source: {file.parent.name}\n{extracted}\n\n"
            except Exception:
                pass
    return dossier


def append_sec_edgar_phase2(dossier: str, ticker: str, search_roots: list[Path]) -> str:
    for base in search_roots:
        sec_dir = base / "sec-edgar-filings" / ticker
        if not sec_dir.exists():
            continue
        for file in sec_dir.rglob("full*submission.txt"):
            try:
                cleaned = clean_sec_text_phase2(file.read_text(encoding="utf-8", errors="ignore"))
                extracted = extract_relevant_context_phase2(cleaned, window=1000)
                if extracted:
                    dossier += f"Source: {file.parent.name}\n{extracted}\n\n"
            except Exception:
                pass
    return dossier


def append_call_report_csv(
    dossier: str,
    ticker: str,
    bank_name: str,
    csv_search_root: Path,
) -> str:
    call_report_aliases = [bank_name.lower(), ticker.lower()]
    if ticker == "JPM":
        call_report_aliases.append("jpmorgan chase bank")
    if ticker == "WFC":
        call_report_aliases.append("wells fargo bank")
    if ticker == "TFC":
        call_report_aliases.append("truist bank")

    mdrm_mapping = {
        "RCFD1563": "Total loans to nondepository financial institutions (Consolidated)",
        "RCFD1460": "Loans to business credit intermediaries (Consolidated)",
    }

    try:
        for file in csv_search_root.rglob("*.csv"):
            if "banks" in file.name.lower() or "findings" in file.name.lower():
                continue
            try:
                cols_to_use = ["Financial Institution Name"] + list(mdrm_mapping.keys())
                header = pd.read_csv(file, nrows=0).columns
                actual_cols = [c for c in cols_to_use if c in header]
                if "Financial Institution Name" not in header:
                    continue

                df = pd.read_csv(file, usecols=actual_cols, low_memory=False)
                pat = "|".join(re.escape(a) for a in call_report_aliases)
                bank_data = df[
                    df["Financial Institution Name"]
                    .astype(str)
                    .str.lower()
                    .str.contains(pat, na=False)
                ]

                if not bank_data.empty:
                    row = bank_data.iloc[0]
                    dossier += f"Source: {file.name}\n"
                    for code in actual_cols:
                        if code in mdrm_mapping and pd.notna(row[code]) and float(row[code]) > 0:
                            dossier += f"- {mdrm_mapping[code]}: ${float(row[code]):,.0f}\n"
                    dossier += "\n"
            except Exception:
                pass
    except Exception:
        pass
    return dossier


def build_dossier_phase1(
    ticker: str,
    bank_name: str,
    *,
    banks_root: Path,
    script_dir: Path,
    repo_root: Path,
    print_steps: bool = True,
) -> str:
    dossier = f"--- DOSSIER FOR {bank_name} ({ticker}) ---\n\n"
    search_roots = [script_dir, repo_root]

    if print_steps:
        print("    -> Scanning sec-edgar-filings/ 10-K filings...")
    dossier += "### SEC FILINGS EXCERPTS (from sec-edgar-filings/) ###\n"
    dossier = append_banks_10k_excerpts_phase1(dossier, ticker, banks_root, window=1000)

    if print_steps:
        print("    -> Scanning Transcripts (if present)...")
    dossier = append_transcripts_phase1(dossier, ticker, search_roots)

    if print_steps:
        print("    -> Scanning sec-edgar-filings/ (if present)...")
    dossier = append_sec_edgar_phase1(dossier, ticker, search_roots)

    if print_steps:
        print("    -> Extracting Call Report CSV (if present, under Keyword_match_method/)...")
    dossier = append_call_report_csv(dossier, ticker, bank_name, script_dir)

    return dossier[:DOSSIER_CHAR_CAP]


def build_dossier_phase2(
    ticker: str,
    bank_name: str,
    *,
    banks_root: Path,
    script_dir: Path,
    repo_root: Path,
    print_steps: bool = True,
) -> str:
    dossier = f"--- DOSSIER FOR {bank_name} ({ticker}) ---\n\n"
    search_roots = [script_dir, repo_root]

    if print_steps:
        print("    -> Scanning Transcripts...")
    dossier = append_transcripts_phase2(dossier, ticker, search_roots)

    if print_steps:
        print("    -> Scanning sec-edgar-filings/ 10-K filings...")
    dossier = append_banks_10k_excerpts_phase2(dossier, ticker, banks_root, window=1000)

    if print_steps:
        print("    -> Scanning sec-edgar-filings/ (if present)...")
    dossier += "### SEC FILINGS EXCERPTS (legacy sec-edgar-filings/) ###\n"
    dossier = append_sec_edgar_phase2(dossier, ticker, search_roots)

    return dossier[:DOSSIER_CHAR_CAP]


def write_presentation_files(df: pd.DataFrame, md_path: Path, json_path: Path) -> None:
    df = df.fillna("None")

    md_content = "# Private Credit Deep-Dive Findings (sec-edgar-filings/ pipeline)\n\n"
    md_content += (
        "Phase 1 (exploratory) and Phase 2 (deep-dive) from keyword windows on dossiers "
        "sourced from `sec-edgar-filings/` 10-Ks and optional transcripts / SEC / call-report CSV.\n\n---\n\n"
    )

    for _, row in df.iterrows():
        kt = row.get("key_themes", "None")
        nq = row.get("notable_quotes", "None")
        themes = (
            [f"  * {t.strip()}" for t in str(kt).split("|")]
            if str(kt) not in ("None", "nan")
            else ["  * None"]
        )
        quotes = (
            [f'  * "{q.strip()}"' for q in str(nq).split("|")]
            if str(nq) not in ("None", "nan")
            else ["  * None"]
        )

        md_content += f"## {row.get('bank_name', 'Unknown')} ({row.get('ticker', '')})\n"
        md_content += "### Phase 1: High-Level Strategy\n"
        md_content += f"* **Mention Frequency:** {row.get('mention_frequency', 'N/A')}\n"
        md_content += f"* **Overall Sentiment:** {row.get('sentiment', 'N/A')}\n\n"
        md_content += "**Key Strategic Themes:**\n"
        md_content += "\n".join(themes) + "\n\n"
        md_content += "**Specific Strategic Initiatives:**\n"
        md_content += f"  {row.get('strategic_initiatives', 'N/A')}\n\n"
        md_content += "**Perceived Market Risks:**\n"
        md_content += f"  {row.get('perceived_risks', 'N/A')}\n\n"
        md_content += "**Notable Management Quotes:**\n"
        md_content += "\n".join(quotes) + "\n\n"
        md_content += "### Phase 2: Deep-Dive Analysis\n"
        md_content += f"**Pullback Mentions:**\n  {row.get('pullback_mentions', 'N/A')}\n\n"
        md_content += f"**Named Competitors:**\n  {row.get('named_competitors', 'N/A')}\n\n"
        md_content += f"**Risk Focus Analysis (Universal vs. IB):**\n  {row.get('risk_focus_analysis', 'N/A')}\n\n"
        md_content += "---\n\n"

    md_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.write_text(md_content, encoding="utf-8")

    df_json = df.copy()
    for col in ["key_themes", "notable_quotes"]:
        if col in df_json.columns:
            df_json[col] = df_json[col].apply(
                lambda x: [y.strip() for y in str(x).split("|")]
                if pd.notna(x) and str(x) != "None"
                else []
            )

    json_data = df_json.to_dict(orient="records")
    for record in json_data:
        record.pop("error", None)

    json_path.write_text(json.dumps(json_data, indent=4, ensure_ascii=False), encoding="utf-8")

#!/usr/bin/env python3
"""
Combined Private Credit Analysis
=================================
This script combines two teammates' approaches into one unified pipeline:
  - Semantic_similarity_method's approach: Semantic search using sentence-transformer embeddings to find
    the most relevant paragraphs about private credit in SEC filings (10-K).
  - Keyword_match_method's approach: Input processing (transcripts, all SEC filing types, call reports)
    and structured output format (CSV + Markdown + JSON with Phase 1 & Phase 2 fields).

How it works (high-level):
  1. For each bank, we GATHER text from 4 data sources (10-K, 10-Q/8-K, transcripts, call reports)
  2. We use AI embeddings to RANK every paragraph by how relevant it is to private credit
  3. We pick the TOP paragraphs and assemble them into a "dossier" (a curated text bundle)
  4. We send that dossier to Google's Gemini LLM in a SINGLE API call per bank
  5. Gemini returns a structured JSON with its analysis (themes, sentiment, risks, quotes, etc.)
  6. We save the results as CSV, Markdown, and JSON files

Key optimization: Keyword_match_method originally used 2 Gemini calls per bank (Phase 1 + Phase 2).
We merged both JSON schemas into ONE prompt = only 1 API call per bank.
For 5 banks, that's just 5 total API calls — well within Gemini's free-tier limits.
"""

import os
import re
import json
import time
import itertools
import pandas as pd
from pathlib import Path
from sentence_transformers import SentenceTransformer
from google import genai

try:
    from dotenv import load_dotenv
    _ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
    if _ENV_PATH.is_file():
        load_dotenv(_ENV_PATH, override=False)
except ImportError:
    pass

from helpers import (
    read_10k_paragraphs,
    read_other_sec_paragraphs,
    read_transcript_paragraphs,
    read_call_report_text,
    score_paragraphs,
)


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: CONSTANTS & CONFIG
# ═══════════════════════════════════════════════════════════════════════════════
# This section defines all the configuration the script needs:
#   - Directory paths for input data (SEC filings, transcripts, call reports)
#   - API keys and model names for Gemini (LLM) and sentence-transformers (embeddings)
#   - The 5 banks we're analyzing, with their names and call-report lookup aliases
#   - Query phrases and keywords that define what "private credit" means for our search
#   - Regex patterns to find specific sections inside 10-K filings
#   - The combined prompt we send to Gemini (merging Phase 1 + Phase 2 questions)
# ═══════════════════════════════════════════════════════════════════════════════

# --- Directory paths ---
_SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = _SCRIPT_DIR.parent                       # BUFN403/
SEC_DIR = REPO_ROOT / "sec-edgar-filings"             # SEC filings organized as: ticker/filing-type/date/files
TRANSCRIPT_DIR = REPO_ROOT / "transcripts_final"      # Earnings call transcripts as: TICKER_YYYY_QN.txt
CALL_REPORT_DIR = REPO_ROOT / "Call_Reports"          # FDIC call report CSVs as: YYYYMMDD.csv
OUTPUT_DIR = _SCRIPT_DIR / "combined_output"           # Where we write our results

# --- API & model config ---
def _load_api_keys() -> list:
    """Collect GEMINI_API_KEY, GEMINI_API_KEY_2 … GEMINI_API_KEY_10 from the environment."""
    keys = []
    k = os.environ.get("GEMINI_API_KEY", "").strip()
    if k:
        keys.append(k)
    for i in range(2, 11):
        k = os.environ.get(f"GEMINI_API_KEY_{i}", "").strip()
        if k:
            keys.append(k)
    return keys

API_KEYS = _load_api_keys()
GEMINI_MODEL = "gemini-2.5-flash"
EMBED_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


class GeminiKeyPool:
    """Round-robin pool of Gemini API keys.  Rotates to the next key on demand
    (e.g. when the current key is rate-limited)."""

    def __init__(self, keys: list):
        if not keys:
            raise EnvironmentError(
                "No Gemini API keys found. Set GEMINI_API_KEY (and optionally "
                "GEMINI_API_KEY_2 … GEMINI_API_KEY_10) in BUFN403/.env"
            )
        self._keys = keys
        self._cycle = itertools.cycle(range(len(keys)))
        self._idx = next(self._cycle)
        self._client = genai.Client(api_key=keys[self._idx])
        print(f"  GeminiKeyPool: {len(keys)} API key(s) loaded, starting with key #1")

    @property
    def client(self):
        return self._client

    def rotate(self) -> "genai.Client":
        self._idx = next(self._cycle)
        self._client = genai.Client(api_key=self._keys[self._idx])
        print(f"    -> Rotated to API key #{self._idx + 1} of {len(self._keys)}")
        return self._client

# --- Banks we analyze (all 50 tickers in sec-edgar-filings/) ---
# "call_report_aliases" are substrings matched case-insensitively against FDIC call report names
BANKS = {
    "ALLY":  {"name": "Ally Financial Inc.", "call_report_aliases": ["ally bank"]},
    "ASB":   {"name": "Associated Banc-Corp", "call_report_aliases": ["associated bank"]},
    "AXP":   {"name": "American Express Company", "call_report_aliases": ["american express"]},
    "BAC":   {"name": "Bank of America Corporation", "call_report_aliases": ["bank of america"]},
    "BK":    {"name": "The Bank of New York Mellon Corporation", "call_report_aliases": ["bank of new york mellon"]},
    "BKU":   {"name": "BankUnited, Inc.", "call_report_aliases": ["bankunited"]},
    "BOKF":  {"name": "BOK Financial Corporation", "call_report_aliases": ["bokf"]},
    "BPOP":  {"name": "Popular, Inc.", "call_report_aliases": ["banco popular"]},
    "C":     {"name": "Citigroup Inc.", "call_report_aliases": ["citibank"]},
    "CFG":   {"name": "Citizens Financial Group, Inc.", "call_report_aliases": ["citizens bank"]},
    "CFR":   {"name": "Cullen/Frost Bankers, Inc.", "call_report_aliases": ["frost bank"]},
    "CMA":   {"name": "Comerica Incorporated", "call_report_aliases": ["comerica"]},
    "COF":   {"name": "Capital One Financial Corporation", "call_report_aliases": ["capital one"]},
    "COLB":  {"name": "Columbia Banking System, Inc.", "call_report_aliases": ["columbia bank"]},
    "DFS":   {"name": "Discover Financial Services", "call_report_aliases": ["discover"]},
    "EWBC":  {"name": "East West Bancorp, Inc.", "call_report_aliases": ["east west bank"]},
    "FCNCA": {"name": "First Citizens BancShares, Inc.", "call_report_aliases": ["first-citizens", "first citizens"]},
    "FHN":   {"name": "First Horizon Corporation", "call_report_aliases": ["first horizon"]},
    "FITB":  {"name": "Fifth Third Bancorp", "call_report_aliases": ["fifth third"]},
    "FLG":   {"name": "Flagstar Financial, Inc.", "call_report_aliases": ["flagstar"]},
    "FNB":   {"name": "F.N.B. Corporation", "call_report_aliases": ["f.n.b", "fnb"]},
    "GS":    {"name": "The Goldman Sachs Group, Inc.", "call_report_aliases": ["goldman sachs"]},
    "HBAN":  {"name": "Huntington Bancshares Incorporated", "call_report_aliases": ["huntington"]},
    "JPM":   {"name": "JPMorgan Chase & Co.", "call_report_aliases": ["jpmorgan"]},
    "KEY":   {"name": "KeyCorp", "call_report_aliases": ["keybank"]},
    "MS":    {"name": "Morgan Stanley", "call_report_aliases": ["morgan stanley"]},
    "MTB":   {"name": "M&T Bank Corporation", "call_report_aliases": ["manufacturers and traders", "m&t"]},
    "NTRS":  {"name": "Northern Trust Corporation", "call_report_aliases": ["northern trust"]},
    "ONB":   {"name": "Old National Bancorp", "call_report_aliases": ["old national"]},
    "PB":    {"name": "Prosperity Bancshares, Inc.", "call_report_aliases": ["prosperity"]},
    "PNC":   {"name": "The PNC Financial Services Group, Inc.", "call_report_aliases": ["pnc"]},
    "PNFP":  {"name": "Pinnacle Financial Partners, Inc.", "call_report_aliases": ["pinnacle"]},
    "RF":    {"name": "Regions Financial Corporation", "call_report_aliases": ["regions"]},
    "RJF":   {"name": "Raymond James Financial, Inc.", "call_report_aliases": ["raymond james"]},
    "SCHW":  {"name": "The Charles Schwab Corporation", "call_report_aliases": ["charles schwab", "schwab"]},
    "SF":    {"name": "Stifel Financial Corp.", "call_report_aliases": ["stifel"]},
    "SNV":   {"name": "Synovus Financial Corp.", "call_report_aliases": ["synovus"]},
    "SOFI":  {"name": "SoFi Technologies, Inc.", "call_report_aliases": ["sofi"]},
    "SSB":   {"name": "SouthState Corporation", "call_report_aliases": ["southstate"]},
    "STT":   {"name": "State Street Corporation", "call_report_aliases": ["state street"]},
    "SYF":   {"name": "Synchrony Financial", "call_report_aliases": ["synchrony"]},
    "TFC":   {"name": "Truist Financial Corporation", "call_report_aliases": ["truist"]},
    "UMBF":  {"name": "UMB Financial Corporation", "call_report_aliases": ["umb bank", "umb financial"]},
    "USB":   {"name": "U.S. Bancorp", "call_report_aliases": ["u.s. bank"]},
    "VLY":   {"name": "Valley National Bancorp", "call_report_aliases": ["valley national"]},
    "WAL":   {"name": "Western Alliance Bancorporation", "call_report_aliases": ["western alliance"]},
    "WBS":   {"name": "Webster Financial Corporation", "call_report_aliases": ["webster"]},
    "WFC":   {"name": "Wells Fargo & Company", "call_report_aliases": ["wells fargo"]},
    "WTFC":  {"name": "Wintrust Financial Corporation", "call_report_aliases": ["wintrust"]},
    "ZION":  {"name": "Zions Bancorporation, N.A.", "call_report_aliases": ["zions"]},
}

# --- Semantic search queries (from Semantic_similarity_method) ---
# These are the "questions" we compare every paragraph against using embeddings.
# Paragraphs that are semantically similar to these phrases get higher scores.
QUERY_PHRASES = [
    "sponsor-backed lending to private equity owned companies",
    "financial sponsor lending and middle-market sponsor finance",
    "direct lending private credit private debt platform",
    "lending to finance companies asset managers hedge funds private funds",
    "collateralized loan obligations CLO leveraged loan securitization",
    "structured finance structured credit specialty finance asset-based lending warehouse financing",
    "institutional banking middle-market lending sponsor-backed borrowers",
]

# --- Keyword groups for bonus scoring (from Semantic_similarity_method) ---
# If a paragraph contains keywords from these groups, it gets a small score boost.
# This helps catch relevant paragraphs that embeddings alone might rank lower.
KEYWORD_GROUPS = {
    "sponsor_pe": [
        "sponsor-backed", "financial sponsor", "private equity",
        "private-equity", "sponsor finance", "middle-market sponsor",
    ],
    "direct_lending": [
        "direct lending", "private credit", "private debt",
        "middle-market direct lending", "credit platform",
    ],
    "financial_institutions": [
        "finance companies", "asset managers", "hedge funds",
        "private funds", "specialty finance", "institutional clients",
    ],
    "clo": [
        "clo", "collateralized loan obligations",
        "loan securitization", "securitization",
    ],
    "structured_finance": [
        "structured finance", "structured credit",
        "asset-based lending", "warehouse financing",
        "specialty finance",
    ],
}

# --- Fast keyword pre-filter (from Keyword_match_method) ---
# Before doing expensive semantic scoring on 10-Q/8-K filings, we first check
# if the file even contains any of these keywords. If not, we skip it entirely.
# This saves a lot of time since most 8-K filings are irrelevant.
TARGET_KEYWORDS = [
    "private credit", "direct lending", "alternative credit",
    "middle market loan", "middle-market loan", "sponsor finance",
    "collateralized loan", "CLO", "non-bank lender", "shadow banking",
    "leveraged finance", "syndicated loan", "syndicated corporate loan",
]

# --- 10-K section detection patterns (from Semantic_similarity_method) ---
# 10-K filings have standard sections. We use regex to find Item 1 (Business description)
# and Item 7 (MD&A - Management Discussion & Analysis) since these are most likely to
# discuss the bank's lending strategy and private credit involvement.
SECTION_PATTERNS = {
    "item1":  [r"\bitem\s+1[\.\-:\s]+business\b", r"\bitem\s+1\b"],
    "item1a": [r"\bitem\s+1a[\.\-:\s]+risk factors\b", r"\bitem\s+1a\b"],
    "item7":  [r"\bitem\s+7[\.\-:\s]+management[''`s]{0,2}\s+discussion", r"\bitem\s+7\b"],
    "item7a": [r"\bitem\s+7a\b"],
}

# --- Call report field mapping ---
# RCFD1460 is the FDIC code for "Loans to business credit intermediaries" in Schedule RC-C.
# This tells us how much the bank lends to non-bank financial companies (relevant to private credit).
MDRM_MAPPING = {
    "RCFD1460": "Loans to business credit intermediaries (Consolidated)",
}

# --- Combined Gemini prompt ---
# This is the instruction we send to Gemini along with each bank's dossier.
# It merges Keyword_match_method's Phase 1 fields (mention_frequency, sentiment, key_themes, etc.)
# with Phase 2 fields (pullback_mentions, named_competitors, risk_focus_analysis)
# into a SINGLE JSON schema, so we only need ONE API call per bank.
COMBINED_SYSTEM_PROMPT = """
You are a lead financial sector analyst. You will be provided with a targeted dossier of a bank's recent SEC filings (10-K, 10-Q, 8-K), earnings call transcripts, and Schedule RC-C call report data.
The text excerpts have been semantically selected to focus on Private Credit, Leveraged Finance, and Syndicated Loans.

Your task is to conduct a comprehensive qualitative analysis covering both high-level strategy AND deep-dive dynamics.

Also assign a single **rating** (JSON integer, not a string): an overall score from **1 to 5** for how **material and strategically central** private credit, direct lending, sponsor finance, CLOs, and closely related leveraged/syndicated activities appear to be **in the dossier only** (not your general knowledge of the bank).
Scale: **1** = negligible or absent; **2** = minor or peripheral; **3** = meaningful but not defining; **4** = important business line or recurring theme; **5** = central to the narrative or a primary growth/risk focus. The rating must be **consistent** with `mention_frequency` and `sentiment` (e.g. do not use 5 if mention_frequency is None or Low without strong qualitative evidence).

Respond with ONLY a valid JSON object. No preamble, no markdown fences.
Schema:
{
  "bank_name": "string",
  "rating": 3,
  "mention_frequency": "High, Medium, Low, or None",
  "key_themes": ["List 2-3 brief themes the bank focuses on regarding private credit or leveraged finance"],
  "sentiment": "Positive, Cautious, Negative, or Neutral",
  "strategic_initiatives": "Brief summary of any specific actions, partnerships, or divisions mentioned. If none, write 'None mentioned'.",
  "perceived_risks": "Brief summary of risks the bank associates with these lending activities.",
  "notable_quotes": ["Extract 1-2 direct, highly relevant quotes from the text. Keep them concise."],
  "pullback_mentions": "Is the bank explicitly mentioning pulling back from or reducing their exposure to CLOs, covenant-lite loans, or Alternative Credit? Quote the exact sentences. If no pullback is mentioned, write 'No pullback mentioned.'",
  "named_competitors": "Identify any specific external alternative asset managers/non-bank lenders mentioned by name (e.g., Apollo, Blackstone, Ares, Blue Owl) that they view as a threat. If none are named, write 'No specific competitors named.'",
  "risk_focus_analysis": "Analyze how management describes perceived risks in private credit. Do their fears align more with a universal depository bank (systemic shadow banking risks, retail contagion, regulatory capital constraints) or a pure investment bank (disintermediation, loss of advisory fees, illiquid valuation risks)? Briefly explain."
}
"""

# Steps 2–4b (text utilities, semantic scoring, SEC section extraction, source readers)
# live in helpers.py and are imported above.

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5: DOSSIER BUILDER
# ═══════════════════════════════════════════════════════════════════════════════
# This is the orchestration step that ties everything together for each bank.
# It calls all 4 source readers, runs semantic scoring on every paragraph,
# picks the top-ranked paragraphs from each source (with word budgets),
# and assembles them into a single "dossier" text that gets sent to Gemini.
#
# Word budgets per source (to keep the dossier focused and within token limits):
#   - 10-K filings:  ~3000 words (richest source of strategy/business description)
#   - 10-Q/8-K:      ~2000 words (supplementary quarterly/event details)
#   - Transcripts:    ~2000 words (management commentary and Q&A)
#   - Call reports:   ~200 words  (just the numerical data points)
#   - Hard cap:       40,000 characters total (stays under Gemini free-tier token limit)
# ═══════════════════════════════════════════════════════════════════════════════

def build_dossier(ticker: str, bank_info: dict, embed_model, query_embeddings) -> str:
    """Build a semantically-ranked dossier from all sources for one bank.
    Each source's paragraphs are scored independently, sorted by relevance,
    and the top ones are included up to the word budget for that source."""
    dossier_parts = [f"--- DOSSIER FOR {bank_info['name']} ({ticker}) ---\n"]

    # --- 10-K: semantic ranking with section-aware scoring ---
    # These are the most important filings — annual reports with full business descriptions.
    # We use Semantic_similarity_method's full pipeline: HTML parsing -> section extraction -> semantic scoring.
    print("    -> Processing 10-K filings (semantic search)...")
    tenk_paras = read_10k_paragraphs(ticker, SEC_DIR, SECTION_PATTERNS)
    if tenk_paras:
        scored = []
        for text, sec, label in tenk_paras:
            scored.extend(
                score_paragraphs(
                    [text], sec, label, embed_model, query_embeddings, KEYWORD_GROUPS
                )
            )
        scored.sort(key=lambda x: x["score"], reverse=True)
        words = 0
        dossier_parts.append("### 10-K FILINGS EXCERPTS ###")
        for row in scored:
            wc = row["word_count"]
            if words + wc > 3000:  # ~3000 word budget for 10-K
                break
            dossier_parts.append(f"[{row['filing']} | {row['section']}] {row['paragraph']}")
            words += wc

    # --- 10-Q / 8-K: keyword pre-filter then semantic ranking ---
    # Less important than 10-K but can contain timely updates about lending activity.
    # Keyword_match_method's keyword pre-filter skips irrelevant filings before we do expensive scoring.
    print("    -> Processing 10-Q/8-K filings...")
    other_paras = read_other_sec_paragraphs(ticker, SEC_DIR, TARGET_KEYWORDS)
    if other_paras:
        scored = []
        for text, sec, label in other_paras:
            scored.extend(
                score_paragraphs(
                    [text], sec, label, embed_model, query_embeddings, KEYWORD_GROUPS
                )
            )
        scored.sort(key=lambda x: x["score"], reverse=True)
        words = 0
        dossier_parts.append("\n### 10-Q / 8-K FILINGS EXCERPTS ###")
        for row in scored:
            wc = row["word_count"]
            if words + wc > 2000:  # ~2000 word budget for 10-Q/8-K
                break
            dossier_parts.append(f"[{row['filing']}] {row['paragraph']}")
            words += wc

    # --- Transcripts: semantic ranking ---
    # Earnings call transcripts capture what management SAYS about their strategy,
    # often more candid than formal filings. Good for quotes and sentiment.
    print("    -> Processing earnings call transcripts...")
    transcript_paras = read_transcript_paragraphs(ticker, TRANSCRIPT_DIR)
    if transcript_paras:
        scored = []
        for text, sec, label in transcript_paras:
            scored.extend(
                score_paragraphs(
                    [text], sec, label, embed_model, query_embeddings, KEYWORD_GROUPS
                )
            )
        scored.sort(key=lambda x: x["score"], reverse=True)
        words = 0
        dossier_parts.append("\n### EARNINGS TRANSCRIPTS EXCERPTS ###")
        for row in scored:
            wc = row["word_count"]
            if words + wc > 2000:  # ~2000 word budget for transcripts
                break
            dossier_parts.append(f"[{row['filing']}] {row['paragraph']}")
            words += wc

    # --- Call Reports: structured numerical data ---
    # No semantic scoring needed here — we just extract the relevant MDRM values
    # and format them as structured text for the LLM to interpret.
    print("    -> Extracting call report data...")
    call_report_text = read_call_report_text(
        ticker, bank_info, CALL_REPORT_DIR, MDRM_MAPPING
    )
    if call_report_text:
        dossier_parts.append(f"\n{call_report_text}")

    dossier = "\n\n".join(dossier_parts)

    # Hard cap at 40K characters to stay under Gemini free-tier token limits
    if len(dossier) > 40000:
        dossier = dossier[:40000]

    return dossier


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6: GEMINI INTERFACE
# ═══════════════════════════════════════════════════════════════════════════════
# Handles communication with Google's Gemini LLM API.
#   - Sends the combined prompt + dossier to Gemini
#   - Parses the JSON response from Gemini's raw text output
#   - Retries with exponential backoff if the API returns errors (rate limits, etc.)
# ═══════════════════════════════════════════════════════════════════════════════

def extract_json(raw_text: str) -> dict:
    """Extract a JSON object from Gemini's response text.
    Gemini sometimes wraps JSON in markdown fences or adds preamble text,
    so we use regex to find the first {...} block and parse it."""
    match = re.search(r"\{[\s\S]*\}", raw_text)
    if match:
        return json.loads(match.group(0))
    raise ValueError("No JSON object found in the LLM output.")


def call_gemini(pool: GeminiKeyPool, bank_name: str, dossier_text: str, retries: int = 5) -> dict:
    """Send a bank's dossier to Gemini and get back structured analysis as JSON.
    On rate-limit (429), rotates to the next API key and retries quickly."""
    prompt = f"{COMBINED_SYSTEM_PROMPT}\n\nBank: {bank_name}\n\nDossier:\n{dossier_text}"

    for attempt in range(retries):
        try:
            response = pool.client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )
            return extract_json(response.text)
        except Exception as e:
            err_s = str(e)
            if "API_KEY_INVALID" in err_s or "API key not valid" in err_s:
                raise RuntimeError("Invalid Gemini API key. Check GEMINI_API_KEY in .env") from e
            is_rate_limit = "429" in err_s or "RESOURCE_EXHAUSTED" in err_s
            if is_rate_limit:
                pool.rotate()
                wait = 2
            else:
                wait = 15 * (attempt + 1)
            print(f"    -> Attempt {attempt + 1} failed: {type(e).__name__}: {err_s[:120]}. "
                  f"{'Rotated key, retrying' if is_rate_limit else 'Retrying'} in {wait}s...")
            time.sleep(wait)
    raise Exception(f"Max retries exceeded for {bank_name}")


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 7: OUTPUT GENERATORS (from Keyword_match_method's csv_to_json_converter.py)
# ═══════════════════════════════════════════════════════════════════════════════
# Takes the list of Gemini results (one dict per bank) and writes them in
# three formats:
#   - CSV:      Tabular format, lists joined with " | " for easy Excel viewing
#   - Markdown: Formatted report with Phase 1 + Phase 2 sections per bank
#   - JSON:     Pretty-printed JSON array with proper list types preserved
# ═══════════════════════════════════════════════════════════════════════════════

def save_csv(results: list, path: Path):
    """Save results as CSV. Lists (key_themes, notable_quotes) are joined with
    pipe separators so they display nicely in Excel/Google Sheets."""
    df = pd.json_normalize(results)
    # Convert lists to pipe-separated strings for CSV compatibility
    for col in ["key_themes", "notable_quotes"]:
        if col in df.columns:
            df[col] = df[col].apply(lambda x: " | ".join(x) if isinstance(x, list) else x)
    priority = ["bank_name", "ticker", "rating", "mention_frequency", "sentiment"]
    cols = [c for c in priority if c in df.columns] + [c for c in df.columns if c not in priority]
    df = df[cols]
    df.to_csv(path, index=False)
    print(f"  CSV saved: {path}")


def save_markdown(results: list, path: Path):
    """Save results as a formatted Markdown report.
    Each bank gets a section with Phase 1 (high-level strategy) and
    Phase 2 (deep-dive analysis) subsections, matching Keyword_match_method's format."""
    md = "# Private Credit Deep-Dive Findings\n\n"
    md += "This document synthesizes both Phase 1 (Exploratory) and Phase 2 (Deep-Dive) analysis.\n\n---\n\n"

    for r in results:
        # Handle both list and pipe-separated string formats for themes/quotes
        themes = r.get("key_themes", [])
        if isinstance(themes, str):
            themes = [t.strip() for t in themes.split("|")]
        quotes = r.get("notable_quotes", [])
        if isinstance(quotes, str):
            quotes = [q.strip() for q in quotes.split("|")]

        theme_bullets = "\n".join(f"  * {t}" for t in themes) if themes else "  * None"
        quote_bullets = "\n".join(f'  * "{q}"' for q in quotes) if quotes else "  * None"

        # Phase 1: High-level strategy findings
        md += f"## {r.get('bank_name', 'N/A')} ({r.get('ticker', 'N/A')})\n"
        md += f"### Phase 1: High-Level Strategy\n"
        md += f"* **Private credit emphasis rating (1–5):** {r.get('rating', 'N/A')}\n"
        md += f"* **Mention Frequency:** {r.get('mention_frequency', 'N/A')}\n"
        md += f"* **Overall Sentiment:** {r.get('sentiment', 'N/A')}\n\n"
        md += f"**Key Strategic Themes:**\n{theme_bullets}\n\n"
        md += f"**Specific Strategic Initiatives:**\n  {r.get('strategic_initiatives', 'N/A')}\n\n"
        md += f"**Perceived Market Risks:**\n  {r.get('perceived_risks', 'N/A')}\n\n"
        md += f"**Notable Management Quotes:**\n{quote_bullets}\n\n"
        # Phase 2: Deep-dive analysis findings
        md += f"### Phase 2: Deep-Dive Analysis\n"
        md += f"**Pullback Mentions:**\n  {r.get('pullback_mentions', 'N/A')}\n\n"
        md += f"**Named Competitors:**\n  {r.get('named_competitors', 'N/A')}\n\n"
        md += f"**Risk Focus Analysis (Universal vs. IB):**\n  {r.get('risk_focus_analysis', 'N/A')}\n\n"
        md += "---\n\n"

    path.write_text(md, encoding="utf-8")
    print(f"  Markdown saved: {path}")


def save_json(results: list, path: Path):
    """Save results as pretty-printed JSON. Converts any pipe-separated strings
    back into proper JSON arrays, and removes internal error fields."""
    clean = []
    for r in results:
        entry = dict(r)
        entry.pop("error", None)  # don't include error details in output
        # Convert pipe-separated strings back to lists
        for col in ["key_themes", "notable_quotes"]:
            if col in entry and isinstance(entry[col], str):
                entry[col] = [x.strip() for x in entry[col].split("|")]
        clean.append(entry)
    path.write_text(json.dumps(clean, indent=4, ensure_ascii=False), encoding="utf-8")
    print(f"  JSON saved: {path}")


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 8: MAIN LOOP
# ═══════════════════════════════════════════════════════════════════════════════
# This is the entry point that orchestrates the entire pipeline:
#   1. Load the embedding model (one-time, ~5 seconds)
#   2. Pre-compute query embeddings (one-time)
#   3. Initialize the Gemini API client
#   4. For each bank:
#      a. Build a curated dossier (semantic search across all 4 sources)
#      b. Save the dossier to disk for debugging/inspection
#      c. Send the dossier to Gemini (single combined prompt)
#      d. Parse the JSON response and store the result
#      e. Sleep 4 seconds between banks for rate limiting
#   5. Write all results as CSV, Markdown, and JSON
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    if not API_KEYS:
        print("ERROR: No Gemini API keys found.")
        print("  Set GEMINI_API_KEY (and optionally GEMINI_API_KEY_2 … _10) in BUFN403/.env")
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    dossier_dir = OUTPUT_DIR / "dossiers"
    dossier_dir.mkdir(parents=True, exist_ok=True)

    print("Loading embedding model...")
    embed_model = SentenceTransformer(EMBED_MODEL_NAME)
    query_embeddings = embed_model.encode(
        QUERY_PHRASES,
        convert_to_numpy=True,
        normalize_embeddings=False,
        show_progress_bar=False,
    )

    print("Initializing Gemini key pool...")
    pool = GeminiKeyPool(API_KEYS)

    results = []
    tickers = list(BANKS.keys())

    for i, ticker in enumerate(tickers, 1):
        bank_info = BANKS[ticker]
        bank_name = bank_info["name"]
        print(f"\n[{i}/{len(tickers)}] Processing {bank_name} ({ticker})...")

        # STEP A: Build the curated dossier from all 4 data sources
        dossier = build_dossier(ticker, bank_info, embed_model, query_embeddings)

        # Save dossier to disk so we can inspect what text was sent to Gemini
        dossier_path = dossier_dir / f"{ticker}_dossier.txt"
        dossier_path.write_text(dossier, encoding="utf-8")
        print(f"    -> Dossier: {len(dossier)} chars, saved to {dossier_path}")

        # Skip banks with very little data (less than ~200 chars = no useful content)
        if len(dossier) < 200:
            print(f"    -> Insufficient data found. Skipping LLM call.")
            results.append({
                "bank_name": bank_name,
                "ticker": ticker,
                "rating": 1,
                "mention_frequency": "None",
                "sentiment": "Neutral",
            })
            continue

        # STEP B: Send dossier to Gemini (single combined Phase 1 + Phase 2 prompt)
        print("    -> Calling Gemini...")
        try:
            result = call_gemini(pool, bank_name, dossier)
            result["ticker"] = ticker
            result["bank_name"] = bank_name
            results.append(result)
            print(
                f"    -> Success! Rating: {result.get('rating')}, "
                f"Sentiment: {result.get('sentiment')}, "
                f"Frequency: {result.get('mention_frequency')}"
            )
        except Exception as e:
            print(f"    -> ERROR: {e}")
            results.append({
                "bank_name": bank_name,
                "ticker": ticker,
                "error": str(e),
            })

        # STEP C: Rate limit pause (short — key rotation handles 429s)
        if i < len(tickers):
            time.sleep(4)

    # STEP D: Write all results to the 3 output formats
    print("\n=== Writing output files ===")
    if results:
        save_csv(results, OUTPUT_DIR / "Combined_PC_Findings.csv")
        save_markdown(results, OUTPUT_DIR / "Combined_PC_Findings.md")
        save_json(results, OUTPUT_DIR / "Combined_PC_Findings.json")

    print(f"\nDone! {len(results)} banks processed. Output in {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()

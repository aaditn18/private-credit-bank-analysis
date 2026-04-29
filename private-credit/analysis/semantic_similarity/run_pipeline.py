"""
BUFN403 Private Credit Analysis Pipeline
Adapted from BUFN_aks.ipynb for local execution.

API key: set GEMINI_API_KEY in BUFN403/.env (see python-dotenv) or in the environment.
"""

# ── Load BUFN403/.env (GEMINI_API_KEY) ───────────────────────────────────────
import importlib.util
from pathlib import Path

_dotenv_mod = Path(__file__).resolve().parent.parent / "bufn403_dotenv.py"
if _dotenv_mod.is_file():
    _spec = importlib.util.spec_from_file_location("bufn403_dotenv", _dotenv_mod)
    if _spec and _spec.loader:
        _m = importlib.util.module_from_spec(_spec)
        _spec.loader.exec_module(_m)

# ── Imports ──────────────────────────────────────────────────────────────────
import os
import re
import json
import time
import numpy as np
from bs4 import BeautifulSoup
from sentence_transformers import SentenceTransformer
from google import genai

# ── Config ───────────────────────────────────────────────────────────────────
ROOT_DIR = Path(__file__).resolve().parent.parent / "sec-edgar-filings"
OUTPUT_DIR = Path("private_credit_output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

BANKS = {
    "PNFP": {"name": "Pinnacle Financial Partners", "idrssd": 2925666},
    "CFR":  {"name": "Cullen/Frost Bankers", "idrssd": 682563},
    "BOKF": {"name": "BOK Financial Corp.", "idrssd": 339858},
    "FNB":  {"name": "F.N.B. Corporation", "idrssd": 379920},
    "SOFI": {"name": "SoFi Technologies", "idrssd": 962966},
    "ASB":  {"name": "Associated Banc-Corp", "idrssd": 917742},
    "SF":   {"name": "Stifel Financial Corp.", "idrssd": 3076220},
    "PB":   {"name": "Prosperity Bancshares", "idrssd": 664756},
    "BKU":  {"name": "BankUnited, Inc.", "idrssd": 3938186},
}

TICKERS_TO_RUN = ["PNFP", "CFR", "BOKF", "FNB", "SOFI", "ASB", "SF", "PB", "BKU"]

EMBED_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
GEMINI_MODEL_NAME = "gemini-2.5-flash"

# ── Query phrases & keyword groups ───────────────────────────────────────────
QUERY_PHRASES = [
    "sponsor-backed lending to private equity owned companies",
    "financial sponsor lending and middle-market sponsor finance",
    "direct lending private credit private debt platform",
    "lending to finance companies asset managers hedge funds private funds",
    "collateralized loan obligations CLO leveraged loan securitization",
    "structured finance structured credit specialty finance asset-based lending warehouse financing",
    "institutional banking middle-market lending sponsor-backed borrowers",
]

KEYWORD_GROUPS = {
    "sponsor_pe": [
        "sponsor-backed", "financial sponsor", "private equity",
        "private-equity", "sponsor finance", "middle-market sponsor"
    ],
    "direct_lending": [
        "direct lending", "private credit", "private debt",
        "middle-market direct lending", "credit platform"
    ],
    "financial_institutions": [
        "finance companies", "asset managers", "hedge funds",
        "private funds", "specialty finance", "institutional clients"
    ],
    "clo": [
        "clo", "collateralized loan obligations",
        "loan securitization", "securitization"
    ],
    "structured_finance": [
        "structured finance", "structured credit",
        "asset-based lending", "warehouse financing",
        "specialty finance"
    ],
}

# ── Gemini prompt template ───────────────────────────────────────────────────
SYSTEM_PROMPT_TEMPLATE = """
You are a financial analyst focused on bank SEC filings and private credit markets.

You will receive curated excerpts from one bank's two most recent 10-K filings.
Your task is to write a concise qualitative report about the bank's involvement in private credit.

Use ONLY the provided text.
Do not invent facts.
If evidence is weak or absent, say so explicitly.

Write the report in markdown with exactly these sections:

# {bank_name}

## Overview
2-4 sentences on the bank's likely involvement in private credit.

## Sponsor-Backed / Private Equity Lending
- Bullet points with evidence or note that no clear evidence was found.

## Direct Lending / Private Credit Platforms
- Bullet points with evidence or note that no clear evidence was found.

## Lending to Financial Institutions
- Bullet points with evidence or note that no clear evidence was found.

## CLO Activity
- Bullet points with evidence or note that no clear evidence was found.

## Structured / Specialty Finance
- Bullet points with evidence or note that no clear evidence was found.

## Final Assessment
1 short paragraph summarizing the bank's position.

## Score
Score: X/10

Scoring guide:
1-2 = no meaningful evidence
3-4 = low involvement
5-6 = moderate involvement
7-8 = strong involvement
9-10 = very heavy involvement

Base the score only on the supplied text.
"""

# ── Section patterns ─────────────────────────────────────────────────────────
SECTION_PATTERNS = {
    "item1": [
        r"\bitem\s+1[\.\-:\s]+business\b",
    ],
    "item1a": [
        r"\bitem\s+1a[\.\-:\s]+risk\s+factors?\b",
        r"\bitem\s+1a\b",
    ],
    "item7": [
        r"\bitem\s+7[\.\-:\s]+management[''`s]{0,2}\s+discussion",
        r"\bitem\s+7\b",
    ],
    "item7a": [
        r"\bitem\s+7a[\.\-:\s]+quantitative\b",
        r"\bitem\s+7a\b",
    ],
}

# ── Helper functions ─────────────────────────────────────────────────────────

def normalize_whitespace(text: str) -> str:
    text = text.replace("\xa0", " ")
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

def save_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")

def html_to_text(path: Path) -> str:
    html = path.read_text(encoding="utf-8", errors="ignore")
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    return normalize_whitespace(text)

def txt_to_text(path: Path) -> str:
    return normalize_whitespace(path.read_text(encoding="utf-8", errors="ignore"))

# ── Filing reading ───────────────────────────────────────────────────────────

def read_filing_text(filing_dir: Path) -> str:
    html_path = filing_dir / "primary-document.html"
    txt_path = filing_dir / "full-submission.txt"
    if html_path.exists():
        return html_to_text(html_path)
    if txt_path.exists():
        return txt_to_text(txt_path)
    raise FileNotFoundError(f"No filing file found in {filing_dir}")

def find_latest_two_10k_dirs(bank_dir: Path):
    tenk_dir = bank_dir / "10-K"
    if not tenk_dir.exists():
        return []
    dirs = [p for p in tenk_dir.iterdir() if p.is_dir()]
    dirs.sort(key=lambda p: p.name)
    return dirs[-2:]

# ── Section extraction ───────────────────────────────────────────────────────

def _is_toc_entry(text: str, match_end: int) -> bool:
    """Detect if a heading match is a Table of Contents entry rather than the
    actual section body.  TOC entries are followed (within a few lines) by a
    bare page number and then the next 'Item' or 'Part' heading."""
    after = text[match_end:match_end + 300]
    lines = after.split("\n")
    for line in lines[:6]:
        stripped = line.strip()
        if re.match(r"^\d{1,3}$", stripped):
            return True
        if len(stripped.split()) > 15:
            return False
    return False

def _is_inline_ref(text: str, match_start: int) -> bool:
    """Detect if a heading match is an inline reference inside a sentence
    (e.g. 'see Item 7A. Quantitative…').  Real headings start at the
    beginning of a line, optionally after 'PART I' etc."""
    if match_start == 0:
        return False
    before = text[max(0, match_start - 5):match_start]
    return "\n" not in before

def first_match_span(text: str, patterns):
    """Find the first REAL section heading, skipping TOC entries and inline
    references."""
    for pattern in patterns:
        for m in re.finditer(pattern, text, flags=re.IGNORECASE):
            if _is_inline_ref(text, m.start()):
                continue
            if _is_toc_entry(text, m.end()):
                continue
            return m.span()
    return None

def extract_sections(text: str):
    lower = text.lower()
    item1_span = first_match_span(lower, SECTION_PATTERNS["item1"])
    item1a_span = first_match_span(lower, SECTION_PATTERNS["item1a"])
    item7_span = first_match_span(lower, SECTION_PATTERNS["item7"])
    item7a_span = first_match_span(lower, SECTION_PATTERNS["item7a"])

    sections = {}

    if item1_span:
        start = item1_span[0]
        end = item1a_span[0] if item1a_span else (item7_span[0] if item7_span else min(len(text), start + 120000))
        sections["item1"] = text[start:end]

    if item7_span:
        start = item7_span[0]
        end = item7a_span[0] if item7a_span else min(len(text), start + 160000)
        sections["item7"] = text[start:end]

    if "item1" not in sections:
        sections["item1"] = text[:120000]

    if "item7" not in sections:
        mid = len(text) // 2
        sections["item7"] = text[mid:min(len(text), mid + 120000)]

    return sections

# ── Paragraph splitting & cleanup ────────────────────────────────────────────

def is_junk_paragraph(p: str) -> bool:
    words = p.split()
    if len(words) < 25:
        return True
    digits = len(re.findall(r"\b\d[\d,.\-]*\b", p))
    if digits > 25 and len(words) < 120:
        return True
    junk_phrases = [
        "table of contents",
        "united states securities and exchange commission",
        "commission file number",
        "form 10-k",
        "page",
    ]
    p_lower = p.lower()
    if sum(phrase in p_lower for phrase in junk_phrases) >= 2:
        return True
    return False

def split_paragraphs(text: str):
    raw_parts = re.split(r"\n\s*\n+", text)
    paras = []
    for p in raw_parts:
        p = normalize_whitespace(p)
        if p and not is_junk_paragraph(p):
            paras.append(p)
    return paras

# ── Scoring ──────────────────────────────────────────────────────────────────

def cosine_similarity_matrix(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    a = a / np.linalg.norm(a, axis=1, keepdims=True)
    b = b / np.linalg.norm(b, axis=1, keepdims=True)
    return a @ b.T

def keyword_bonus(paragraph: str) -> float:
    p = paragraph.lower()
    groups_hit = 0
    for terms in KEYWORD_GROUPS.values():
        if any(term.lower() in p for term in terms):
            groups_hit += 1
    return 0.04 * groups_hit

def score_paragraphs(paragraphs, section_name, filing_label, embed_model, query_embeddings):
    para_embeddings = embed_model.encode(
        paragraphs,
        convert_to_numpy=True,
        normalize_embeddings=False,
        show_progress_bar=False,
    )
    sims = cosine_similarity_matrix(para_embeddings, query_embeddings)

    rows = []
    for i, p in enumerate(paragraphs):
        max_sim = float(sims[i].max())
        hits_above_threshold = int((sims[i] > 0.42).sum())
        semantic_bonus = 0.02 * hits_above_threshold
        kw_bonus = keyword_bonus(p)
        section_bonus = 0.08 if section_name in {"item1", "item7"} else 0.0

        rows.append({
            "idx": i,
            "paragraph": p,
            "score": max_sim + semantic_bonus + kw_bonus + section_bonus,
            "section": section_name,
            "filing": filing_label,
            "word_count": len(p.split()),
        })
    return rows

# ── Selection with context ───────────────────────────────────────────────────

def select_with_context(paragraphs, scored_rows, min_words=1200, max_words=1700):
    scored_rows = sorted(scored_rows, key=lambda x: x["score"], reverse=True)
    chosen = set()
    total_words = 0

    for row in scored_rows:
        center = row["idx"]
        window = [center - 1, center, center + 1]

        for j in window:
            if 0 <= j < len(paragraphs) and j not in chosen:
                wc = len(paragraphs[j].split())
                if total_words + wc > max_words:
                    continue
                chosen.add(j)
                total_words += wc

        if total_words >= min_words:
            break

    return sorted(chosen)

# ── Build excerpts ───────────────────────────────────────────────────────────

def build_excerpt_for_filing(text, filing_label, embed_model, query_embeddings, hard_cap_words=3000):
    sections = extract_sections(text)
    all_selected_paras = []
    debug_rows = []

    for sec_name in ["item1", "item7"]:
        paras = split_paragraphs(sections.get(sec_name, ""))
        if not paras:
            continue

        scored = score_paragraphs(paras, sec_name, filing_label, embed_model, query_embeddings)
        debug_rows.extend(scored)

        selected_idxs = select_with_context(
            paragraphs=paras,
            scored_rows=scored,
            min_words=1200,
            max_words=1700,
        )

        all_selected_paras.extend([
            f"[{filing_label} | {sec_name}] {paras[i]}" for i in selected_idxs
        ])

    excerpt = "\n\n".join(all_selected_paras)
    words = excerpt.split()
    if len(words) > hard_cap_words:
        excerpt = " ".join(words[:hard_cap_words])

    return excerpt, debug_rows

def build_bank_excerpt(filing_texts, embed_model, min_words=3000, max_words=6000):
    query_embeddings = embed_model.encode(
        QUERY_PHRASES,
        convert_to_numpy=True,
        normalize_embeddings=False,
        show_progress_bar=False,
    )

    all_chunks = []
    all_debug = []
    per_filing_cap = max_words // max(1, len(filing_texts))

    for filing_label, filing_text in filing_texts:
        excerpt, debug_rows = build_excerpt_for_filing(
            text=filing_text,
            filing_label=filing_label,
            embed_model=embed_model,
            query_embeddings=query_embeddings,
            hard_cap_words=max(2200, per_filing_cap),
        )
        all_chunks.append(excerpt)
        all_debug.extend(debug_rows)

    combined = "\n\n".join(chunk for chunk in all_chunks if chunk.strip())
    words = combined.split()

    if len(words) < min_words:
        global_rows = sorted(all_debug, key=lambda x: x["score"], reverse=True)
        existing = set()
        extra_parts = [combined] if combined.strip() else []
        current_words = len(words)

        for row in global_rows:
            para = f"[{row['filing']} | {row['section']}] {row['paragraph']}"
            if para in existing:
                continue
            wc = len(para.split())
            if current_words + wc > max_words:
                continue
            extra_parts.append(para)
            existing.add(para)
            current_words += wc
            if current_words >= min_words:
                break

        combined = "\n\n".join(part for part in extra_parts if part.strip())

    words = combined.split()
    if len(words) > max_words:
        combined = " ".join(words[:max_words])

    return combined

# ── Gemini client & report generation ────────────────────────────────────────

def get_gemini_client():
    if not os.getenv("GEMINI_API_KEY"):
        raise EnvironmentError("GEMINI_API_KEY is not set.")
    return genai.Client()

def generate_report_with_gemini(client, bank_name, idrssd, excerpt, model_name=GEMINI_MODEL_NAME, max_retries=4):
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(bank_name=bank_name)
    prompt = f"""
Bank: {bank_name}
IDRSSD: {idrssd}

Curated filing excerpts:
{excerpt}
"""
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config={
                    "system_instruction": system_prompt,
                    "temperature": 0.2,
                },
            )
            return response.text.strip()
        except Exception as e:
            if "429" in str(e) and attempt < max_retries - 1:
                wait = 50 * (attempt + 1)
                print(f"    Rate limited, waiting {wait}s (attempt {attempt+1}/{max_retries})...")
                time.sleep(wait)
            else:
                raise

def parse_score(report_text):
    m = re.search(r"Score:\s*(\d{1,2})\s*/\s*10", report_text, flags=re.IGNORECASE)
    return int(m.group(1)) if m else None

# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("Loading embedding model...")
    embed_model = SentenceTransformer(EMBED_MODEL_NAME)

    print("Initializing Gemini client...")
    client = get_gemini_client()

    summary_rows = []
    failures = []

    for ticker in TICKERS_TO_RUN:
        if ticker not in BANKS:
            print(f"[SKIP] Unknown ticker: {ticker}")
            continue

        bank_meta = BANKS[ticker]
        bank_dir = ROOT_DIR / ticker

        print(f"\nProcessing {ticker} - {bank_meta['name']}")

        try:
            tenk_dirs = find_latest_two_10k_dirs(bank_dir)
            if not tenk_dirs:
                raise FileNotFoundError(f"No 10-K folders found for {ticker}")

            filing_texts = []
            used_folders = []

            for filing_dir in tenk_dirs:
                text = read_filing_text(filing_dir)
                filing_texts.append((filing_dir.name, text))
                used_folders.append(filing_dir.name)

            excerpt = build_bank_excerpt(
                filing_texts=filing_texts,
                embed_model=embed_model,
                min_words=3000,
                max_words=6000,
            )

            report = generate_report_with_gemini(
                client=client,
                bank_name=bank_meta["name"],
                idrssd=bank_meta["idrssd"],
                excerpt=excerpt,
            )

            excerpt_path = OUTPUT_DIR / "curated_excerpts" / f"{ticker}_excerpt.txt"
            report_path = OUTPUT_DIR / "reports" / f"{ticker}_private_credit_report.md"

            save_text(excerpt_path, excerpt)
            save_text(report_path, report)

            row = {
                "ticker": ticker,
                "bank_name": bank_meta["name"],
                "idrssd": bank_meta["idrssd"],
                "score": parse_score(report),
                "filings_used": used_folders,
                "excerpt_words": len(excerpt.split()),
                "excerpt_path": str(excerpt_path),
                "report_path": str(report_path),
            }
            summary_rows.append(row)

            print(f"  Filings used: {used_folders}")
            print(f"  Excerpt words: {row['excerpt_words']}")
            print(f"  Score: {row['score']}")
            print(f"  Report saved: {report_path}")

            time.sleep(15)

        except Exception as e:
            failures.append({"ticker": ticker, "error": str(e)})
            print(f"  ERROR: {e}")

    # Save summary
    summary = {
        "completed": summary_rows,
        "failures": failures,
    }
    summary_path = OUTPUT_DIR / "summary.json"
    save_text(summary_path, json.dumps(summary, indent=2))

    print(f"\n{'='*60}")
    print(f"Done. {len(summary_rows)} succeeded, {len(failures)} failed.")
    print(f"Summary saved to {summary_path}")

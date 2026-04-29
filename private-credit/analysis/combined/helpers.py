"""
helpers.py — Text processing, semantic search, and data source readers
======================================================================
Contains all the helper functions used by combined_pc_analysis.py:
  - Step 2: Text utilities (cleaning HTML, normalizing whitespace, filtering junk)
  - Step 3: Semantic search engine (embeddings, cosine similarity, scoring, context selection)
  - Step 4: 10-K section extraction (regex-based Item 1 / Item 7 detection)
  - Step 4b: Source readers (10-K, 10-Q/8-K, transcripts, call reports)
"""

import re
import numpy as np
import pandas as pd
from pathlib import Path
from bs4 import BeautifulSoup


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: TEXT UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════
# These functions clean up raw text from different file formats so it's ready for
# paragraph splitting and semantic scoring. SEC filings come in messy HTML and raw
# text formats with lots of noise (extra whitespace, HTML tags, base64-encoded
# images, boilerplate headers). These utilities normalize all of that.
# ═══════════════════════════════════════════════════════════════════════════════

def normalize_whitespace(text: str) -> str:
    """Clean up whitespace: convert non-breaking spaces, normalize line endings,
    collapse multiple spaces/blank lines into single ones."""
    text = text.replace("\xa0", " ")        # non-breaking space -> regular space
    text = re.sub(r"\r\n?", "\n", text)     # Windows/Mac line endings -> Unix
    text = re.sub(r"[ \t]+", " ", text)     # collapse multiple spaces/tabs
    text = re.sub(r"\n{3,}", "\n\n", text)  # collapse 3+ newlines into 2
    return text.strip()


def html_to_text(path: Path) -> str:
    """Convert an HTML filing (primary-document.html) to clean plain text.
    Uses BeautifulSoup to strip all HTML tags, scripts, and styles."""
    html = path.read_text(encoding="utf-8", errors="ignore")
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()  # remove these tags entirely
    text = soup.get_text(separator="\n")
    return normalize_whitespace(text)


def txt_to_text(path: Path) -> str:
    """Read a plain text filing (full-submission.txt) and normalize whitespace."""
    return normalize_whitespace(path.read_text(encoding="utf-8", errors="ignore"))


def clean_sec_text(raw_text: str) -> str:
    """Keyword_match_method's cleaner for raw SEC submission files.
    Strips HTML/XML tags and removes long base64-encoded strings (embedded images/PDFs)
    that would otherwise pollute the text and waste tokens."""
    clean = re.sub(r"<[^>]+>", " ", raw_text)              # strip HTML tags
    clean = re.sub(r"[A-Za-z0-9+/=]{100,}", " ", clean)   # strip base64 blobs
    return re.sub(r"\s+", " ", clean).strip()               # collapse whitespace


def is_junk_paragraph(p: str) -> bool:
    """Detect and filter out low-quality paragraphs that won't help the analysis.
    Filters: too short (<25 words), too many numbers (likely a data table),
    or contains SEC boilerplate phrases (table of contents, form headers, etc.)."""
    words = p.split()
    if len(words) < 25:
        return True
    # Tables with lots of numbers but few words
    digits = len(re.findall(r"\b\d[\d,.\-]*\b", p))
    if digits > 25 and len(words) < 120:
        return True
    # SEC boilerplate detection
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


def split_paragraphs(text: str) -> list:
    """Split text into paragraphs (on double newlines) and filter out junk.
    Returns a list of clean, meaningful paragraphs ready for scoring."""
    raw_parts = re.split(r"\n\s*\n+", text)
    paras = []
    for p in raw_parts:
        p = normalize_whitespace(p)
        if p and not is_junk_paragraph(p):
            paras.append(p)
    return paras


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: SEMANTIC SEARCH ENGINE (from Semantic_similarity_method)
# ═══════════════════════════════════════════════════════════════════════════════
# This is the core intelligence of the pipeline. Instead of just searching for
# keywords (which misses paraphrased content), we use AI embeddings to understand
# the MEANING of each paragraph.
#
# How it works:
#   1. We convert our query phrases (what we're looking for) into numerical vectors
#   2. We convert every paragraph from the filings into numerical vectors
#   3. We compute cosine similarity between each paragraph and each query
#   4. Paragraphs whose meaning is closest to our queries get the highest scores
#   5. We add small bonuses for exact keyword matches and important sections
#   6. We select the top-scoring paragraphs (with neighboring context) for the dossier
# ═══════════════════════════════════════════════════════════════════════════════

def cosine_similarity_matrix(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Compute cosine similarity between two sets of embedding vectors.
    Returns a matrix where entry [i,j] = similarity between a[i] and b[j].
    Values range from -1 (opposite) to 1 (identical meaning)."""
    a = a / np.linalg.norm(a, axis=1, keepdims=True)  # normalize to unit vectors
    b = b / np.linalg.norm(b, axis=1, keepdims=True)
    return a @ b.T  # dot product of normalized vectors = cosine similarity


def keyword_bonus(paragraph: str, keyword_groups: dict) -> float:
    """Give a small score boost (+0.04) for each keyword group that has at least
    one match in the paragraph. If a paragraph mentions terms from 3 groups,
    it gets +0.12. This helps surface paragraphs with exact terminology."""
    p = paragraph.lower()
    groups_hit = 0
    for terms in keyword_groups.values():
        if any(term.lower() in p for term in terms):
            groups_hit += 1
    return 0.04 * groups_hit


def score_paragraphs(paragraphs, section_name, filing_label, embed_model, query_embeddings, keyword_groups):
    """Score each paragraph for relevance to private credit.
    The final score combines:
      - Semantic similarity: how close the paragraph's meaning is to our queries (main signal)
      - Semantic bonus: +0.02 for each query that scores above 0.42 threshold
      - Keyword bonus: +0.04 per keyword group matched (exact term matching)
      - Section bonus: +0.08 if paragraph is from Item 1 or Item 7 (most important 10-K sections)
    Returns a list of dicts with paragraph text, score, metadata."""
    if not paragraphs:
        return []
    # Convert paragraphs to embedding vectors using the sentence-transformer model
    para_embeddings = embed_model.encode(
        paragraphs,
        convert_to_numpy=True,
        normalize_embeddings=False,
        show_progress_bar=False,
    )
    # Compare every paragraph against every query phrase
    sims = cosine_similarity_matrix(para_embeddings, query_embeddings)

    rows = []
    for i, p in enumerate(paragraphs):
        max_sim = float(sims[i].max())                          # best match across all queries
        hits_above_threshold = int((sims[i] > 0.42).sum())      # how many queries match well
        semantic_bonus = 0.02 * hits_above_threshold
        kw_bonus = keyword_bonus(p, keyword_groups)
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


def select_with_context(paragraphs, scored_rows, min_words=1200, max_words=1700):
    """Select the highest-scoring paragraphs AND their neighbors (before/after).
    Including neighboring paragraphs preserves context so the LLM sees coherent
    excerpts instead of isolated sentences. Stops when we hit the word budget."""
    ranked = sorted(scored_rows, key=lambda x: x["score"], reverse=True)
    selected_indices = set()
    current_word_count = 0

    for row in ranked:
        idx = row["idx"]
        if idx in selected_indices:
            continue

        # Build a cluster: the paragraph + its immediate neighbors
        cluster = {idx}
        if idx > 0:
            cluster.add(idx - 1)
        if idx < len(paragraphs) - 1:
            cluster.add(idx + 1)

        new_indices = cluster - selected_indices
        cluster_words = sum(len(paragraphs[i].split()) for i in new_indices)

        if current_word_count + cluster_words > max_words:
            if not selected_indices:
                # If nothing selected yet, at least take the top paragraph
                selected_indices.add(idx)
                current_word_count += len(paragraphs[idx].split())
            break

        selected_indices.update(cluster)
        current_word_count += cluster_words

        if current_word_count >= min_words:
            break

    return sorted(list(selected_indices))


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4: 10-K SECTION EXTRACTION (from Semantic_similarity_method)
# ═══════════════════════════════════════════════════════════════════════════════
# 10-K annual reports are very long (often 200+ pages). We don't want to score
# the entire document — that would be slow and noisy. Instead, we extract just
# the two most important sections:
#   - Item 1 (Business): Describes what the bank does, its business lines
#   - Item 7 (MD&A): Management's discussion of financial results and strategy
# We use regex to find where these sections start and end, then only process
# the text within those boundaries.
# ═══════════════════════════════════════════════════════════════════════════════

def first_match_span(text: str, patterns):
    """Try each regex pattern in order and return the (start, end) position
    of the first match found. Returns None if no pattern matches."""
    for pattern in patterns:
        m = re.search(pattern, text, flags=re.IGNORECASE)
        if m:
            return m.span()
    return None


def extract_sections(text: str, section_patterns: dict) -> dict:
    """Extract Item 1 and Item 7 sections from a 10-K filing.
    Uses section heading patterns to find boundaries. If exact headings aren't
    found, falls back to approximate slices (first 120K chars for Item 1,
    middle of document for Item 7) so the pipeline can still proceed."""
    lower = text.lower()
    item1_span = first_match_span(lower, section_patterns["item1"])
    item1a_span = first_match_span(lower, section_patterns["item1a"])
    item7_span = first_match_span(lower, section_patterns["item7"])
    item7a_span = first_match_span(lower, section_patterns["item7a"])

    sections = {}
    # Item 1: from "Item 1" heading to "Item 1A" (or Item 7 if 1A not found)
    if item1_span:
        start = item1_span[0]
        end = item1a_span[0] if item1a_span else (item7_span[0] if item7_span else min(len(text), start + 120000))
        sections["item1"] = text[start:end]
    # Item 7: from "Item 7" heading to "Item 7A"
    if item7_span:
        start = item7_span[0]
        end = item7a_span[0] if item7a_span else min(len(text), start + 160000)
        sections["item7"] = text[start:end]
    # Fallbacks if section headings weren't found
    if "item1" not in sections:
        sections["item1"] = text[:120000]
    if "item7" not in sections:
        mid = len(text) // 2
        sections["item7"] = text[mid : min(len(text), mid + 120000)]
    return sections


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4b: SOURCE READERS
# ═══════════════════════════════════════════════════════════════════════════════
# These functions read from each of the 4 data sources and return paragraphs
# ready for semantic scoring. Each reader handles the specific format and
# directory structure of its source:
#   - read_10k_paragraphs:          10-K annual reports (HTML with section extraction)
#   - read_other_sec_paragraphs:    10-Q quarterly & 8-K event filings (keyword pre-filtered)
#   - read_transcript_paragraphs:   Earnings call transcripts (plain text)
#   - read_call_report_text:        FDIC call reports (CSV with specific MDRM codes)
# ═══════════════════════════════════════════════════════════════════════════════

def read_filing_text(filing_dir: Path) -> str:
    """Read a single filing from its directory. Prefers the parsed HTML
    (primary-document.html) over raw text (full-submission.txt) since
    HTML parsing gives cleaner output."""
    html_path = filing_dir / "primary-document.html"
    txt_path = filing_dir / "full-submission.txt"
    if html_path.exists():
        return html_to_text(html_path)
    if txt_path.exists():
        return txt_to_text(txt_path)
    return ""


def read_10k_paragraphs(ticker: str, sec_dir: Path, section_patterns: dict) -> list:
    """Read the 2 most recent 10-K filings for a bank.
    For each filing: parse HTML -> extract Item 1 & Item 7 sections ->
    split into paragraphs -> return with labels for scoring."""
    tenk_dir = sec_dir / ticker / "10-K"
    if not tenk_dir.exists():
        return []
    dirs = sorted([p for p in tenk_dir.iterdir() if p.is_dir()], key=lambda p: p.name)
    dirs = dirs[-2:]  # take the latest 2 filings

    labeled_paras = []
    for filing_dir in dirs:
        text = read_filing_text(filing_dir)
        if not text:
            continue
        sections = extract_sections(text, section_patterns)
        for sec_name in ["item1", "item7"]:
            sec_text = sections.get(sec_name, "")
            paras = split_paragraphs(sec_text)
            for p in paras:
                # Each paragraph is tagged with (text, section_name, filing_label)
                labeled_paras.append((p, sec_name, f"10-K/{filing_dir.name}"))
    return labeled_paras


def has_keywords(text: str, target_keywords: list) -> bool:
    """Fast keyword pre-filter (from Keyword_match_method). Checks if any private credit
    keyword exists anywhere in the text. Used to quickly skip irrelevant
    10-Q/8-K filings before doing expensive semantic scoring."""
    text_lower = text.lower()
    return any(kw.lower() in text_lower for kw in target_keywords)


def read_other_sec_paragraphs(ticker: str, sec_dir: Path, target_keywords: list) -> list:
    """Read 10-Q (quarterly) and 8-K (event) filings.
    Unlike 10-K processing, we use a keyword pre-filter first (from Keyword_match_method)
    because most 8-K filings are about unrelated events (board changes, etc.)
    and we don't want to waste time scoring them semantically."""
    labeled_paras = []
    for filing_type in ["10-Q", "8-K"]:
        type_dir = sec_dir / ticker / filing_type
        if not type_dir.exists():
            continue
        for filing_dir in sorted(type_dir.iterdir()):
            if not filing_dir.is_dir():
                continue
            txt_path = filing_dir / "full-submission.txt"
            if not txt_path.exists():
                continue
            try:
                raw = txt_path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            # FAST CHECK: skip files with zero keyword matches
            if not has_keywords(raw, target_keywords):
                continue
            # Clean the raw submission (strip HTML tags, base64) then split
            cleaned = clean_sec_text(raw)
            paras = split_paragraphs(cleaned)
            for p in paras:
                labeled_paras.append((p, filing_type.lower(), f"{filing_type}/{filing_dir.name}"))
    return labeled_paras


def read_transcript_paragraphs(ticker: str, transcript_dir: Path) -> list:
    """Read earnings call transcripts from transcripts_final/ directory.
    Files are named like ALLY_2024_Q1.txt. We read all available quarters
    and split into paragraphs for semantic scoring."""
    labeled_paras = []
    if not transcript_dir.exists():
        return labeled_paras
    for file in sorted(transcript_dir.glob(f"{ticker}_*.txt")):
        try:
            text = file.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        paras = split_paragraphs(text)
        for p in paras:
            labeled_paras.append((p, "transcript", file.name))
    return labeled_paras


def read_call_report_text(ticker: str, bank_info: dict, call_report_dir: Path, mdrm_mapping: dict) -> str:
    """Extract quantitative data from FDIC call reports (Schedule RC-C).
    Looks up the bank by name in each quarterly CSV file and extracts
    RCFD1460 (loans to business credit intermediaries). This adds hard
    numbers to complement the qualitative text from filings/transcripts."""
    aliases = [a.lower() for a in bank_info["call_report_aliases"]]
    aliases.append(ticker.lower())
    lines = [f"### CALL REPORT DATA FOR {bank_info['name']} ###"]

    if not call_report_dir.exists():
        return ""

    for csv_file in sorted(call_report_dir.glob("*.csv")):
        try:
            # Read just the header first to check which columns exist
            header = pd.read_csv(csv_file, nrows=0).columns.tolist()
            if "Financial Institution Name" not in header:
                continue
            cols_to_read = ["Financial Institution Name"] + [c for c in mdrm_mapping if c in header]
            if len(cols_to_read) < 2:
                continue
            # Read only the columns we need (much faster than reading full CSV)
            df = pd.read_csv(csv_file, usecols=cols_to_read, low_memory=False)
            # Find rows matching our bank's name aliases
            names_lower = df["Financial Institution Name"].astype(str).str.lower()
            mask = names_lower.str.contains("|".join(aliases), na=False)
            bank_rows = df[mask]
            if bank_rows.empty:
                continue
            row = bank_rows.iloc[0]
            period = csv_file.stem  # e.g. "20241231"
            for code, label in mdrm_mapping.items():
                if code in row.index and pd.notna(row[code]):
                    val = float(row[code])
                    if val > 0:
                        lines.append(f"- {period} {label}: ${val:,.0f}")
        except Exception:
            continue

    if len(lines) <= 1:
        return ""  # no data found
    return "\n".join(lines)

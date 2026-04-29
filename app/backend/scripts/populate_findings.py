"""Extract per-bank private-credit findings into the ``pc_finding`` table.

For each bank, we pull a curated set of PC-tagged chunks (top by topic
confidence, biased toward narrative sections that talk about strategy /
risk / private credit), then ask the configured LLM (Gemini, with an
extractive fallback when ``LLM_PROVIDER=none``) to return a single JSON
object with the structured fields the ``/findings`` endpoint serves.

Run:

    python backend/scripts/populate_findings.py            # all banks
    python backend/scripts/populate_findings.py JPM BAC    # specific tickers
    python backend/scripts/populate_findings.py --rerun    # overwrite existing rows

The ``/compare`` page's Strategy + Quote-faceoff panels read the rows
this script writes — until at least one row exists per selected bank,
those panels show a "pipeline not run" banner.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from pc_analyst.config import settings
from pc_analyst.db import cursor, render_sql, fetchall_dicts


# ── Config ────────────────────────────────────────────────────────────────────

# How many chunks per bank to feed the LLM. Each chunk excerpt is capped at
# CHUNK_CHAR_CAP, so the upper bound on prompt size is roughly
# MAX_CHUNKS * CHUNK_CHAR_CAP ≈ 50 * 800 = 40K chars of evidence.
MAX_CHUNKS = 50
CHUNK_CHAR_CAP = 800

# Doc-type weights — boost the section types most likely to contain
# strategy / risk language. Anything not listed defaults to 0.5.
DOC_TYPE_WEIGHT = {
    "10-K": 1.4,
    "10-Q": 1.2,
    "prepared_remarks": 1.5,
    "8-K": 0.7,
}

# Section-header substrings that earn a small boost.
SECTION_BOOSTS = (
    ("risk factor", 0.3),
    ("management's discussion", 0.4),
    ("md&a", 0.4),
    ("business strategy", 0.5),
    ("commercial banking", 0.2),
    ("non-bank", 0.4),
    ("private credit", 0.6),
    ("nbfi", 0.5),
)


# ── LLM call ──────────────────────────────────────────────────────────────────

EXTRACTOR_SYSTEM_PROMPT = """You are a financial analyst extracting *structured* private-credit findings
from a single bank's recent SEC filings and earnings-call prepared remarks.

You will receive a bank ticker, name, and a numbered list of evidence
passages. Use ONLY those passages to populate the JSON below. Quote
spans must be copied verbatim from the evidence (no paraphrasing inside
quote strings). If a field has no support, return an empty string for
strings, an empty list for arrays, or null for numbers.

Return ONLY a JSON object with this exact shape (no prose, no markdown
fences):

{
  "rating": <integer 1-5, overall importance the bank places on private credit / NBFI lending>,
  "involvement_rating": <integer 1-5, how *active* the bank is in originating private credit; 5 = a primary focus, 1 = barely mentioned>,
  "mention_frequency": "<one of: high | medium | low>",
  "sentiment": "<one of: positive | cautious | neutral | negative>",
  "key_themes": ["short noun phrase", ...  up to 6 entries],
  "strategic_initiatives": "<2-4 sentences describing concrete strategic moves the bank has disclosed (deals, partnerships, capacity expansions, etc.)>",
  "perceived_risks": "<2-4 sentences on the risks the bank itself flags around private credit / NBFI exposure>",
  "notable_quotes": [
    {"quote": "<verbatim sentence from evidence>", "topic": "<one of the key_themes>", "source": "<doc_type and quarter, e.g. 10-K 2024 or prepared_remarks 2024Q3>"},
    ... up to 5 entries, prefer one per distinct theme
  ],
  "pullback_mentions": "<one short sentence — does the bank discuss tightening/pulling back on private credit, or expanding? if not discussed, empty string>",
  "named_competitors": "<comma-separated list of named direct lenders, BDCs, or asset managers the bank mentions; empty string if none>",
  "risk_focus_analysis": "<2-3 sentences interpreting which categories of risk dominate this bank's disclosures (concentration, credit quality, valuation, governance, etc.)>"
}

Rules:
- Strict JSON. Numbers as integers. No trailing commas. No comments.
- key_themes are short — e.g. "leveraged lending", "asset-based finance", "BDC partnerships". Lowercase first letter.
- notable_quotes prefer the most distinctive language (one strategic, one risk, one competitive if available). Each quote ≤ 280 chars.
- If the evidence is sparse, return small numbers and shorter strings rather than inventing detail.
"""


def _gemini_call(prompt: str) -> str:
    """One-shot Gemini call returning the raw text. Retries on rate limit."""
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is empty; cannot call Gemini.")

    # Gemini 2.5 Flash burns ~2K tokens of internal "thinking" against the
    # output budget before emitting visible content. We need headroom on top
    # of the visible JSON (which fits comfortably in ~700 tokens). 6144 was
    # selected after observing ~2400 thinking + ~700 answer in practice.
    payload = json.dumps({
        "system_instruction": {"parts": [{"text": EXTRACTOR_SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "maxOutputTokens": 6144,
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }).encode()

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.gemini_model}:generateContent?key={settings.gemini_api_key}"
    )

    last_err: Exception | None = None
    for attempt in range(4):
        try:
            req = urllib.request.Request(
                url, data=payload, headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.loads(resp.read())
            cand = data["candidates"][0]
            return cand["content"]["parts"][0]["text"]
        except urllib.error.HTTPError as e:
            last_err = e
            # Back off on 429 / 5xx, fail fast on 4xx body issues.
            if e.code in (429, 500, 502, 503, 504):
                wait = 2 ** attempt
                print(f"  Gemini HTTP {e.code} — retrying in {wait}s", flush=True)
                time.sleep(wait)
                continue
            body = ""
            try:
                body = e.read().decode("utf-8", "replace")[:500]
            except Exception:
                pass
            raise RuntimeError(f"Gemini HTTP {e.code}: {body}") from e
        except Exception as e:
            last_err = e
            time.sleep(1 + attempt)
    raise RuntimeError(f"Gemini call failed after retries: {last_err}")


def _strip_json(text: str) -> str:
    """Tolerantly extract the JSON object from a model response."""
    s = text.strip()
    # Strip ```json … ``` fences if present.
    s = re.sub(r"^```(?:json)?\s*", "", s)
    s = re.sub(r"\s*```$", "", s)
    # Find the outermost {...} if there's any leading prose.
    m = re.search(r"\{[\s\S]*\}", s)
    return m.group(0) if m else s


# ── Evidence selection ────────────────────────────────────────────────────────

def fetch_pc_chunks(ticker: str) -> list[dict[str, Any]]:
    """Top PC-tagged chunks for a bank, ranked by a section/doctype/confidence
    composite, capped at MAX_CHUNKS."""
    with cursor() as (_handle, cur):
        cur.execute(
            render_sql(
                """
                SELECT
                    c.id           AS chunk_id,
                    c.text         AS text,
                    c.section_header AS section_header,
                    d.doc_type     AS doc_type,
                    d.fiscal_year  AS fiscal_year,
                    d.fiscal_quarter AS fiscal_quarter,
                    ct.confidence  AS confidence
                FROM chunk c
                JOIN document d ON d.id = c.document_id
                JOIN chunk_topic ct ON ct.chunk_id = c.id
                WHERE d.bank_ticker = ?
                  AND ct.theme = 'private_credit'
                  AND length(c.text) > 120
                ORDER BY ct.confidence DESC
                LIMIT 400
                """
            ),
            (ticker,),
        )
        rows = fetchall_dicts(cur)

    def score(r: dict[str, Any]) -> float:
        s = float(r.get("confidence") or 0.0)
        s += DOC_TYPE_WEIGHT.get(r.get("doc_type") or "", 0.5)
        sh = (r.get("section_header") or "").lower()
        for needle, boost in SECTION_BOOSTS:
            if needle in sh:
                s += boost
                break
        # Slight recency tilt.
        fy = r.get("fiscal_year") or 0
        s += 0.04 * max(0, fy - 2020)
        return s

    rows.sort(key=score, reverse=True)
    # De-dupe near-identical chunks (same first 80 chars).
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for r in rows:
        key = (r.get("text") or "")[:80].lower().strip()
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
        if len(out) >= MAX_CHUNKS:
            break
    return out


def build_prompt(ticker: str, name: str, chunks: list[dict[str, Any]]) -> str:
    lines = [
        f"BANK: {ticker} — {name}",
        f"Number of evidence passages: {len(chunks)}",
        "",
        "EVIDENCE:",
    ]
    for i, c in enumerate(chunks, 1):
        text = (c.get("text") or "").strip()
        if len(text) > CHUNK_CHAR_CAP:
            text = text[: CHUNK_CHAR_CAP - 1].rstrip() + "…"
        text = re.sub(r"\s+", " ", text)
        fy = c.get("fiscal_year")
        fq = c.get("fiscal_quarter")
        tag = f"{c.get('doc_type')} {fy}Q{fq}" if fy and fq else (c.get("doc_type") or "")
        sec = c.get("section_header") or ""
        lines.append(f"[{i}] ({tag} | {sec}) {text}")
    lines.append("")
    lines.append(
        "Return the JSON object now. Strict JSON only — no prose, no markdown."
    )
    return "\n".join(lines)


# ── Extractive fallback ───────────────────────────────────────────────────────

# When no LLM is configured we still want SOMETHING useful in the table so the
# UI panels render. Build a minimal finding from heuristic scans of the top
# PC-tagged chunks. Far less precise than the LLM path, but it unblocks the UI.

PULLBACK_PAT = re.compile(r"(pull[- ]?back|tightening|reduce(?:d)? exposure|stricter underwriting|de-?risk|trimming)", re.I)
EXPANSION_PAT = re.compile(r"(expand(?:ed|ing)?|grow(?:ing)? our|launched|new platform|partnership with)", re.I)
COMPETITOR_PAT = re.compile(
    r"\b(Apollo|Ares|Blackstone|KKR|Carlyle|Blue Owl|Golub|Antares|Sixth Street|Oaktree|Owl Rock|HPS|Monroe Capital|Goldman|Morgan Stanley)\b"
)
THEME_KEYWORDS = [
    ("leveraged lending", re.compile(r"leveraged loan|leveraged lending", re.I)),
    ("nbfi exposure", re.compile(r"non[- ]?bank financial|NBFI", re.I)),
    ("direct lending", re.compile(r"direct lending|private credit fund", re.I)),
    ("BDC partnerships", re.compile(r"BDC|business development compan", re.I)),
    ("asset-based finance", re.compile(r"asset[- ]based finance|ABF\b", re.I)),
    ("fund finance", re.compile(r"fund finance|subscription line", re.I)),
    ("warehouse lending", re.compile(r"warehouse (lending|line|facility)", re.I)),
    ("CRE financing", re.compile(r"commercial real estate|CRE\b", re.I)),
]


def extractive_finding(ticker: str, name: str, chunks: list[dict[str, Any]]) -> dict[str, Any]:
    text_blob = "\n".join((c.get("text") or "") for c in chunks)
    themes = [label for label, pat in THEME_KEYWORDS if pat.search(text_blob)][:6]
    pullback_hits = PULLBACK_PAT.findall(text_blob)
    expand_hits = EXPANSION_PAT.findall(text_blob)
    comps = sorted(set(COMPETITOR_PAT.findall(text_blob)))

    # Pick up to 5 distinctive sentences as quotes.
    quotes: list[dict[str, str]] = []
    for c in chunks:
        if len(quotes) >= 5:
            break
        sents = re.split(r"(?<=[.!?])\s+", (c.get("text") or "").strip())
        for s in sents:
            if 80 <= len(s) <= 280 and any(p.search(s) for _, p in THEME_KEYWORDS):
                fy = c.get("fiscal_year")
                fq = c.get("fiscal_quarter")
                src = (
                    f"{c.get('doc_type')} {fy}Q{fq}" if fy and fq else c.get("doc_type") or ""
                )
                quotes.append({"quote": s.strip(), "topic": (themes[0] if themes else ""), "source": src})
                break

    sentiment = "cautious" if len(pullback_hits) > len(expand_hits) else (
        "positive" if expand_hits else "neutral"
    )
    if len(chunks) >= 30:
        freq = "high"
    elif len(chunks) >= 10:
        freq = "medium"
    else:
        freq = "low"

    involvement = min(5, max(1, 1 + len(themes) + (1 if expand_hits else 0)))
    rating = involvement

    pullback_mentions = (
        f"Pullback / tightening language appears {len(pullback_hits)} time(s) "
        f"vs. {len(expand_hits)} expansion mention(s)."
    ) if (pullback_hits or expand_hits) else ""

    return {
        "rating": rating,
        "involvement_rating": involvement,
        "mention_frequency": freq,
        "sentiment": sentiment,
        "key_themes": themes,
        "strategic_initiatives": (
            f"Heuristic extract — see '/findings/{ticker}' once an LLM is configured. "
            f"Detected themes: {', '.join(themes) if themes else 'none'}."
        ),
        "perceived_risks": (
            "Heuristic extract — risk discussion not summarized without an LLM. "
            "Refer to the cited quotes below."
        ),
        "notable_quotes": quotes,
        "pullback_mentions": pullback_mentions,
        "named_competitors": ", ".join(comps),
        "risk_focus_analysis": (
            "Heuristic extract — set LLM_PROVIDER=gemini and rerun "
            "populate_findings.py for a real risk-focus interpretation."
        ),
    }


# ── Upsert ────────────────────────────────────────────────────────────────────

def upsert_finding(handle, cur, ticker: str, name: str, finding: dict[str, Any]) -> None:
    """Insert or replace one row in pc_finding. Works for both backends."""
    key_themes_json = json.dumps(finding.get("key_themes") or [])
    notable_quotes_json = json.dumps(finding.get("notable_quotes") or [])

    def s(field: str) -> str:
        v = finding.get(field)
        return str(v).strip() if v else ""

    def i(field: str, lo: int = 1, hi: int = 5) -> int | None:
        v = finding.get(field)
        try:
            n = int(v)
        except (TypeError, ValueError):
            return None
        return max(lo, min(hi, n))

    params = (
        ticker,
        name,
        i("rating"),
        s("mention_frequency"),
        s("sentiment"),
        key_themes_json,
        s("strategic_initiatives"),
        s("perceived_risks"),
        notable_quotes_json,
        s("pullback_mentions"),
        s("named_competitors"),
        s("risk_focus_analysis"),
        i("involvement_rating"),
    )

    if handle.backend == "postgres":
        cur.execute(
            render_sql(
                """
                INSERT INTO pc_finding (
                    bank_ticker, bank_name, rating, mention_frequency, sentiment,
                    key_themes, strategic_initiatives, perceived_risks, notable_quotes,
                    pullback_mentions, named_competitors, risk_focus_analysis, involvement_rating
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (bank_ticker) DO UPDATE SET
                    bank_name = EXCLUDED.bank_name,
                    rating = EXCLUDED.rating,
                    mention_frequency = EXCLUDED.mention_frequency,
                    sentiment = EXCLUDED.sentiment,
                    key_themes = EXCLUDED.key_themes,
                    strategic_initiatives = EXCLUDED.strategic_initiatives,
                    perceived_risks = EXCLUDED.perceived_risks,
                    notable_quotes = EXCLUDED.notable_quotes,
                    pullback_mentions = EXCLUDED.pullback_mentions,
                    named_competitors = EXCLUDED.named_competitors,
                    risk_focus_analysis = EXCLUDED.risk_focus_analysis,
                    involvement_rating = EXCLUDED.involvement_rating
                """
            ),
            params,
        )
    else:
        cur.execute(
            render_sql(
                """
                INSERT OR REPLACE INTO pc_finding (
                    bank_ticker, bank_name, rating, mention_frequency, sentiment,
                    key_themes, strategic_initiatives, perceived_risks, notable_quotes,
                    pullback_mentions, named_competitors, risk_focus_analysis, involvement_rating
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """
            ),
            params,
        )


# ── Main ──────────────────────────────────────────────────────────────────────

def list_banks() -> list[tuple[str, str]]:
    with cursor() as (_handle, cur):
        cur.execute(render_sql("SELECT ticker, name FROM bank ORDER BY ticker"))
        rows = fetchall_dicts(cur)
    return [(r["ticker"], r["name"]) for r in rows]


def existing_tickers() -> set[str]:
    with cursor() as (_handle, cur):
        cur.execute(render_sql("SELECT bank_ticker FROM pc_finding"))
        rows = fetchall_dicts(cur)
    return {r["bank_ticker"] for r in rows}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tickers", nargs="*", help="Specific tickers; omit for all banks.")
    parser.add_argument("--rerun", action="store_true", help="Overwrite rows that already exist.")
    parser.add_argument(
        "--mode",
        choices=("auto", "llm", "extractive"),
        default="auto",
        help="auto = use Gemini if configured; llm = require Gemini; extractive = heuristic only.",
    )
    args = parser.parse_args()

    use_llm = (
        args.mode == "llm"
        or (args.mode == "auto" and settings.llm_provider == "gemini" and settings.gemini_api_key)
    )
    if args.mode == "llm" and not (settings.llm_provider == "gemini" and settings.gemini_api_key):
        raise SystemExit("--mode=llm requires LLM_PROVIDER=gemini and GEMINI_API_KEY set.")

    print(
        f"Mode: {'LLM (Gemini ' + settings.gemini_model + ')' if use_llm else 'extractive heuristic'}",
        flush=True,
    )

    all_banks = list_banks()
    if args.tickers:
        wanted = {t.upper() for t in args.tickers}
        banks = [(t, n) for t, n in all_banks if t.upper() in wanted]
        if not banks:
            raise SystemExit(f"No matching tickers in `bank` table: {sorted(wanted)}")
    else:
        banks = all_banks

    skip = set() if args.rerun else existing_tickers()
    if skip and not args.rerun:
        print(f"Skipping {len(skip)} banks that already have findings (use --rerun to overwrite).", flush=True)

    written = 0
    failed: list[tuple[str, str]] = []
    for ticker, name in banks:
        if ticker in skip:
            continue
        chunks = fetch_pc_chunks(ticker)
        if not chunks:
            print(f"  {ticker}: no PC-tagged chunks — skipping.", flush=True)
            continue
        print(f"  {ticker} ({name}): {len(chunks)} chunks → ", end="", flush=True)
        try:
            if use_llm:
                prompt = build_prompt(ticker, name, chunks)
                raw = _gemini_call(prompt)
                parsed = json.loads(_strip_json(raw))
            else:
                parsed = extractive_finding(ticker, name, chunks)
            with cursor() as (handle, cur):
                upsert_finding(handle, cur, ticker, name, parsed)
            written += 1
            theme_count = len(parsed.get("key_themes") or [])
            quote_count = len(parsed.get("notable_quotes") or [])
            print(f"ok (themes={theme_count}, quotes={quote_count})", flush=True)
        except Exception as e:
            failed.append((ticker, str(e)[:200]))
            print(f"FAILED: {e}", flush=True)
            # Best-effort: drop in an extractive row so the UI isn't blank.
            if use_llm:
                try:
                    parsed = extractive_finding(ticker, name, chunks)
                    with cursor() as (handle, cur):
                        upsert_finding(handle, cur, ticker, name, parsed)
                    print(f"    {ticker}: wrote extractive fallback row", flush=True)
                    written += 1
                except Exception as e2:
                    print(f"    {ticker}: extractive fallback also failed: {e2}", flush=True)

    print(f"\nDone. Wrote/updated {written} pc_finding rows.", flush=True)
    if failed:
        print(f"{len(failed)} bank(s) failed:", flush=True)
        for t, msg in failed:
            print(f"  - {t}: {msg}", flush=True)

    # Best-effort: nudge a running backend to drop its in-memory cache so the
    # UI sees new findings immediately instead of waiting out the TTL. If the
    # backend isn't running, this just fails silently — the next backend
    # start will read fresh rows from SQLite anyway.
    if written > 0:
        try:
            host = f"http://localhost:{settings.backend_port}"
            req = urllib.request.Request(
                f"{host}/admin/cache/invalidate?prefix=", method="POST"
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                body = json.loads(resp.read())
            print(
                f"Cache flushed on running backend "
                f"({body.get('invalidated', 0)} entries dropped).",
                flush=True,
            )
        except Exception as e:  # noqa: BLE001
            print(
                f"(Backend cache flush skipped: {e}. "
                f"Restart the backend or wait ~30min for the TTL.)",
                flush=True,
            )


if __name__ == "__main__":
    main()

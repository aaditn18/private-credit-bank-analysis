"""Add a one-line analyst takeaway to every anomaly via Gemini.

Each anomaly object in ``pc_anomalies.json`` (or ``da_anomalies.json`` /
``ai_anomalies.json`` if/when those exist) gets a new ``takeaway`` field —
a 10-25 word interpretive line answering "so what should the analyst watch
next?". Designed to be more useful than the existing ``headline`` (which
restates the metric) or ``detail`` (which is often raw filing language),
especially for the NLP-driven categories (``disclosure_nlp``,
``valuation_marks``, ``credit_quality``) where the underlying text excerpts
are dense.

Usage::

    # Annotate the current pc_anomalies.json in place:
    python scripts/annotate_anomaly_takeaways.py

    # Re-annotate everything (overwrite existing takeaways):
    python scripts/annotate_anomaly_takeaways.py --rerun

    # Annotate a different file:
    python scripts/annotate_anomaly_takeaways.py \\
        --input app/frontend/public/data/da_anomalies.json

The script is idempotent: by default it skips anomalies that already have
a non-empty ``takeaway`` field, so re-running it after a partial Gemini
failure picks up where it left off.

Requires:
- ``GEMINI_API_KEY`` set in ``app/.env`` (read via ``pc_analyst.config``)
- The target JSON file already exists with the standard anomaly shape
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from pc_analyst.config import settings


# ── Prompt ────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a senior credit-risk analyst writing a single one-line
takeaway for a flagged anomaly on a US bank's private-credit, digital-asset, or
AI exposure. The frontend already shows the headline (which restates the
metric) and the supporting filing excerpt — your job is the *interpretation*.

Constraints, in priority order:
1. 10 to 25 words. Single sentence. No bullet points, no headers, no quotes.
2. INTERPRETIVE, not restatement. Answer "so what should the analyst do or
   watch next?" rather than re-saying what the metric is.
3. Bank-specific. Use the ticker. Don't write a generic line that would apply
   to any bank.
4. Don't speculate beyond the evidence shown. If the evidence is thin (no
   metric, sparse text), write a short statement of what to watch next
   quarter rather than inventing detail.
5. Avoid hedging filler ("may want to consider", "perhaps the analyst could").
   Lead with the action or the watch-item.
6. No fabricated numbers, counterparty names, or stress-test results that
   aren't in the input.

Examples of good takeaways:

  Headline: "NBFI ratio 3.6σ above peers" (MS)
  Takeaway: "Heaviest NBFI concentration in the universe; a single-sector
   shock would hit MS first — watch counterparty diversification disclosures."

  Headline: "NBFI loans +5.0% outpaces total loans +0.7%" (ASB)
  Takeaway: "ASB is leaning into PC despite flat overall lending — early
   signal that may precede credit-quality deterioration if the cycle turns."

  Headline: "Hedging language up 2.9× YoY" (FCNCA)
  Takeaway: "Sharp uptick in hedging language about PC exposure at FCNCA —
   possible disclosure drift, watch next quarter's filings for concrete loss
   recognition."

Return ONLY the takeaway string. No labels, no JSON, no markdown."""


# ── Gemini call ───────────────────────────────────────────────────────────────

def _gemini_takeaway(prompt: str, *, retries: int = 3) -> str:
    """One Gemini call returning the takeaway text. Retries on rate limits."""
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is empty in app/.env")

    payload = json.dumps({
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "maxOutputTokens": 4096,  # 2.5 Flash burns ~3K on internal "thinking"
            "temperature": 0.2,
        },
    }).encode()

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.gemini_model}:generateContent?key={settings.gemini_api_key}"
    )

    last: Exception | None = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(
                url, data=payload, headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read())
            cand = data["candidates"][0]
            text = cand["content"]["parts"][0]["text"]
            # Strip whitespace, surrounding quotes, and any stray "Takeaway:" label
            text = text.strip().strip('"').strip("'")
            for prefix in ("Takeaway:", "takeaway:", "TAKEAWAY:"):
                if text.startswith(prefix):
                    text = text[len(prefix):].strip()
            # Collapse internal newlines into a single line
            text = " ".join(text.split())
            return text
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (429, 500, 502, 503, 504):
                wait = 2 ** attempt
                print(f"    Gemini HTTP {e.code} — retrying in {wait}s", flush=True)
                time.sleep(wait)
                continue
            body = ""
            try:
                body = e.read().decode("utf-8", "replace")[:300]
            except Exception:
                pass
            raise RuntimeError(f"Gemini HTTP {e.code}: {body}") from e
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1 + attempt)
    raise RuntimeError(f"Gemini call failed after retries: {last}")


# ── Prompt builder ────────────────────────────────────────────────────────────

def _format_metric(v: float | None) -> str:
    if v is None:
        return "n/a"
    if abs(v) < 1:
        return f"{v*100:.2f}%"
    return f"{v:,.2f}"


def build_user_prompt(a: dict[str, Any]) -> str:
    """Pack a single anomaly's facts into a focused prompt."""
    lines: list[str] = [
        f"Ticker     : {a.get('bank_ticker', '?')}",
        f"Category   : {a.get('category', '?')}",
        f"Severity   : {a.get('severity', '?')}",
        f"Sentiment  : {a.get('sentiment', 'inconclusive')}",
    ]
    if a.get("quarter"):
        lines.append(f"Quarter    : {a['quarter']}")
    lines += [
        "",
        f"Headline   : {a.get('headline', '')}",
        f"Detail     : {a.get('detail', '')}",
    ]
    if a.get("metric_value") is not None or a.get("peer_median") is not None:
        lines.append(
            f"Metric     : {_format_metric(a.get('metric_value'))}"
            f"  (peer median {_format_metric(a.get('peer_median'))})"
        )
    z = a.get("z_score")
    if z is not None:
        lines.append(f"Z-score    : {z:.2f}")
    fd = (a.get("full_detail") or "").strip()
    if fd:
        # Cap to 800 chars to keep tokens predictable.
        if len(fd) > 800:
            fd = fd[:800].rstrip() + "…"
        lines += [
            "",
            "Narrative excerpt (from filing/transcript):",
            fd,
        ]
    n_cites = len(a.get("citations") or [])
    if n_cites:
        lines.append(f"\nCitations  : {n_cites} chunks/filings")
    lines.append("\nReturn the takeaway string only.")
    return "\n".join(lines)


# ── Worker ────────────────────────────────────────────────────────────────────

def annotate_one(idx: int, anomaly: dict[str, Any]) -> tuple[int, str | None, str | None]:
    """Generate one takeaway. Returns (idx, takeaway, error)."""
    try:
        prompt = build_user_prompt(anomaly)
        takeaway = _gemini_takeaway(prompt)
        # Sanity: trim ridiculously long outputs (model occasionally over-runs)
        if len(takeaway) > 400:
            takeaway = takeaway[:397].rstrip() + "…"
        return idx, takeaway, None
    except Exception as e:  # noqa: BLE001
        return idx, None, str(e)[:200]


# ── Main ──────────────────────────────────────────────────────────────────────

def _flatten(payload: dict[str, Any]) -> list[tuple[str, int, dict[str, Any]]]:
    """Flatten ``categories: {cat: [Anomaly, ...]}`` into [(cat, idx, anom)] tuples."""
    out: list[tuple[str, int, dict[str, Any]]] = []
    for cat, arr in (payload.get("categories") or {}).items():
        for i, a in enumerate(arr):
            out.append((cat, i, a))
    return out


def main() -> None:
    repo_root = Path(__file__).resolve().parents[3]
    default_input = repo_root / "app" / "frontend" / "public" / "data" / "pc_anomalies.json"

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input", type=Path, default=default_input,
        help="Anomalies JSON to annotate in place (default: %(default)s)",
    )
    parser.add_argument(
        "--rerun", action="store_true",
        help="Overwrite existing takeaway fields. Default: skip already-annotated.",
    )
    parser.add_argument(
        "--workers", type=int, default=8,
        help="Concurrent Gemini calls (default %(default)s).",
    )
    parser.add_argument(
        "--max", type=int, default=None,
        help="Annotate at most N anomalies (debug helper).",
    )
    args = parser.parse_args()

    if not args.input.exists():
        sys.exit(f"Input file not found: {args.input}")

    payload = json.loads(args.input.read_text())
    flat = _flatten(payload)
    if not flat:
        sys.exit("No anomalies found in 'categories' map.")

    pending: list[tuple[str, int, dict[str, Any]]] = []
    for cat, i, a in flat:
        if not args.rerun and (a.get("takeaway") or "").strip():
            continue
        pending.append((cat, i, a))
        if args.max and len(pending) >= args.max:
            break

    print(f"Total anomalies in file : {len(flat)}")
    print(f"Already annotated       : {len(flat) - len(pending) if not args.rerun else 0}")
    print(f"To process              : {len(pending)}")
    print(f"Workers                 : {args.workers}")
    print(f"Model                   : {settings.gemini_model}")
    print()
    if not pending:
        print("Nothing to do.")
        return

    started = time.time()
    failures: list[tuple[str, int, str]] = []
    written = 0

    def task(item):
        cat, i, a = item
        return cat, i, *annotate_one(i, a)[1:]  # (cat, i, takeaway, error)

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futs = [pool.submit(task, item) for item in pending]
        done = 0
        for fut in as_completed(futs):
            cat, i, takeaway, err = fut.result()
            done += 1
            if err:
                failures.append((cat, i, err))
            else:
                payload["categories"][cat][i]["takeaway"] = takeaway
                written += 1
            if done % 10 == 0 or done == len(pending):
                elapsed = time.time() - started
                rate = done / elapsed if elapsed > 0 else 0
                eta = (len(pending) - done) / rate if rate > 0 else 0
                print(f"  {done}/{len(pending)}  ({elapsed:.1f}s, ~{eta:.0f}s left)", flush=True)

    # Write back, preserving the rest of the payload structure.
    args.input.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    print()
    print(f"Wrote {written} takeaways to {args.input}")
    if failures:
        print(f"{len(failures)} failures (left without takeaway):")
        for cat, i, msg in failures[:10]:
            print(f"  - {cat}[{i}]: {msg}")
        if len(failures) > 10:
            print(f"  ... and {len(failures) - 10} more")


if __name__ == "__main__":
    main()

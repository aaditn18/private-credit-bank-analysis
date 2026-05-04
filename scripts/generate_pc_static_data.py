"""Generate the six static JSON files the frontend's PC pages read.

Hits a live backend (default http://localhost:8000) and dumps each endpoint
into one of the JSON files at:

    app/frontend/public/data/pc_banks.json
    app/frontend/public/data/pc_rankings.json
    app/frontend/public/data/pc_trends.json
    app/frontend/public/data/pc_anomalies.json
    app/frontend/public/data/pc_findings.json
    app/frontend/public/data/pc_timelines.json

The frontend's static panels (RankingsPanel, TrendsPanel, AnomaliesPanel,
ComparePanel) are coded against this exact response shape, so the easiest
way to keep the JSONs honest is to run them through the same FastAPI routes
that hand-write that shape — instead of trying to reproduce the
shape-formatting logic from raw CSVs (which is what the original
``scripts/generate_pc_static_data.py`` did and where it kept dropping
fields and banks).

Run from anywhere with the venv active:

    python backend/scripts/generate_pc_static_data.py \
        --backend http://localhost:8000 \
        --out     /path/to/app/frontend/public/data

The default ``--out`` writes into the local repo's frontend so you can pull
the regenerated files into a remote-clone's ``app/frontend/public/data``
with a simple ``cp``. Pass ``--quarter`` to fix the rankings / anomalies
quarter; otherwise the backend picks the latest available.

Run it after the DB has been (re-)populated by ``populate_findings.py`` or
any of the ingestion scripts so the JSONs reflect current state.
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


def _fetch(backend: str, path: str, *, timeout: int = 60) -> Any:
    """GET ``backend + path`` and return parsed JSON. Raises on non-200."""
    url = backend.rstrip("/") + path
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8", "replace")[:300]
        except Exception:
            pass
        raise RuntimeError(f"GET {url} -> HTTP {e.code}: {body}") from e
    except Exception as e:
        raise RuntimeError(f"GET {url} failed: {e}") from e


def _write_json(out_dir: Path, name: str, payload: Any) -> int:
    target = out_dir / name
    target.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, indent=2, ensure_ascii=False, default=str)
    target.write_text(text)
    return len(text)


def _per_ticker(
    backend: str,
    path_template: str,
    tickers: list[str],
    *,
    label: str,
    timeout: int = 90,
    workers: int = 8,
) -> dict[str, Any]:
    """Fan out one GET per ticker, return dict keyed by ticker.

    Failed tickers (e.g. /findings 404) are surfaced but omitted from the
    output map — frontend code already tolerates a missing entry.
    """
    out: dict[str, Any] = {}
    failed: list[tuple[str, str]] = []

    def task(t: str) -> tuple[str, Any | Exception]:
        try:
            return t, _fetch(backend, path_template.format(t=t), timeout=timeout)
        except Exception as e:  # noqa: BLE001
            return t, e

    started = time.time()
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(task, t) for t in tickers]
        done = 0
        for f in as_completed(futures):
            t, result = f.result()
            done += 1
            if isinstance(result, Exception):
                failed.append((t, str(result)[:160]))
            else:
                out[t] = result
            if done % 10 == 0 or done == len(tickers):
                print(f"  {label}: {done}/{len(tickers)} ({time.time()-started:.1f}s)", flush=True)

    if failed:
        print(f"  {label}: {len(failed)} failed (omitted from map):", flush=True)
        for t, msg in failed[:10]:
            print(f"    - {t}: {msg}", flush=True)
        if len(failed) > 10:
            print(f"    ... and {len(failed)-10} more", flush=True)
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--backend",
        default="http://localhost:8000",
        help="FastAPI base URL (default %(default)s)",
    )
    repo_root = Path(__file__).resolve().parents[3]
    default_out = repo_root / "bank-analysis-ai-chatbot" / "frontend" / "public" / "data"
    if not default_out.parent.exists():
        # Newer repo layouts put the frontend under app/.
        default_out = repo_root / "app" / "frontend" / "public" / "data"
    parser.add_argument(
        "--out",
        type=Path,
        default=default_out,
        help="Output directory (default %(default)s)",
    )
    parser.add_argument(
        "--quarter",
        default=None,
        help="Quarter for rankings + anomalies (default: backend's latest)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=8,
        help="Concurrent fetches for per-ticker calls (default %(default)s)",
    )
    args = parser.parse_args()

    backend = args.backend.rstrip("/")
    out_dir: Path = args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Backend : {backend}")
    print(f"Output  : {out_dir}")
    print()

    # 1) /banks --------------------------------------------------------------
    print("[1/6] /banks ...")
    banks = _fetch(backend, "/banks")
    if not isinstance(banks, list) or not banks:
        sys.exit("Backend returned no banks — aborting.")
    tickers = sorted(b["ticker"] for b in banks)
    n = _write_json(out_dir, "pc_banks.json", banks)
    print(f"      {len(banks)} banks, {n/1024:.1f} KB")

    # 2) /rankings -----------------------------------------------------------
    print("[2/6] /rankings ...")
    rk_path = "/rankings"
    if args.quarter:
        rk_path += f"?quarter={args.quarter}"
    rk = _fetch(backend, rk_path)
    n = _write_json(out_dir, "pc_rankings.json", rk)
    have_data = sum(
        1 for b in rk.get("banks", []) if any(v is not None for v in b.get("raw", {}).values())
    )
    print(f"      quarter={rk.get('quarter')} banks={len(rk.get('banks',[]))} "
          f"({have_data} with at least one metric); metrics={[m['key'] for m in rk.get('metrics',[])]}")
    print(f"      {n/1024:.1f} KB")

    # 3) /trends -------------------------------------------------------------
    print("[3/6] /trends ...")
    tr = _fetch(backend, "/trends", timeout=120)
    n = _write_json(out_dir, "pc_trends.json", tr)
    mot = tr.get("metrics_over_time", {})
    print(f"      {len(mot)} banks in metrics_over_time")
    print(f"      industry_trend={len(tr.get('industry_trend',[]))} "
          f"exposure_ranking={len(tr.get('exposure_ranking',[]))} "
          f"quarter_movers={len(tr.get('quarter_movers',[]))} "
          f"pullbacks={len(tr.get('pullbacks',[]))}")
    print(f"      {n/1024:.1f} KB")

    # 4) /anomalies/{theme} for PC + DA + AI ---------------------------------
    # All three anomaly endpoints are snapshot now so the running app never
    # opens a SQLite connection — see the ticket "remove DB at runtime".
    print("[4/9] /anomalies/private-credit ...")
    an_path = "/anomalies/private-credit"
    if args.quarter:
        an_path += f"?quarter={args.quarter}"
    an = _fetch(backend, an_path, timeout=180)
    n = _write_json(out_dir, "pc_anomalies.json", an)
    print(f"      total={an.get('total')} per-cat={an.get('counts')}")
    print(f"      {n/1024:.1f} KB")

    print("[5/9] /anomalies/digital-assets ...")
    da_path = "/anomalies/digital-assets"
    if args.quarter:
        da_path += f"?quarter={args.quarter}"
    da = _fetch(backend, da_path, timeout=180)
    n = _write_json(out_dir, "da_anomalies.json", da)
    print(f"      total={da.get('total')} per-cat={da.get('counts')}")
    print(f"      {n/1024:.1f} KB")

    print("[6/9] /anomalies/ai ...")
    ai_path = "/anomalies/ai"
    if args.quarter:
        ai_path += f"?quarter={args.quarter}"
    ai = _fetch(backend, ai_path, timeout=180)
    n = _write_json(out_dir, "ai_anomalies.json", ai)
    print(f"      total={ai.get('total')} per-cat={ai.get('counts')}")
    print(f"      {n/1024:.1f} KB")

    # 4.5) /overview — home page cross-sector chart + sector cards ----------
    print("[7/9] /overview ...")
    ov = _fetch(backend, "/overview", timeout=120)
    n = _write_json(out_dir, "pc_overview.json", ov)
    themes = ov.get("themes") or {}
    print(f"      themes={list(themes.keys())} latest_quarter={ov.get('latest_quarter')} "
          f"mentions_quarters={len(ov.get('mentions_by_quarter',[]))} "
          f"multi_theme_banks={len(ov.get('multi_theme_banks',[]))}")
    print(f"      {n/1024:.1f} KB")

    # 5) /timeline/{ticker} for every bank -----------------------------------
    print(f"[8/9] /timeline/{{ticker}} for all {len(tickers)} banks ...")
    timelines = _per_ticker(
        backend,
        "/timeline/{t}",
        tickers,
        label="timelines",
        timeout=120,
        workers=args.workers,
    )
    n = _write_json(out_dir, "pc_timelines.json", timelines)
    total_filings = sum(len(t.get("filings", [])) for t in timelines.values())
    total_stock = sum(len(t.get("stock_prices", [])) for t in timelines.values())
    total_news = sum(len(t.get("news", [])) for t in timelines.values())
    total_quarters = sum(len(t.get("metrics_by_quarter", {})) for t in timelines.values())
    print(f"      banks={len(timelines)} filings={total_filings} "
          f"quarters={total_quarters} stock_pts={total_stock} news={total_news}")
    print(f"      {n/1024:.1f} KB")

    # 6) /findings/{ticker} for every bank -----------------------------------
    print(f"[9/9] /findings/{{ticker}} for all {len(tickers)} banks ...")
    findings = _per_ticker(
        backend,
        "/findings/{t}",
        tickers,
        label="findings",
        timeout=60,
        workers=args.workers,
    )

    # Frontend's pc_findings.json is keyed by ticker (matches our shape).
    n = _write_json(out_dir, "pc_findings.json", findings)
    nonempty = sum(
        1
        for f in findings.values()
        if (f.get("strategic_initiatives") or "").strip()
        or (f.get("notable_quotes") or [])
        or (f.get("key_themes") or [])
    )
    print(f"      banks={len(findings)} ({nonempty} with non-empty content)")
    print(f"      {n/1024:.1f} KB")

    print()
    print("Done. Wrote 9 JSON files to:")
    print(f"  {out_dir}")
    print("    pc_banks.json       (50 banks)")
    print("    pc_rankings.json    (composite + 6 metrics × 50 banks)")
    print("    pc_trends.json      (industry + peer trends + pullback list)")
    print("    pc_anomalies.json   (PC anomaly engine output)")
    print("    da_anomalies.json   (DA anomaly engine output)")
    print("    ai_anomalies.json   (AI anomaly engine output)")
    print("    pc_overview.json    (cross-sector home-page data)")
    print("    pc_timelines.json   (per-ticker timeline + stock + news)")
    print("    pc_findings.json    (per-ticker LLM-extracted strategy + quotes)")
    print()
    print("If you want fresh anomaly takeaways too, run:")
    print("    python app/backend/scripts/annotate_anomaly_takeaways.py --rerun")
    print("    python app/backend/scripts/annotate_anomaly_takeaways.py "
          "--input app/frontend/public/data/da_anomalies.json --rerun")
    print("    python app/backend/scripts/annotate_anomaly_takeaways.py "
          "--input app/frontend/public/data/ai_anomalies.json --rerun")


if __name__ == "__main__":
    main()

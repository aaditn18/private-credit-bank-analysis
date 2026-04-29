'use client';

import { useEffect, useRef, useState } from 'react';
import type { Citation, CitationDetail } from '@/lib/types';
import { fetchCitation } from '@/lib/api';

interface Props {
  citation: Citation;
}

export function SourceViewer({ citation }: Props) {
  const [detail, setDetail] = useState<CitationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const markRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    fetchCitation(citation.chunk_id)
      .then((d) => {
        if (!cancel) setDetail(d);
      })
      .catch((e) => {
        if (!cancel) setError(String(e));
      })
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, [citation.chunk_id]);

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [detail]);

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-neutral-900">
          Source [{citation.marker}] &middot; {citation.bank} {citation.doc_type}{' '}
          {citation.fiscal_year}Q{citation.fiscal_quarter}
        </h3>
        {detail?.source_url && (
          <a
            href={detail.source_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-indigo-600 hover:underline"
          >
            open EDGAR ↗
          </a>
        )}
      </div>
      {loading && <div className="text-sm text-neutral-500">Loading source…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {detail && (
        <div className="text-[13px] leading-relaxed font-mono text-neutral-700 max-h-[40vh] overflow-auto bg-neutral-50 rounded-md p-3 border border-neutral-200">
          {renderWithHighlight(detail, markRef)}
        </div>
      )}
      {detail?.section_header && (
        <div className="mt-2 text-[11px] uppercase tracking-wide text-neutral-400">
          section: {detail.section_header}
        </div>
      )}
    </section>
  );
}

function renderWithHighlight(
  d: CitationDetail,
  markRef: React.MutableRefObject<HTMLElement | null>
) {
  const { context, highlight_start: hs, highlight_end: he } = d;
  const before = context.slice(0, hs);
  const hl = context.slice(hs, he);
  const after = context.slice(he);
  return (
    <>
      <span>{before}</span>
      <mark className="span-highlight" ref={(el) => { markRef.current = el as HTMLElement; }}>
        {hl}
      </mark>
      <span>{after}</span>
    </>
  );
}

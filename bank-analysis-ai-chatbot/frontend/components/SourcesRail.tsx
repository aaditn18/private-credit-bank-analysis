'use client';

import clsx from 'clsx';
import type { Citation } from '@/lib/types';

interface Props {
  citations: Citation[];
  onSelect: (marker: number) => void;
  selectedMarker: number | null;
}

export function SourcesRail({ citations, onSelect, selectedMarker }: Props) {
  if (!citations.length) return null;

  const grouped = citations.reduce<Record<string, Citation[]>>((acc, c) => {
    acc[c.doc_type] = acc[c.doc_type] ? [...acc[c.doc_type], c] : [c];
    return acc;
  }, {});

  return (
    <aside className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-neutral-900 mb-3">Sources</h3>
      <div className="space-y-4">
        {Object.entries(grouped).map(([docType, cits]) => (
          <div key={docType}>
            <div className="text-[11px] uppercase tracking-wide text-neutral-400 mb-1.5">
              {docType}
            </div>
            <ul className="space-y-1.5">
              {cits.map((c) => (
                <li key={c.marker}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.marker)}
                    className={clsx(
                      'w-full text-left px-2.5 py-2 rounded-md border text-xs flex items-start gap-2',
                      selectedMarker === c.marker
                        ? 'border-indigo-400 bg-indigo-50'
                        : 'border-neutral-200 hover:border-neutral-300 bg-white'
                    )}
                  >
                    <span className="shrink-0 text-[10px] font-semibold text-indigo-600">
                      [{c.marker}]
                    </span>
                    <span className="flex-1 text-neutral-700 leading-snug">
                      <div className="font-medium text-neutral-900">
                        {c.bank} · {c.fiscal_year}Q{c.fiscal_quarter}
                      </div>
                      {c.section && <div className="text-neutral-500">{c.section}</div>}
                      <div className="text-neutral-400 mt-1 line-clamp-2">{c.text}</div>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}

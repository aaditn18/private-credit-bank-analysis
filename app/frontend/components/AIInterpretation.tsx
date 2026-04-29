'use client';

import { useState } from 'react';

interface AIInterpretationProps {
  title?: string;
  content: string;
}

export function AIInterpretation({
  title = 'AI Interpretation',
  content,
}: AIInterpretationProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-indigo-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-indigo-600 text-white text-[10px] font-bold">
            AI
          </span>
          <span className="text-sm font-medium text-indigo-900">{title}</span>
        </div>
        <svg
          className={`w-4 h-4 text-indigo-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-indigo-900/80 leading-relaxed border-t border-indigo-100">
          <div className="pt-3">{content}</div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import clsx from 'clsx';
import type { ReasoningStep } from '@/lib/types';

interface Props {
  steps: ReasoningStep[];
}

const BADGE_STYLES: Record<ReasoningStep['step_type'], string> = {
  decompose: 'bg-sky-100 text-sky-800 border-sky-200',
  tool_call: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  note: 'bg-amber-100 text-amber-800 border-amber-200',
  synthesize: 'bg-violet-100 text-violet-800 border-violet-200',
};

export function ReasoningTrace({ steps }: Props) {
  const [open, setOpen] = useState<Record<number, boolean>>({});

  return (
    <aside className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-neutral-900">Reasoning trace</h3>
        <span className="text-[11px] uppercase tracking-wide text-neutral-400">
          {steps.length} step{steps.length === 1 ? '' : 's'}
        </span>
      </div>

      <ol className="space-y-2">
        {steps.map((step) => {
          const isOpen = !!open[step.step_index];
          return (
            <li key={step.step_index} className="border border-neutral-200 rounded-lg">
              <button
                type="button"
                className="w-full text-left px-3 py-2 flex items-start gap-2"
                onClick={() =>
                  setOpen((o) => ({ ...o, [step.step_index]: !o[step.step_index] }))
                }
              >
                <span
                  className={clsx(
                    'mt-0.5 shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border font-medium',
                    BADGE_STYLES[step.step_type]
                  )}
                >
                  {step.step_type}
                  {step.tool_name ? ` · ${step.tool_name}` : ''}
                </span>
                <span className="text-xs text-neutral-700 flex-1 leading-snug">
                  {step.summary}
                </span>
                <span className="text-xs text-neutral-400">{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && (
                <div className="border-t border-neutral-200 px-3 py-2 text-[11px] font-mono text-neutral-700 overflow-x-auto">
                  {step.tool_arguments !== null && step.tool_arguments !== undefined && (
                    <div className="mb-2">
                      <div className="text-neutral-400 mb-0.5">arguments</div>
                      <pre className="whitespace-pre-wrap break-words">
                        {JSON.stringify(step.tool_arguments, null, 2)}
                      </pre>
                    </div>
                  )}
                  <div className="text-neutral-400 mb-0.5">result</div>
                  <pre className="whitespace-pre-wrap break-words">
                    {truncate(JSON.stringify(step.tool_result, null, 2), 1600)}
                  </pre>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '\n…(truncated)' : s;
}

'use client';

import { useRef, useState } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { AIOverview } from '@/components/AIOverview';
import { ChartsPanel } from '@/components/ChartsPanel';
import { ReasoningTrace } from '@/components/ReasoningTrace';
import { SourcesRail } from '@/components/SourcesRail';
import { SourceViewer } from '@/components/SourceViewer';
import { RankingsPanel } from '@/components/RankingsPanel';
import { ComingSoonPanel } from '@/components/ComingSoonPanel';
import { runSearch } from '@/lib/api';
import type { SearchResponse } from '@/lib/types';

interface ResultSlot {
  id: number;
  question: string;
  loading: boolean;
  error: string | null;
  resp: SearchResponse | null;
  selected: number | null;
}

let nextId = 1;

type Theme = 'private_credit' | 'digital_assets' | 'ai_usage';

const THEME_META: Record<Theme, { label: string; blurb: string }> = {
  private_credit: {
    label: 'Private Credit',
    blurb: 'NBFI lending, direct lending pipelines, PE sponsor relationships',
  },
  digital_assets: {
    label: 'Digital Assets',
    blurb: 'Crypto custody, stablecoin, tokenization, digital-asset prime brokerage',
  },
  ai_usage: {
    label: 'AI Usage',
    blurb: 'AI/ML deployment, generative AI strategy, technology investment posture',
  },
};

export default function HomePage() {
  const [theme, setTheme] = useState<Theme>('private_credit');
  const [slots, setSlots] = useState<ResultSlot[]>([]);
  const abortRefs = useRef<Map<number, AbortController>>(new Map());

  function updateSlot(id: number, patch: Partial<ResultSlot>) {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function onSubmit(question: string) {
    const id = nextId++;
    const slot: ResultSlot = { id, question, loading: true, error: null, resp: null, selected: null };
    setSlots((prev) => [slot, ...prev]);

    const ctrl = new AbortController();
    abortRefs.current.set(id, ctrl);

    try {
      const r = await runSearch(question, ctrl.signal);
      updateSlot(id, {
        loading: false,
        resp: r,
        selected: r.citations.length ? r.citations[0].marker : null,
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      updateSlot(id, { loading: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      abortRefs.current.delete(id);
    }
  }

  function dismiss(id: number) {
    abortRefs.current.get(id)?.abort();
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }

  const anyLoading = slots.some((s) => s.loading);

  const themeBtn = (t: Theme) => (
    <button
      key={t}
      onClick={() => setTheme(t)}
      className={`flex-1 text-left px-5 py-3 border-b-2 transition-colors ${
        theme === t
          ? 'border-indigo-600 bg-white'
          : 'border-transparent bg-neutral-50 hover:bg-white'
      }`}
    >
      <div
        className={`text-sm font-semibold ${
          theme === t ? 'text-indigo-600' : 'text-neutral-700'
        }`}
      >
        {THEME_META[t].label}
      </div>
      <div className="text-[11px] text-neutral-400 mt-0.5 leading-tight">
        {THEME_META[t].blurb}
      </div>
    </button>
  );

  return (
    <div className="space-y-6">
      <SearchBar onSubmit={onSubmit} loading={anyLoading} />

      {slots.length > 0 && (
        <div className="space-y-6">
          {slots.map((slot) => (
            <div key={slot.id} className="space-y-5">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5">
                <span className="text-sm font-medium text-neutral-700 truncate">{slot.question}</span>
                <div className="flex items-center gap-3 shrink-0">
                  {slot.loading && (
                    <span className="flex items-center gap-1.5 text-xs text-indigo-500">
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Analysing…
                    </span>
                  )}
                  <button
                    onClick={() => dismiss(slot.id)}
                    className="text-neutral-400 hover:text-neutral-600 text-lg leading-none"
                    title="Dismiss"
                  >
                    ×
                  </button>
                </div>
              </div>

              {slot.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {slot.error}
                </div>
              )}

              {slot.resp && (
                <div className="grid grid-cols-12 gap-5">
                  <div className="col-span-12 md:col-span-8 space-y-5">
                    <AIOverview
                      answerMarkdown={slot.resp.answer_markdown}
                      citations={slot.resp.citations}
                      driftSignals={slot.resp.disclosure_drift}
                      onCitationClick={(m) => updateSlot(slot.id, { selected: m })}
                    />
                    <ChartsPanel steps={slot.resp.reasoning_steps} />
                    {slot.selected !== null &&
                      slot.resp.citations.find((c) => c.marker === slot.selected) && (
                        <SourceViewer
                          citation={slot.resp.citations.find((c) => c.marker === slot.selected)!}
                        />
                      )}
                  </div>
                  <div className="col-span-12 md:col-span-4 space-y-5">
                    <SourcesRail
                      citations={slot.resp.citations}
                      onSelect={(m) => updateSlot(slot.id, { selected: m })}
                      selectedMarker={slot.selected}
                    />
                    <ReasoningTrace steps={slot.resp.reasoning_steps} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-neutral-200 overflow-hidden bg-neutral-50">
        <div className="flex">
          {(Object.keys(THEME_META) as Theme[]).map(themeBtn)}
        </div>
      </div>

      {theme === 'private_credit' && <RankingsPanel />}
      {theme === 'digital_assets' && (
        <ComingSoonPanel
          theme="Digital Assets"
          description="A scorecard of how meaningfully each bank is engaging with the digital-asset ecosystem — custody, stablecoin infrastructure, tokenization pilots, and digital-asset prime brokerage — layered on top of the standard financial-risk readiness score so you can see whether the engagement is prudent relative to the institution's health."
          signals={[
            'Frequency and specificity of crypto / stablecoin / tokenization language across 10-K, 10-Q, and 8-K filings',
            'Digital-asset commentary in earnings-call prepared remarks and Q&A',
            'Custody and wallet-infrastructure partnership disclosures',
            'Regulatory posture: OCC / NY-DFS guidance acknowledgements, enforcement history',
            'Call Report trading-revenue and off-balance-sheet signals where available',
          ]}
        />
      )}
      {theme === 'ai_usage' && (
        <ComingSoonPanel
          theme="AI Usage"
          description="A scorecard measuring how deeply each bank is deploying AI and machine learning — from front-office generative-AI copilots to back-office risk models — combined with the governance maturity signals that determine whether that deployment is responsible. Same readiness framework as Private Credit, theme-specific engagement layer."
          signals={[
            'Count and depth of AI / ML / generative-AI references in filings and transcripts (narrative vs. headline mentions)',
            'Named AI partnerships and vendor disclosures (OpenAI, Anthropic, proprietary platforms)',
            'Technology investment disclosures and efficiency-ratio trajectory',
            'Model-risk-management language and governance disclosures',
            'Earnings-call sentiment and analyst Q&A volume on AI',
          ]}
        />
      )}
    </div>
  );
}

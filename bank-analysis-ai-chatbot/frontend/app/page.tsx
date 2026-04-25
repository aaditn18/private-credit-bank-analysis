'use client';

import { useState } from 'react';
import { RankingsPanel } from '@/components/RankingsPanel';
import { ComingSoonPanel } from '@/components/ComingSoonPanel';
// ChatBot is now mounted globally on PC routes via ChatBotMount in layout.tsx

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

  const themeBtn = (t: Theme) => {
    const active = theme === t;
    return (
      <button
        key={t}
        onClick={() => setTheme(t)}
        className={`flex-1 text-left px-5 py-4 border-b-2 transition-all ${
          active
            ? 'border-indigo-400 bg-white/[0.04]'
            : 'border-transparent hover:bg-white/[0.025]'
        }`}
      >
        <div
          className={`text-sm font-semibold tracking-tight ${
            active ? 'text-indigo-300' : 'text-neutral-300'
          }`}
        >
          {THEME_META[t].label}
        </div>
        <div className="text-[11px] text-neutral-500 mt-1 leading-snug">
          {THEME_META[t].blurb}
        </div>
      </button>
    );
  };

  return (
    <>
      <div className="space-y-6">
        <div className="rounded-xl border border-white/5 overflow-hidden bg-white/[0.02] shadow-2xl shadow-black/40">
          <div className="flex divide-x divide-white/5">
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
    </>
  );
}

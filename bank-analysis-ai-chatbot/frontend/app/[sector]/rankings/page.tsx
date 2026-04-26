import { notFound } from 'next/navigation';
import { RankingsPanel } from '@/components/RankingsPanel';
import { ComingSoonPanel } from '@/components/ComingSoonPanel';

const VALID = ['private-credit', 'ai', 'digital-assets'] as const;

const COMING_SOON: Record<string, { title: string; description: string; signals: string[] }> = {
  ai: {
    title: 'AI Usage rankings',
    description:
      "Same composite-score framework as Private Credit, layered on top of an AI engagement score. The financial-readiness side of the score is identical to PC; what's not yet in the database is the quantitative AI engagement side (vendor partnership disclosures, AI capex, GPU/data-center finance flow, model-risk maturity).",
    signals: [
      'Count and depth of AI / ML / generative-AI references in 10-K, 10-Q, 8-K, and prepared remarks',
      'Named vendor / partnership disclosures (OpenAI, Anthropic, hyperscalers)',
      'Technology investment line items and efficiency-ratio trajectory',
      'Model-risk-management language and governance disclosures',
      'Earnings-call sentiment and analyst Q&A volume on AI',
    ],
  },
  'digital-assets': {
    title: 'Digital Assets rankings',
    description:
      "Same composite-score framework as Private Credit, layered on top of a digital-asset engagement score. PC-style readiness on one axis, DA-specific engagement on the other — once custody, stablecoin reserve, and tokenization disclosures are ingested as structured signals, this tab will rank banks just like the PC tab does.",
    signals: [
      'Frequency and specificity of crypto / stablecoin / tokenization language across SEC filings',
      'Digital-asset commentary in earnings-call prepared remarks and Q&A',
      'Custody and wallet-infrastructure partnership disclosures',
      'Regulatory posture: OCC / NY-DFS guidance acknowledgements, enforcement history',
      'Call Report trading-revenue and off-balance-sheet signals where available',
    ],
  },
};

export default async function SectorRankingsPage(
  props: PageProps<'/[sector]/rankings'>,
) {
  const { sector } = await props.params;
  if (!VALID.includes(sector as (typeof VALID)[number])) notFound();

  if (sector === 'private-credit') return <RankingsPanel />;

  const meta = COMING_SOON[sector];
  return (
    <ComingSoonPanel
      theme={meta.title}
      description={meta.description}
      signals={meta.signals}
    />
  );
}

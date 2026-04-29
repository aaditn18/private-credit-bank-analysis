import { notFound } from 'next/navigation';
import { DARiskPanel } from '@/components/panels/DARiskPanel';
import { ComingSoonPanel } from '@/components/ComingSoonPanel';

const VALID = ['private-credit', 'ai', 'digital-assets'] as const;

export default async function SectorRiskPage(
  props: PageProps<'/[sector]/risk'>,
) {
  const { sector } = await props.params;
  if (!VALID.includes(sector as (typeof VALID)[number])) notFound();

  if (sector === 'digital-assets') return <DARiskPanel />;

  return (
    <ComingSoonPanel
      theme={sector === 'ai' ? 'AI Usage risk analysis' : 'Private Credit risk analysis'}
      description="Team 6-style risk profiling for this sector — coming once the quantitative pipeline is wired up."
      signals={[
        'Financial resilience scoring from Call Report data',
        'Governance quality from SEC filings and transcript analysis',
        'Sector-specific operational risk exposure',
        'Systemic footprint and supervisory priority ranking',
      ]}
    />
  );
}

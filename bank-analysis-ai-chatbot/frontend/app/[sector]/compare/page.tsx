import { notFound } from 'next/navigation';
import { ComparePanel } from '@/components/panels/ComparePanel';
import { ComingSoonPanel } from '@/components/ComingSoonPanel';

const VALID = ['private-credit', 'ai', 'digital-assets'] as const;

export default async function SectorComparePage(
  props: PageProps<'/[sector]/compare'>,
) {
  const { sector } = await props.params;
  if (!VALID.includes(sector as (typeof VALID)[number])) notFound();

  if (sector === 'private-credit') return <ComparePanel />;

  const label = sector === 'ai' ? 'AI Usage comparison' : 'Digital Assets comparison';
  return (
    <ComingSoonPanel
      theme={label}
      description="Side-by-side bank comparison for this theme. The PC compare view runs on Call Report metrics + LLM-extracted narrative findings; once the theme-specific quantitative pipeline lands (AI capex / GPU finance flow / stablecoin reserves), this tab will compare banks on the same model — radar overlays, composite ranking position, metric trends over time, strategy and quote face-off."
      signals={[
        'Theme-specific quantitative metrics (parity with the PC composite)',
        'Stock price overlay around theme-related filing dates',
        'Strategy initiatives (LLM-extracted from filings + transcripts)',
        'Key quote face-off on shared themes',
      ]}
    />
  );
}

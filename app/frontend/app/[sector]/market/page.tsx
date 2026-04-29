import { notFound } from 'next/navigation';
import { DAMarketPanel } from '@/components/panels/DAMarketPanel';
import { ComingSoonPanel } from '@/components/ComingSoonPanel';

const VALID = ['private-credit', 'ai', 'digital-assets'] as const;

export default async function SectorMarketPage(
  props: PageProps<'/[sector]/market'>,
) {
  const { sector } = await props.params;
  if (!VALID.includes(sector as (typeof VALID)[number])) notFound();

  if (sector === 'digital-assets') return <DAMarketPanel />;

  // Market tab only exists in the nav for digital-assets.
  // If someone navigates here directly for other sectors, show a placeholder.
  return (
    <ComingSoonPanel
      theme={sector === 'ai' ? 'AI Usage market data' : 'Private Credit market data'}
      description="Market context and industry timeline for this sector — coming once the quantitative pipeline is fully wired up."
      signals={[
        'Industry-wide market size and projection data',
        'Regulatory timeline and key milestones',
        'Latest confirmed developments post-data cutoff',
        'Scoring methodology documentation',
      ]}
    />
  );
}

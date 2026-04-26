import { notFound } from 'next/navigation';
import { TrendsPanel } from '@/components/panels/TrendsPanel';
import { ComingSoonPanel } from '@/components/ComingSoonPanel';

const VALID = ['private-credit', 'ai', 'digital-assets'] as const;

export default async function SectorTrendsPage(
  props: PageProps<'/[sector]/trends'>,
) {
  const { sector } = await props.params;
  if (!VALID.includes(sector as (typeof VALID)[number])) notFound();

  if (sector === 'private-credit') return <TrendsPanel />;

  const label = sector === 'ai' ? 'AI Usage trends' : 'Digital Assets trends';
  return (
    <ComingSoonPanel
      theme={label}
      description="Multi-quarter trend dashboard — once the theme-specific quantitative pipeline is wired up (AI capex, GPU/data-center finance flow, stablecoin reserves), this tab will mirror the PC trends view: industry-wide aggregates, peer-group medians, individual bank trajectories, and pullback / expansion detection."
      signals={[
        'Per-quarter aggregate of theme-tagged narrative volume across the 50-bank universe',
        'Peer-group medians (GSIB / regional / trust-IB) over time',
        'Quarter-over-quarter movers (banks expanding or contracting)',
        'Disclosure drift — when a bank suddenly stops or starts talking about the theme',
      ]}
    />
  );
}

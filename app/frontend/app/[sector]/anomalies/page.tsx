import { notFound } from 'next/navigation';
import { AnomaliesPanel, type ThemeSlug } from '@/components/panels/AnomaliesPanel';
import { DAOverviewPanel } from '@/components/panels/DAOverviewPanel';

// VALID_SLUGS lives inside the (client) panel module too, but server
// components can't reliably read array exports from `'use client'` modules,
// so we duplicate the small constant here. Both lists must stay in sync.
const VALID_SLUGS = ['private-credit', 'ai', 'digital-assets'] as const;

export default async function SectorAnomaliesPage(
  props: PageProps<'/[sector]/anomalies'>,
) {
  const { sector } = await props.params;
  if (!VALID_SLUGS.includes(sector as ThemeSlug)) notFound();

  // DA gets its own overview panel built from BUFN403 Team 5 NLP pipeline work.
  // PC and AI use the generic backend-driven anomaly engine.
  if (sector === 'digital-assets') return <DAOverviewPanel />;

  return <AnomaliesPanel slug={sector as ThemeSlug} />;
}

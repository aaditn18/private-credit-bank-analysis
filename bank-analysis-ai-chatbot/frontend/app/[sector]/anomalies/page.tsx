import { notFound } from 'next/navigation';
import { AnomaliesPanel, type ThemeSlug } from '@/components/panels/AnomaliesPanel';

// VALID_SLUGS lives inside the (client) panel module too, but server
// components can't reliably read array exports from `'use client'` modules,
// so we duplicate the small constant here. Both lists must stay in sync.
const VALID_SLUGS = ['private-credit', 'ai', 'digital-assets'] as const;

export default async function SectorAnomaliesPage(
  props: PageProps<'/[sector]/anomalies'>,
) {
  const { sector } = await props.params;
  if (!VALID_SLUGS.includes(sector as ThemeSlug)) notFound();
  // The anomaly engine is theme-aware — this works for all 3 sectors.
  return <AnomaliesPanel slug={sector as ThemeSlug} />;
}

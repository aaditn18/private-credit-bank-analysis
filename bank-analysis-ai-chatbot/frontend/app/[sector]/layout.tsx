import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SectorTabs } from '@/components/SectorTabs';

// Three sector hubs. Each renders its own header + 4-tab nav, then the
// child page (rankings / trends / anomalies / compare) under that frame.
//
// The home page (`app/page.tsx`) is the cross-sector landing — it's NOT
// inside this layout.

const VALID_SECTORS = ['private-credit', 'ai', 'digital-assets'] as const;
type Sector = (typeof VALID_SECTORS)[number];

const SECTOR_META: Record<
  Sector,
  { label: string; blurb: string; accent: string; ring: string }
> = {
  'private-credit': {
    label: 'Private Credit',
    blurb: 'NBFI lending, direct lending pipelines, PE sponsor relationships',
    accent: 'from-indigo-500 to-purple-600',
    ring: 'ring-indigo-400/40',
  },
  'digital-assets': {
    label: 'Digital Assets',
    blurb:
      'Crypto custody, stablecoin reserves, tokenization, digital-asset prime brokerage',
    accent: 'from-amber-500 to-orange-600',
    ring: 'ring-amber-400/40',
  },
  ai: {
    label: 'AI Usage',
    blurb: 'AI/ML deployment, generative AI strategy, technology investment posture',
    accent: 'from-emerald-500 to-teal-600',
    ring: 'ring-emerald-400/40',
  },
};

export default async function SectorLayout(props: LayoutProps<'/[sector]'>) {
  const { sector } = await props.params;
  if (!VALID_SECTORS.includes(sector as Sector)) {
    notFound();
  }
  const meta = SECTOR_META[sector as Sector];

  return (
    <div className="space-y-6">
      {/* Sector header card */}
      <div
        className={`rounded-xl bg-gradient-to-br ${meta.accent} text-white p-6 shadow-lg ring-1 ${meta.ring}`}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-wider opacity-80">Sector hub</div>
            <h1 className="text-2xl font-semibold mt-1">{meta.label}</h1>
            <p className="text-sm opacity-90 mt-2 max-w-3xl">{meta.blurb}</p>
          </div>
          <div className="flex items-center gap-1 text-[11px] opacity-80">
            <Link href="/" className="underline-offset-2 hover:underline">
              ← All sectors
            </Link>
          </div>
        </div>
      </div>

      <SectorTabs sector={sector} />

      {props.children}
    </div>
  );
}

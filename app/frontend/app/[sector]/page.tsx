import { redirect } from 'next/navigation';

// `/private-credit` etc. lands you on the default tab for that sector.
// PC has all 4 tabs live → default to Rankings.
// AI now has static Team 1 JSON outputs wired into rankings/trends/compare.
// Digital Assets still defaults to anomalies until its route set is fully live.
const DEFAULT_TAB: Record<string, string> = {
  'private-credit': 'rankings',
  ai: 'rankings',
  'digital-assets': 'anomalies',
};

export default async function SectorIndex(props: PageProps<'/[sector]'>) {
  const { sector } = await props.params;
  const tab = DEFAULT_TAB[sector] ?? 'rankings';
  redirect(`/${sector}/${tab}`);
}

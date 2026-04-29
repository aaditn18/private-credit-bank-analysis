import { redirect } from 'next/navigation';

// `/private-credit` etc. lands you on the default tab for that sector.
// PC has all 4 tabs live → default to Rankings.
// AI / DA only have Anomalies live (Rankings/Trends/Compare are placeholders
// pending quantitative ingest) → default to Anomalies so the user sees
// real data on first arrival.
const DEFAULT_TAB: Record<string, string> = {
  'private-credit': 'rankings',
  ai: 'anomalies',
  'digital-assets': 'anomalies',
};

export default async function SectorIndex(props: PageProps<'/[sector]'>) {
  const { sector } = await props.params;
  const tab = DEFAULT_TAB[sector] ?? 'rankings';
  redirect(`/${sector}/${tab}`);
}

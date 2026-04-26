import { redirect } from 'next/navigation';

// Legacy redirect — Anomalies for each sector now lives at
// `/private-credit/anomalies`, `/digital-assets/anomalies`, `/ai/anomalies`.
//
// We accept the same theme slug (`private-credit`, `digital-assets`, `ai`)
// and forward to its new home.
const VALID = ['private-credit', 'ai', 'digital-assets'] as const;

export default async function LegacyAnomaliesRedirect(
  props: PageProps<'/anomalies/[theme]'>,
) {
  const { theme } = await props.params;
  if (!VALID.includes(theme as (typeof VALID)[number])) {
    redirect('/private-credit/anomalies');
  }
  redirect(`/${theme}/anomalies`);
}

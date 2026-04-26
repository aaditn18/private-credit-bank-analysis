import { redirect } from 'next/navigation';

// Legacy redirect — Compare now lives inside the Private Credit sector hub.
export default function LegacyCompareRedirect() {
  redirect('/private-credit/compare');
}

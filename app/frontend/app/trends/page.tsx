import { redirect } from 'next/navigation';

// Legacy redirect — Trends now lives inside the Private Credit sector hub.
// Keeps old bookmarks working.
export default function LegacyTrendsRedirect() {
  redirect('/private-credit/trends');
}

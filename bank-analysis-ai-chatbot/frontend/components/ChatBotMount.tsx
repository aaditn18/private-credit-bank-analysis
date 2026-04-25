'use client';

import { usePathname } from 'next/navigation';
import { ChatBot } from './ChatBot';

// The chatbot is private-credit-flavored: its taxonomy, retrieval index,
// and synthesizer prompt all assume the question is about NBFI exposure,
// fund finance, BDCs, etc. So mount it only on PC-related routes.
//
// Show on:
//   /                          (home — defaults to the Private Credit tab)
//   /trends                    (industry NBFI exposure)
//   /timeline/[ticker]         (per-bank PC timeline)
//   /compare                   (peer comparison)
//   /anomalies/private-credit  (PC anomalies only)
//
// Hide on:
//   /anomalies/ai
//   /anomalies/digital-assets
//   any future non-PC theme route
function isPrivateCreditRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === '/') return true;
  if (pathname.startsWith('/trends')) return true;
  if (pathname.startsWith('/timeline')) return true;
  if (pathname.startsWith('/compare')) return true;
  if (pathname.startsWith('/anomalies/')) {
    // Only the private-credit theme; AI / digital-assets stay chatbot-free.
    return pathname.startsWith('/anomalies/private-credit');
  }
  return false;
}

export function ChatBotMount() {
  const pathname = usePathname();
  if (!isPrivateCreditRoute(pathname)) return null;
  return <ChatBot />;
}

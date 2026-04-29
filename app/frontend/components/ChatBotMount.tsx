'use client';

import { usePathname } from 'next/navigation';
import { ChatBot } from './ChatBot';

// The chatbot is private-credit-flavored: its taxonomy, retrieval index,
// and synthesizer prompt all assume the question is about NBFI exposure,
// fund finance, BDCs, etc. So the FAB is only *shown* on routes where that
// lens makes sense — but the component itself stays mounted on every page
// so its state (open/closed, messages, draft input) persists as the user
// hops between sectors. State also rides through sessionStorage inside
// ChatBot for hard-refresh resilience.
//
// Visible on:
//   /                                  (home — has cross-sector overview, but
//                                       PC is the most-developed dataset and
//                                       the chatbot is the right entry point)
//   /private-credit/*                  (rankings, trends, anomalies, compare)
//   /timeline/[ticker]                 (per-bank PC timeline)
//   /trends, /compare,
//   /anomalies/private-credit          (legacy URLs during their redirect window)
//
// Hidden (component still mounted) on:
//   /digital-assets/*
//   /ai/*
function isPrivateCreditRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === '/') return true;
  if (pathname.startsWith('/private-credit')) return true;
  if (pathname.startsWith('/timeline')) return true;
  if (pathname.startsWith('/trends')) return true;
  if (pathname.startsWith('/compare')) return true;
  if (pathname.startsWith('/anomalies/private-credit')) return true;
  return false;
}

export function ChatBotMount() {
  const pathname = usePathname();
  return <ChatBot visible={isPrivateCreditRoute(pathname)} />;
}

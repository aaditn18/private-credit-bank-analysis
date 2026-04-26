'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SECTORS: { slug: string; label: string; activeClass: string }[] = [
  {
    slug: 'private-credit',
    label: 'Private Credit',
    activeClass: 'bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/40',
  },
  {
    slug: 'digital-assets',
    label: 'Digital Assets',
    activeClass: 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/40',
  },
  {
    slug: 'ai',
    label: 'AI Usage',
    activeClass: 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/40',
  },
];

// Top-of-page sector switcher. Highlights the sector whose hub the user is
// currently inside (`/<slug>/...`). Home (`/`) shows no active highlight —
// users go to a sector by clicking its pill or the corresponding card on
// the home page.
export function HeaderSectorNav() {
  const path = usePathname() || '/';

  return (
    <nav className="flex items-center gap-1 text-sm">
      <Link
        href="/"
        prefetch
        className={`px-3 py-1.5 rounded-md transition-colors ${
          path === '/'
            ? 'text-white bg-white/[0.06]'
            : 'text-neutral-400 hover:text-white hover:bg-white/[0.06]'
        }`}
      >
        Home
      </Link>
      {SECTORS.map((s) => {
        const active = path.startsWith(`/${s.slug}`);
        return (
          <Link
            key={s.slug}
            href={`/${s.slug}`}
            prefetch
            className={`px-3 py-1.5 rounded-md transition-colors ${
              active ? s.activeClass : 'text-neutral-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}

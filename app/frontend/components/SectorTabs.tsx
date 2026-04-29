'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type TabKey = 'rankings' | 'trends' | 'market' | 'anomalies' | 'compare';

const BASE_TABS: { key: TabKey; label: string }[] = [
  { key: 'rankings',  label: 'Rankings'  },
  { key: 'trends',    label: 'Trends'    },
  { key: 'anomalies', label: 'Anomalies' },
  { key: 'compare',   label: 'Compare'   },
];

// Digital Assets gets an extra Market tab between Trends and Anomalies.
const DA_TABS: { key: TabKey; label: string }[] = [
  { key: 'rankings',  label: 'Rankings'  },
  { key: 'trends',    label: 'Trends'    },
  { key: 'market',    label: 'Market'    },
  { key: 'anomalies', label: 'Anomalies' },
  { key: 'compare',   label: 'Compare'   },
];

export function SectorTabs({ sector }: { sector: string }) {
  const path = usePathname() || '';
  const tabs = sector === 'digital-assets' ? DA_TABS : BASE_TABS;
  const active =
    tabs.find((t) => path.endsWith(`/${t.key}`) || path.endsWith(`/${t.key}/`))?.key ??
    'rankings';

  return (
    <nav className="flex flex-wrap items-center gap-1 border-b border-white/10">
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            href={`/${sector}/${t.key}`}
            prefetch
            className={`text-sm px-4 py-2 rounded-t-md transition-colors border-b-2 -mb-px ${
              isActive
                ? 'border-white text-white bg-white/[0.04]'
                : 'border-transparent text-neutral-400 hover:text-white hover:bg-white/[0.03]'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

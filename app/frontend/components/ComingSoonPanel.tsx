'use client';

interface Props {
  theme: string;
  description: string;
  signals: string[];
}

export function ComingSoonPanel({ theme, description, signals }: Props) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-neutral-900 text-base">{theme}</h3>
          <p className="text-xs text-neutral-400 mt-0.5">Theme-specific scorecard · in development</p>
        </div>
        <span className="text-[11px] px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
          Coming soon
        </span>
      </div>
      <div className="px-6 py-8 space-y-4">
        <p className="text-sm text-neutral-600 leading-relaxed">{description}</p>
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-400 font-medium mb-2">
            Signals that will feed this score
          </p>
          <ul className="space-y-1.5">
            {signals.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                <span className="text-indigo-400 mt-0.5">·</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-neutral-400 pt-2 border-t border-neutral-100">
          Until this lands you can still query the same data through search at the top of the page.
        </p>
      </div>
    </section>
  );
}

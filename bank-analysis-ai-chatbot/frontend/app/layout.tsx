import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bank Analysis',
  description:
    'Theme-based bank analysis across private credit, digital assets, and AI exposure',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-neutral-200 bg-white">
            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
              <div>
                <div className="font-semibold tracking-tight text-neutral-900 text-lg">
                  Bank Analysis
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  Three-theme scorecard · filings, transcripts, call reports
                </div>
              </div>
              <nav className="flex items-center gap-4 text-sm text-neutral-500">
                <a href="/" className="hover:text-neutral-900 transition-colors">Home</a>
                <a href="/trends" className="hover:text-neutral-900 transition-colors">Trends</a>
                <a href="/anomalies/private-credit" className="hover:text-neutral-900 transition-colors">Anomalies</a>
                <span className="text-neutral-300">|</span>
                <span className="text-xs">cite-backed &middot; auditable trace</span>
              </nav>
            </div>
          </header>
          <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
          <footer className="max-w-6xl mx-auto px-6 py-6 text-xs text-neutral-400">
            Proxy definition: C&amp;I loans to nondepository financial institutions
            (Schedule RC-C 4.a) + unused commitments (RC-L 1.c.(1)) + taxonomy-driven
            footnote extraction. Transcripts limited to prepared remarks in MVP.
          </footer>
        </div>
      </body>
    </html>
  );
}

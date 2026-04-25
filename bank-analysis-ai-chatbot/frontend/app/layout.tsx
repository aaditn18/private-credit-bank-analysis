import './globals.css';
import type { Metadata } from 'next';
import { ChatBotMount } from '@/components/ChatBotMount';

export const metadata: Metadata = {
  title: 'Bank Analysis',
  description:
    'Theme-based bank analysis across private credit, digital assets, and AI exposure',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="sticky top-0 z-30 backdrop-blur-md bg-black/60 border-b border-white/5">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-500/20">
                  B
                </div>
                <div>
                  <div className="font-semibold tracking-tight text-white text-base leading-tight">
                    Bank Analysis
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5 leading-tight">
                    filings · transcripts · call reports
                  </div>
                </div>
              </div>
              <nav className="flex items-center gap-1 text-sm">
                <NavLink href="/">Home</NavLink>
                <NavLink href="/trends">Trends</NavLink>
                <NavLink href="/anomalies/private-credit">Anomalies</NavLink>
                <NavLink href="/compare">Compare</NavLink>
                <span className="ml-3 hidden md:inline-flex items-center gap-1.5 text-[11px] text-neutral-500 px-2.5 py-1 rounded-full border border-white/5 bg-white/[0.03]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  cite-backed · auditable
                </span>
              </nav>
            </div>
          </header>
          <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">{children}</main>
          <ChatBotMount />
          <footer className="border-t border-white/5 mt-12">
            <div className="max-w-6xl mx-auto px-6 py-6 text-xs text-neutral-500 leading-relaxed">
              Proxy definition: C&amp;I loans to nondepository financial institutions
              (Schedule RC-C 4.a) + unused commitments (RC-L 1.c.(1)) + taxonomy-driven
              footnote extraction. Transcripts limited to prepared remarks in MVP.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="px-3 py-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
    >
      {children}
    </a>
  );
}

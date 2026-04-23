'use client';

import { Fragment, useMemo, useState } from 'react';
import clsx from 'clsx';
import type { Citation, DriftSignal } from '@/lib/types';

interface Props {
  answerMarkdown: string;
  citations: Citation[];
  driftSignals: DriftSignal[];
  onCitationClick: (marker: number) => void;
}

function buildMemo(answerMarkdown: string, citations: Citation[]): string {
  const lines: string[] = [];
  lines.push('# Private Credit Analyst — Research Memo');
  lines.push('');
  lines.push(answerMarkdown.trim());

  if (citations.length > 0) {
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('**Sources**');
    lines.push('');
    for (const c of citations) {
      const loc = [
        c.bank,
        c.doc_type,
        c.fiscal_year && c.fiscal_quarter ? `${c.fiscal_year} Q${c.fiscal_quarter}` : null,
        c.section ?? null,
      ]
        .filter(Boolean)
        .join(' · ');
      const snippet = c.text.replace(/\s+/g, ' ').slice(0, 160).trim();
      lines.push(`[${c.marker}] ${loc}`);
      lines.push(`    "${snippet}${c.text.length > 160 ? '…' : ''}"`);
      lines.push('');
    }
  }

  if (citations.length > 0) {
    lines.push('');
    lines.push(
      '*Proxy definition: C&I loans to nondepository financial institutions ' +
        '(Schedule RC-C 4.a) + unused commitments (RC-L 1.c.(1)) + taxonomy-driven ' +
        'footnote extraction. Transcripts limited to prepared remarks.*'
    );
  }

  return lines.join('\n');
}

export function AIOverview({ answerMarkdown, citations, driftSignals, onCitationClick }: Props) {
  const blocks = useMemo(() => splitIntoBlocks(answerMarkdown), [answerMarkdown]);
  const [copied, setCopied] = useState(false);

  function copyMemo() {
    const memo = buildMemo(answerMarkdown, citations);
    navigator.clipboard.writeText(memo).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-neutral-900">AI overview</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-400">
            {citations.length} citation{citations.length === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={copyMemo}
            className="text-xs px-2.5 py-1 rounded border border-neutral-200 bg-white
              hover:bg-neutral-50 text-neutral-600 transition-colors"
          >
            {copied ? '✓ copied' : 'copy as memo'}
          </button>
        </div>
      </div>

      {driftSignals.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <div className="font-medium">Disclosure drift flagged</div>
          <ul className="list-disc ml-5 mt-1 space-y-0.5 text-xs">
            {driftSignals.map((d, i) => (
              <li key={i}>
                {d.bank}: narrative suggests {d.narrative_direction} but Call Report
                {' '}
                {d.concept.replace('_', ' ')} trended {d.quantitative_direction}
                {' '}
                ({d.first_quarter} → {d.last_quarter}).
              </li>
            ))}
          </ul>
        </div>
      )}

      <article className="prose prose-neutral max-w-none text-[15px] leading-relaxed text-neutral-800">
        {blocks.map((b, i) =>
          b.kind === 'heading' ? (
            <h3 key={i} className="font-semibold text-neutral-800 mt-4 mb-2 text-sm uppercase tracking-wide">
              {b.text}
            </h3>
          ) : b.kind === 'bullet' ? (
            <ul key={i} className="list-disc ml-5 mb-3 space-y-1">
              {b.items.map((line, j) => (
                <li key={j}>
                  {renderLineWithCitations(line, onCitationClick)}
                </li>
              ))}
            </ul>
          ) : (
            <p key={i} className="mb-3">
              {renderLineWithCitations(b.text, onCitationClick)}
            </p>
          )
        )}
      </article>
    </section>
  );
}

// ---------- helpers ----------

type Block =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'bullet'; items: string[] };

function splitIntoBlocks(md: string): Block[] {
  const lines = md.split(/\r?\n/);
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let bullets: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
    }
  };
  const flushBullets = () => {
    if (bullets && bullets.length) {
      blocks.push({ kind: 'bullet', items: bullets });
      bullets = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      flushBullets();
      continue;
    }
    if (line.startsWith('## ')) {
      flushParagraph();
      flushBullets();
      blocks.push({ kind: 'heading', text: line.slice(3) });
    } else if (line.startsWith('- ')) {
      flushParagraph();
      if (!bullets) bullets = [];
      bullets.push(line.slice(2));
    } else {
      flushBullets();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushBullets();
  return blocks;
}

function renderLineWithCitations(
  text: string,
  onCitationClick: (marker: number) => void
) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = /^\[(\d+)\]$/.exec(part);
        if (m) {
          const marker = Number(m[1]);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onCitationClick(marker)}
              className={clsx('cite-marker')}
              title={`View source for citation ${marker}`}
            >
              {marker}
            </button>
          );
        }
        return <Fragment key={i}>{renderBold(part)}</Fragment>;
      })}
    </>
  );
}

function renderBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    const m = /^\*\*(.+)\*\*$/.exec(p);
    if (m) return <strong key={i}>{m[1]}</strong>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

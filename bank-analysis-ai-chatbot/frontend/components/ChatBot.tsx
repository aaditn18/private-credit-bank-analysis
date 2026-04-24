'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { runSearch } from '@/lib/api';
import type { Citation, SearchResponse } from '@/lib/types';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  id: number;
  role: ChatRole;
  text: string;
  loading?: boolean;
  error?: string | null;
  resp?: SearchResponse | null;
}

let nextId = 1;

const SUGGESTIONS = [
  "How much of DFS's investments is in private credit?",
  'Compare NBFI exposure across FHN, FLG, and DFS in 2024Q4',
  'What has JPM disclosed about direct lending and fund finance?',
  'Which mid-size regional banks are growing their NBFI lending the fastest?',
];

export function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const anyLoading = messages.some((m) => m.loading);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || anyLoading) return;
    const userMsg: ChatMessage = { id: nextId++, role: 'user', text: trimmed };
    const asstId = nextId++;
    const asstMsg: ChatMessage = { id: asstId, role: 'assistant', text: '', loading: true, error: null };
    setMessages((prev) => [...prev, userMsg, asstMsg]);
    setInput('');

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const r = await runSearch(trimmed, ctrl.signal);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstId
            ? { ...m, loading: false, text: r.answer_markdown, resp: r }
            : m,
        ),
      );
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstId
            ? { ...m, loading: false, error: e instanceof Error ? e.message : String(e) }
            : m,
        ),
      );
    } finally {
      abortRef.current = null;
    }
  }

  function clearChat() {
    abortRef.current?.abort();
    setMessages([]);
  }

  // ── Minimized floating bubble ─────────────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open chat"
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700
          text-white shadow-lg flex items-center justify-center transition-colors"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-indigo-600
            text-[10px] font-bold flex items-center justify-center border-2 border-indigo-600">
            {Math.min(messages.filter((m) => m.role === 'assistant').length, 99)}
          </span>
        )}
      </button>
    );
  }

  // ── Expanded chat panel ───────────────────────────────────────────────────
  return (
    <div className="fixed bottom-5 right-5 z-50 w-[420px] max-w-[calc(100vw-2rem)]
      h-[640px] max-h-[calc(100vh-2rem)]
      rounded-2xl border border-neutral-200 bg-white shadow-2xl flex flex-col overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 bg-indigo-600 text-white">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <div>
            <div className="text-sm font-semibold">Bank Analyst</div>
            <div className="text-[11px] text-indigo-100">Ask about any of 50 banks</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="text-[11px] px-2 py-1 rounded text-indigo-100 hover:bg-indigo-700"
              title="Clear conversation"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            aria-label="Minimize"
            className="w-7 h-7 rounded hover:bg-indigo-700 flex items-center justify-center"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" d="M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-neutral-50">
        {messages.length === 0 && (
          <div className="space-y-3 mt-2">
            <p className="text-sm text-neutral-500 px-2">
              Ask about private credit, NBFI exposure, AI usage, or digital-asset strategy
              across 50 major U.S. banks.
            </p>
            <div className="space-y-1.5">
              {SUGGESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-white
                    border border-neutral-200 hover:border-indigo-300 hover:bg-indigo-50
                    text-neutral-700 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === 'user' ? (
            <UserBubble key={m.id} text={m.text} />
          ) : (
            <AssistantBubble key={m.id} msg={m} />
          ),
        )}
      </div>

      {/* input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="border-t border-neutral-100 px-3 py-2.5 bg-white flex items-end gap-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
          rows={1}
          placeholder="Type a question…"
          className="flex-1 resize-none text-sm px-3 py-2 rounded-lg border border-neutral-200
            focus:outline-none focus:ring-2 focus:ring-indigo-400 max-h-24"
        />
        <button
          type="submit"
          disabled={!input.trim() || anyLoading}
          className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium
            hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {anyLoading ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            'Ask'
          )}
        </button>
      </form>
    </div>
  );
}

// ── message components ─────────────────────────────────────────────────────

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-br-sm bg-indigo-600 text-white text-sm">
        {text}
      </div>
    </div>
  );
}

function AssistantBubble({ msg }: { msg: ChatMessage }) {
  const [expandedCitation, setExpandedCitation] = useState<number | null>(null);

  if (msg.loading) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-bl-sm bg-white border border-neutral-200
          text-sm text-neutral-500 flex items-center gap-2">
          <span className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
          </span>
          Analysing…
        </div>
      </div>
    );
  }

  if (msg.error) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-bl-sm bg-red-50 border border-red-200
          text-sm text-red-800">
          <div className="font-medium text-xs mb-0.5">Something went wrong</div>
          {msg.error}
        </div>
      </div>
    );
  }

  const resp = msg.resp;
  if (!resp) return null;

  return (
    <div className="flex justify-start">
      <div className="max-w-[95%] w-full space-y-2">
        <div className="px-3 py-2.5 rounded-2xl rounded-bl-sm bg-white border border-neutral-200 text-sm text-neutral-800">
          <RenderedAnswer
            markdown={resp.answer_markdown}
            onCitationClick={(m) => setExpandedCitation((prev) => (prev === m ? null : m))}
          />
        </div>
        {resp.citations.length > 0 && (
          <CitationsList
            citations={resp.citations}
            expanded={expandedCitation}
            onToggle={(m) => setExpandedCitation((prev) => (prev === m ? null : m))}
          />
        )}
      </div>
    </div>
  );
}

// ── citation rendering (inlined, narrower than AIOverview) ────────────────

function RenderedAnswer({
  markdown,
  onCitationClick,
}: {
  markdown: string;
  onCitationClick: (marker: number) => void;
}) {
  const blocks = splitIntoBlocks(markdown);
  return (
    <div className="space-y-2 leading-relaxed">
      {blocks.map((b, i) =>
        b.kind === 'heading' ? (
          <div key={i} className="font-semibold text-[11px] uppercase tracking-wide text-neutral-500 pt-1">
            {b.text}
          </div>
        ) : b.kind === 'bullet' ? (
          <ul key={i} className="list-disc ml-4 space-y-1">
            {b.items.map((line, j) => (
              <li key={j}>{renderLineWithCitations(line, onCitationClick)}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{renderLineWithCitations(b.text, onCitationClick)}</p>
        ),
      )}
    </div>
  );
}

function CitationsList({
  citations,
  expanded,
  onToggle,
}: {
  citations: Citation[];
  expanded: number | null;
  onToggle: (m: number) => void;
}) {
  return (
    <div className="rounded-xl bg-white border border-neutral-200 overflow-hidden">
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-neutral-400 font-semibold border-b border-neutral-100">
        {citations.length} source{citations.length === 1 ? '' : 's'}
      </div>
      <div className="divide-y divide-neutral-100">
        {citations.map((c) => {
          const isOpen = expanded === c.marker;
          const meta = [
            c.bank,
            c.doc_type,
            c.fiscal_year && c.fiscal_quarter ? `${c.fiscal_year} Q${c.fiscal_quarter}` : null,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <div key={c.marker}>
              <button
                onClick={() => onToggle(c.marker)}
                className="w-full text-left px-3 py-2 hover:bg-neutral-50 flex items-start gap-2"
              >
                <span className="shrink-0 w-5 h-5 rounded bg-indigo-50 text-indigo-600 text-[11px]
                  font-bold flex items-center justify-center">
                  {c.marker}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-neutral-800 truncate">{meta}</div>
                  {c.section && (
                    <div className="text-[11px] text-neutral-400 truncate">{c.section}</div>
                  )}
                </div>
                <span className="text-neutral-300 text-xs">{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && (
                <div className="px-3 pb-3 text-[12px] text-neutral-600 whitespace-pre-wrap leading-snug bg-neutral-50">
                  {c.text.length > 1200 ? c.text.slice(0, 1200) + '…' : c.text}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── markdown → blocks (mirrors AIOverview helpers) ────────────────────────

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
    if (line.startsWith('## ') || line.startsWith('### ')) {
      flushParagraph();
      flushBullets();
      blocks.push({ kind: 'heading', text: line.replace(/^#+\s*/, '') });
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

function renderLineWithCitations(text: string, onCitationClick: (marker: number) => void) {
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
              className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 mx-0.5
                rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold hover:bg-indigo-200 align-middle"
              title={`Source ${marker}`}
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

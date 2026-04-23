'use client';

import { FormEvent, useState } from 'react';

interface Props {
  onSubmit: (question: string) => void;
  loading?: boolean;
  initial?: string;
}

const EXAMPLES = [
  'How much of DFS\'s investments is in private credit?',
  'Compare NBFI exposure across FHN, FLG, and DFS in 2024Q4',
  'What has JPM disclosed about direct lending and fund finance?',
  'Has FHN\'s management commentary on NBFI lending matched their Call Report trend?',
  'Compare the top 10 banks by private credit exposure in 2025Q4',
  'Which mid-size regional banks are growing their NBFI lending the fastest?',
  'What are the 20 largest banks saying about private credit competition?',
];

export function SearchBar({ onSubmit, loading, initial }: Props) {
  const [value, setValue] = useState(initial ?? '');

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    onSubmit(q);
  }

  return (
    <div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          className="flex-1 px-4 py-3 rounded-lg border border-neutral-300 bg-white shadow-sm
            focus:outline-none focus:ring-2 focus:ring-indigo-400 text-[15px]"
          placeholder="Ask a question about private credit / NBFI exposure..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          className="px-5 py-3 rounded-lg bg-indigo-600 text-white font-medium text-sm
            hover:bg-indigo-700 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Analysing…' : 'Ask'}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => {
              setValue(q);
              onSubmit(q);
            }}
            className="text-xs px-3 py-1.5 rounded-full border border-neutral-200
              bg-white hover:bg-neutral-100 text-neutral-600"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

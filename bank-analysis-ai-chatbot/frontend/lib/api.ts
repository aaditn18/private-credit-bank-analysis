import type { CitationDetail, SearchResponse } from './types';

const BASE = '/api/backend';

export async function runSearch(question: string, signal?: AbortSignal): Promise<SearchResponse> {
  const res = await fetch(`${BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
    cache: 'no-store',
    signal,
  });
  if (!res.ok) {
    throw new Error(`search failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function fetchCitation(chunkId: number): Promise<CitationDetail> {
  const res = await fetch(`${BASE}/citations/${chunkId}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`citation failed: ${res.status}`);
  return res.json();
}

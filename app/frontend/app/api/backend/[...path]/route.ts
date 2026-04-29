// Custom backend proxy. Replaces the `rewrites()` entry in next.config.mjs
// because Next.js rewrites impose a ~30-second hard timeout that was causing
// spurious 500s on slow LLM + retrieval searches (which can legitimately
// take 40-60s).

import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 5-minute ceiling — well beyond anything a real search should take.
export const maxDuration = 300;

const BACKEND = process.env.BACKEND_URL || 'http://localhost:8000';

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const url = new URL(req.url);
  const target = `${BACKEND}/${path.join('/')}${url.search}`;

  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');

  const hasBody = !['GET', 'HEAD'].includes(req.method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  try {
    const res = await fetch(target, {
      method: req.method,
      headers,
      body,
      // Give the backend up to 4 minutes. Our searches top out around 60s
      // in the worst case, so this is generous headroom without making
      // stuck requests wait forever.
      signal: AbortSignal.timeout(240_000),
      // Undici requires duplex for streaming request bodies.
      // @ts-expect-error Node.js fetch option
      duplex: 'half',
    });

    const resHeaders = new Headers(res.headers);
    resHeaders.delete('content-encoding');
    resHeaders.delete('content-length');
    resHeaders.delete('transfer-encoding');

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: resHeaders,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ detail: `backend proxy failed: ${msg}`, target }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;

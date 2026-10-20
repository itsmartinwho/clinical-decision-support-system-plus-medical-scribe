// @vitest-environment node
// The guideline routes: semantic search falls back to text search without an
// OpenAI key, and the routes that spend money refuse without the admin secret.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const textRow = { id: 7, title: 'Hypertension in adults', content: 'Offer...', source: 'NICE', specialty: 'Cardiology', similarity: 0.4 };

vi.mock('@/lib/supabaseClient', () => ({
  getSupabaseClient: () => ({
    rpc: (fn: string) => Promise.resolve(fn === 'search_guidelines_text'
      ? { data: [textRow], error: null }
      : { data: null, error: { message: `unexpected ${fn}` } }),
  }),
}));

const saved = { ...process.env };
beforeEach(() => { delete process.env.OPENAI_API_KEY; delete process.env.GUIDELINES_ADMIN_SECRET; });
afterEach(() => { process.env = { ...saved }; vi.resetModules(); });

describe('/api/guidelines/search', () => {
  it('answers a semantic search with text results, saying so, when there is no OpenAI key', async () => {
    const { GET } = await import('@/app/api/guidelines/search/route');
    const res = await GET(new NextRequest('http://x/api/guidelines/search?q=hypertension&type=semantic'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ type: 'semantic', fallback: 'text' });
    expect(body.results[0]).toMatchObject({ id: 7, metadata: { title: 'Hypertension in adults', source: 'NICE' } });
  });

  it('keeps the text half of a combined search when embeddings are unavailable', async () => {
    const { GET } = await import('@/app/api/guidelines/search/route');
    const body = await (await GET(new NextRequest('http://x/api/guidelines/search?q=hypertension'))).json();
    expect(body.results.semanticResults).toEqual([]);
    expect(body.results.textResults).toHaveLength(1);
  });
});

describe('/api/guidelines/embed', () => {
  it('refuses when no admin secret is configured', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const { POST } = await import('@/app/api/guidelines/embed/route');
    const res = await POST(new NextRequest('http://x/api/guidelines/embed', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(403);
  });

  it('refuses a request without the secret when one is configured', async () => {
    process.env.GUIDELINES_ADMIN_SECRET = 'a-long-admin-secret';
    const { POST } = await import('@/app/api/guidelines/embed/route');
    const res = await POST(new NextRequest('http://x/api/guidelines/embed', {
      method: 'POST', body: '{}', headers: { authorization: 'Bearer wrong' },
    }));
    expect(res.status).toBe(401);
  });
});

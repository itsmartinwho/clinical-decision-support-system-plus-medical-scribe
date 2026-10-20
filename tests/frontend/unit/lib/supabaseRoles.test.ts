// @vitest-environment node
// On the server, the app's client holds the anon key even when the service
// role key is set, so row level security still decides what a route like
// /api/differential-diagnoses may do; only getSupabaseServiceClient() carries
// the service role key.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ENV_KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
const savedEnv: Record<string, string | undefined> = {};
const realFetch = globalThis.fetch;

beforeEach(() => {
  for (const k of ENV_KEYS) { savedEnv[k] = process.env[k]; delete process.env[k]; }
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

const keyOf = (call: unknown[]) => {
  const init = (call[1] ?? {}) as RequestInit;
  return new Headers(init.headers).get('apikey');
};

describe('Supabase roles on the server', () => {
  it('reads the anon key unless the service role is asked for by name', async () => {
    vi.resetModules();
    const { readSupabaseConfig } = await import('@/lib/dataMode');
    expect(readSupabaseConfig()?.key).toBe('test-anon-key');
    expect(readSupabaseConfig('anon')?.key).toBe('test-anon-key');
    expect(readSupabaseConfig('service')?.key).toBe('test-service-key');
  });

  it('falls back to the anon key for the service client when no service key is set', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.resetModules();
    const { readSupabaseConfig } = await import('@/lib/dataMode');
    expect(readSupabaseConfig('service')?.key).toBe('test-anon-key');
  });

  it('sends the anon key from getSupabaseClient() and the service key only from getSupabaseServiceClient()', async () => {
    const fetchSpy = vi.fn(async () => new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    globalThis.fetch = fetchSpy as any;
    vi.resetModules();
    const { getSupabaseClient, getSupabaseServiceClient } = await import('@/lib/supabaseClient');

    await getSupabaseClient().from('differential_diagnoses').select('*').eq('encounter_id', 'e1');
    const probe = fetchSpy.mock.calls[0];
    const anonQuery = fetchSpy.mock.calls.at(-1)!;
    expect(String(probe[0])).toContain('/rest/v1/patients');
    expect(keyOf(probe)).toBe('test-anon-key');
    expect(String(anonQuery[0])).toContain('/rest/v1/differential_diagnoses');
    expect(keyOf(anonQuery)).toBe('test-anon-key');

    await getSupabaseServiceClient().from('guidelines_docs').select('id');
    const serviceQuery = fetchSpy.mock.calls.at(-1)!;
    expect(String(serviceQuery[0])).toContain('/rest/v1/guidelines_docs');
    expect(keyOf(serviceQuery)).toBe('test-service-key');
  });
});

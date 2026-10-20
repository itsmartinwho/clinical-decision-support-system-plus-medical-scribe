// The data layer falls back to the bundled demo data when Supabase is not
// configured, cannot be reached, or does not answer in time; and it uses
// Supabase when it answers.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DOROTHY = '0681FA35-A794-4684-97BD-00B88370DB41';
const ENV_KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
const savedEnv: Record<string, string | undefined> = {};
const realFetch = globalThis.fetch;

async function freshModules() {
  vi.resetModules();
  const dataMode = await import('@/lib/dataMode');
  const { supabaseDataService } = await import('@/lib/supabaseDataService');
  const { getSupabaseClient } = await import('@/lib/supabaseClient');
  return { dataMode, supabaseDataService, getSupabaseClient };
}

function configure(url = 'https://doesnotexist00000000000.supabase.co') {
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-anon-key';
}

beforeEach(() => {
  for (const k of ENV_KEYS) { savedEnv[k] = process.env[k]; delete process.env[k]; }
  window.sessionStorage.clear();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  globalThis.fetch = realFetch;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('data mode', () => {
  it('uses the demo data when Supabase is not configured, without a network call', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as any;
    const { dataMode, supabaseDataService } = await freshModules();

    const mode = await dataMode.resolveDataMode();
    expect(mode).toMatchObject({ source: 'demo', reason: 'unconfigured' });
    expect(fetchSpy).not.toHaveBeenCalled();

    await supabaseDataService.loadPatientData();
    const patients = supabaseDataService.getAllPatients();
    expect(patients.map((p) => p.name)).toEqual(['Dorothy Robinson']);
  });

  it('uses the demo data when Supabase cannot be reached (DNS failure, refused connection)', async () => {
    configure();
    const fetchSpy = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    globalThis.fetch = fetchSpy as any;
    const { dataMode, supabaseDataService } = await freshModules();

    await supabaseDataService.loadPatientData();
    expect(dataMode.getDataMode()).toMatchObject({ source: 'demo', reason: 'unreachable' });
    expect(dataMode.getDataMode()?.detail).toContain('Failed to fetch');
    // One probe, then everything comes from the bundled data.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/rest/v1/patients');

    const payload = await supabaseDataService.getPatientData(DOROTHY);
    expect(payload?.patient.name).toBe('Dorothy Robinson');
    expect(payload?.encounters).toHaveLength(4);
  });

  it('uses the demo data when Supabase does not answer within the timeout', async () => {
    vi.useFakeTimers();
    configure();
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as any; // never answers
    const { dataMode } = await freshModules();

    const settled = dataMode.resolveDataMode();
    await vi.advanceTimersByTimeAsync(dataMode.PROBE_TIMEOUT_MS + 1);
    await expect(settled).resolves.toMatchObject({ source: 'demo', reason: 'timeout' });
  });

  it('calls it a timeout when the request is aborted for taking too long', async () => {
    vi.useFakeTimers();
    configure();
    // A fetch that honours its abort signal, as the real one does.
    globalThis.fetch = vi.fn((_url: string, init: RequestInit) => new Promise((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })) as any;
    const { dataMode } = await freshModules();
    const settled = dataMode.resolveDataMode();
    await vi.advanceTimersByTimeAsync(dataMode.PROBE_TIMEOUT_MS + 1);
    await expect(settled).resolves.toMatchObject({ source: 'demo', reason: 'timeout' });
  });

  it('queries made before the check settles wait for it, then read the demo data', async () => {
    vi.useFakeTimers();
    configure();
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as any;
    const { getSupabaseClient, dataMode } = await freshModules();

    const query = getSupabaseClient().from('patients').select('first_name, last_name').eq('patient_id', DOROTHY).single();
    const answer = Promise.resolve(query);
    await vi.advanceTimersByTimeAsync(dataMode.PROBE_TIMEOUT_MS + 1);
    const { data, error } = await answer;
    expect(error).toBeNull();
    expect(data).toEqual({ first_name: 'Dorothy', last_name: 'Robinson' });
  });

  it('uses the demo data when Supabase refuses the request (a wrong key)', async () => {
    configure();
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('{"message":"Invalid API key"}', { status: 401 })) as any;
    const { dataMode } = await freshModules();
    await expect(dataMode.resolveDataMode()).resolves.toMatchObject({ source: 'demo', reason: 'rejected' });
  });

  it('uses Supabase when it answers', async () => {
    configure('https://example.supabase.co');
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('[]', { status: 200 })) as any;
    const { dataMode } = await freshModules();
    await expect(dataMode.resolveDataMode()).resolves.toEqual({ source: 'supabase' });
  });
});

describe('writes on the demo data', () => {
  it('last for the tab: a new encounter is in sessionStorage and survives a reload', async () => {
    const first = await freshModules();
    await first.supabaseDataService.loadPatientData();
    const encounter = await first.supabaseDataService.createNewEncounter(DOROTHY, { reason: 'Follow-up' });
    expect(encounter.reasonDisplayText).toBe('Follow-up');
    expect(window.sessionStorage.getItem('foresight.demoData.v1')).toContain('Follow-up');

    // A reload of the page: new modules, same tab.
    const second = await freshModules();
    await second.supabaseDataService.loadPatientData();
    const reasons = second.supabaseDataService.getPatientEncounters(DOROTHY).map((e) => e.reasonDisplayText);
    expect(reasons).toContain('Follow-up');
    expect(reasons).toHaveLength(5);
  });

  it('keeps the guided demo patient when the demo ends', async () => {
    const { supabaseDataService } = await freshModules();
    await supabaseDataService.loadPatientData();
    supabaseDataService.clearDemoPatientData(DOROTHY);
    expect(supabaseDataService.getPatient(DOROTHY)?.name).toBe('Dorothy Robinson');
  });
});

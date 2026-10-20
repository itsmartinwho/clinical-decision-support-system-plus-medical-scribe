// @vitest-environment node
// tests/frontend/unit/lib/guidelinesAdminRoutes.test.ts
// The guideline ingest and schedule routes run with the service role, which
// bypasses row level security, so they refuse unless the request carries the
// server-side admin secret, and refuse everything when it is not set. The
// orchestrator and the scheduler are mocked: nothing real is ingested.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  ingestAll: vi.fn(),
  ingestSource: vi.fn(),
  getAvailableSources: vi.fn(),
  getScheduleStatus: vi.fn(),
  triggerManualRefresh: vi.fn(),
  setupMonthlyRefresh: vi.fn()
}));

vi.mock('@/services/guidelines/ingestion-orchestrator', () => ({
  IngestionOrchestrator: class {
    ingestAll = mocks.ingestAll;
    ingestSource = mocks.ingestSource;
    getAvailableSources = mocks.getAvailableSources;
  }
}));

vi.mock('@/services/guidelines/scheduler', () => ({
  getScheduler: () => ({
    getScheduleStatus: mocks.getScheduleStatus,
    triggerManualRefresh: mocks.triggerManualRefresh,
    setupMonthlyRefresh: mocks.setupMonthlyRefresh
  })
}));

import { GET as ingestGET, POST as ingestPOST } from '@/app/api/guidelines/ingest/route';
import { GET as scheduleGET, POST as schedulePOST } from '@/app/api/guidelines/schedule/route';
import { requireAdminSecret } from '@/lib/adminAuth';

const SECRET = 'test-admin-secret-0123456789';

const request = (method: 'GET' | 'POST', authorization?: string, body?: unknown) =>
  new Request('http://localhost/api/guidelines/x', {
    method,
    headers: {
      ...(authorization === undefined ? {} : { Authorization: authorization }),
      'Content-Type': 'application/json'
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  }) as unknown as NextRequest;

// Every way of being refused, for one handler.
const refusals = (name: string, call: (authorization?: string) => Promise<Response>, spies: () => Array<ReturnType<typeof vi.fn>>) => {
  describe(`${name} refuses`, () => {
    it('with no Authorization header', async () => {
      const response = await call();
      expect(response.status).toBe(401);
      expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
      expect(await response.json()).toEqual({ error: 'Unauthorized' });
      spies().forEach(spy => expect(spy).not.toHaveBeenCalled());
    });

    it('with the wrong secret', async () => {
      const response = await call('Bearer not-the-secret');
      expect(response.status).toBe(401);
      spies().forEach(spy => expect(spy).not.toHaveBeenCalled());
    });

    it('with the secret but not as a Bearer token', async () => {
      expect((await call(SECRET)).status).toBe(401);
      expect((await call(`Basic ${SECRET}`)).status).toBe(401);
    });

    it('with a secret that only starts like the real one', async () => {
      expect((await call(`Bearer ${SECRET}x`)).status).toBe(401);
      expect((await call(`Bearer ${SECRET.slice(0, -1)}`)).status).toBe(401);
    });

    it('whatever it is sent while ADMIN_SECRET is unset, an empty one included', async () => {
      vi.stubEnv('ADMIN_SECRET', '');
      expect((await call('Bearer ')).status).toBe(401);
      expect((await call(`Bearer ${SECRET}`)).status).toBe(401);
      vi.unstubAllEnvs();
      delete process.env.ADMIN_SECRET;
      expect((await call('Bearer undefined')).status).toBe(401);
      expect((await call('Bearer ')).status).toBe(401);
      spies().forEach(spy => expect(spy).not.toHaveBeenCalled());
    });
  });
};

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubEnv('ADMIN_SECRET', SECRET);
  mocks.ingestAll.mockResolvedValue({ ok: true });
  mocks.ingestSource.mockResolvedValue({ ok: true });
  mocks.getAvailableSources.mockReturnValue([{ source: 'NICE', configured: true }, { source: 'USPSTF', configured: true }]);
  mocks.getScheduleStatus.mockResolvedValue({ nextRun: new Date('2030-01-01T00:00:00Z'), lastRun: undefined, isDue: false, isRunning: false });
  mocks.triggerManualRefresh.mockResolvedValue(undefined);
  mocks.setupMonthlyRefresh.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('requireAdminSecret', () => {
  it('lets a request through only with Bearer <ADMIN_SECRET>', () => {
    expect(requireAdminSecret(request('POST', `Bearer ${SECRET}`))).toBeNull();
    expect(requireAdminSecret(request('POST', 'Bearer nope'))?.status).toBe(401);
  });
});

refusals('POST /api/guidelines/ingest', auth => ingestPOST(request('POST', auth, { source: 'all' })), () => [mocks.ingestAll, mocks.ingestSource]);
refusals('GET /api/guidelines/ingest', auth => ingestGET(request('GET', auth)), () => [mocks.getAvailableSources]);
refusals('POST /api/guidelines/schedule', auth => schedulePOST(request('POST', auth, { action: 'trigger' })), () => [mocks.triggerManualRefresh, mocks.setupMonthlyRefresh, mocks.getScheduleStatus]);
refusals('GET /api/guidelines/schedule', auth => scheduleGET(request('GET', auth)), () => [mocks.getScheduleStatus]);

describe('with the right secret', () => {
  const auth = `Bearer ${SECRET}`;

  it('POST /api/guidelines/ingest runs the ingestion', async () => {
    const response = await ingestPOST(request('POST', auth, { source: 'all' }));
    expect(response.status).toBe(200);
    expect(mocks.ingestAll).toHaveBeenCalledTimes(1);
  });

  it('GET /api/guidelines/ingest lists the sources', async () => {
    const response = await ingestGET(request('GET', auth));
    expect(response.status).toBe(200);
    expect((await response.json()).availableSources.map((s: { source: string }) => s.source)).toEqual(['NICE', 'USPSTF']);
  });

  it('POST /api/guidelines/schedule still validates what it is asked', async () => {
    const response = await schedulePOST(request('POST', auth, { action: 'trigger', sources: ['NOT_A_SOURCE'] }));
    expect(response.status).toBe(400);
    expect(mocks.triggerManualRefresh).not.toHaveBeenCalled();

    const ok = await schedulePOST(request('POST', auth, { action: 'status' }));
    expect(ok.status).toBe(200);
  });

  it('GET /api/guidelines/schedule reports the schedule', async () => {
    const response = await scheduleGET(request('GET', auth));
    expect(response.status).toBe(200);
    expect((await response.json()).schedule.isDue).toBe(false);
  });
});

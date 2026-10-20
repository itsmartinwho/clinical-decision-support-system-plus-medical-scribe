// @vitest-environment node
// tests/frontend/unit/lib/realTimeAlertsRoute.test.ts
// The real-time alerts route: a pass needs nothing from an earlier request,
// and starting a session sets no timer on the server. The alert engine and the
// alerts service are mocked: no real calls.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  processRealTimeAlerts: vi.fn(),
  resetTranscriptTracking: vi.fn(),
  updateTranscript: vi.fn()
}));

vi.mock('@/lib/alerts/alert-engine', () => ({
  alertEngine: { processRealTimeAlerts: mocks.processRealTimeAlerts }
}));

vi.mock('@/lib/unifiedAlertsService', () => ({
  UnifiedAlertsService: class {
    resetTranscriptTracking = mocks.resetTranscriptTracking;
    updateTranscript = mocks.updateTranscript;
  }
}));

import { POST } from '@/app/api/alerts/real-time/route';
import { realTimeProcessor } from '@/lib/alerts/real-time-processor';

const call = (body: Record<string, unknown>) =>
  POST(new Request('http://localhost/api/alerts/real-time', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }) as unknown as NextRequest);

const ids = { patientId: 'patient-1', encounterId: 'encounter-1' };

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  mocks.processRealTimeAlerts.mockResolvedValue([]);
});

afterEach(() => {
  realTimeProcessor.cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('POST /api/alerts/real-time', () => {
  it('runs a pass on what the request carries, with no session', async () => {
    const found = { id: 'alert-1', title: 'Warfarin and ibuprofen' };
    mocks.processRealTimeAlerts.mockResolvedValue([found]);

    const response = await call({
      ...ids,
      action: 'process',
      transcriptSegment: 'started ibuprofen last week.',
      fullTranscript: 'She takes warfarin and started ibuprofen last week.'
    });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.processRealTimeAlerts).toHaveBeenCalledWith(
      'patient-1',
      'encounter-1',
      'started ibuprofen last week.',
      'She takes warfarin and started ibuprofen last week.'
    );
    expect(result).toMatchObject({ success: true, alerts: [found], alertCount: 1 });
  });

  it('refuses a pass without a transcript segment', async () => {
    const response = await call({ ...ids, action: 'process' });

    expect(response.status).toBe(400);
    expect(mocks.processRealTimeAlerts).not.toHaveBeenCalled();
  });

  it('starts and ends a session without setting a timer or running a pass', async () => {
    vi.useFakeTimers();

    const started = await call({ ...ids, action: 'start_session' });
    expect(started.status).toBe(200);
    expect((await started.json()).stats).toMatchObject({ activeSessions: 1 });
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(120_000);
    expect(mocks.processRealTimeAlerts).not.toHaveBeenCalled();

    const ended = await call({ ...ids, action: 'end_session' });
    expect(ended.status).toBe(200);
    expect((await ended.json()).stats).toMatchObject({ activeSessions: 0 });
  });
});

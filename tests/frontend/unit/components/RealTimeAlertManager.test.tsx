// tests/frontend/unit/components/RealTimeAlertManager.test.tsx
// /copilot's live alert panel goes through the server, never the alert engine
// in the browser. Fetch and the engine are mocked: no real calls.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { AlertSeverity, AlertStatus, AlertType } from '@/types/alerts';

const engine = vi.hoisted(() => ({ processRealTimeAlerts: vi.fn() }));

vi.mock('@/lib/alerts/alert-engine', () => ({
  AlertEngine: class {
    processRealTimeAlerts = engine.processRealTimeAlerts;
  },
  alertEngine: engine
}));

import RealTimeAlertManager from '@/components/alerts/RealTimeAlertManager';

const TRANSCRIPT = 'She takes warfarin and started ibuprofen last week for knee pain.';

const reply = (body: unknown) => ({ ok: true, status: 200, statusText: 'OK', json: async () => body });

let fetchMock: ReturnType<typeof vi.fn>;
const sent = (action: string) =>
  fetchMock.mock.calls
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)))
    .filter(body => body.action === action);

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    if (body.action === 'process') {
      return reply({
        success: true,
        alerts: [{
          id: 'alert-1',
          patientId: body.patientId,
          encounterId: body.encounterId,
          alertType: AlertType.DRUG_INTERACTION,
          severity: AlertSeverity.WARNING,
          status: AlertStatus.ACTIVE,
          title: 'Warfarin and ibuprofen',
          message: 'Together they raise the risk of bleeding.',
          createdAt: '2026-10-20T10:00:00Z',
          updatedAt: '2026-10-20T10:00:00Z',
          isRealTime: true,
          isPostConsultation: false,
          acknowledged: false,
          migratedFromPatientAlerts: false
        }]
      });
    }
    return reply({ stats: { activeSessions: body.action === 'start_session' ? 1 : 0 } });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('RealTimeAlertManager', () => {
  it('sends the transcript to the server and shows the alert it returns', async () => {
    const onAlert = vi.fn();
    const props = { patientId: 'patient-1', consultationId: 'encounter-1', onAlert };
    const { rerender } = render(<RealTimeAlertManager isActive transcript={TRANSCRIPT} {...props} />);

    // The session starts, then the first pass comes 10 s later
    await act(async () => {});
    expect(sent('start_session')).toHaveLength(1);
    expect(sent('process')).toHaveLength(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(sent('process')).toEqual([
      expect.objectContaining({
        patientId: 'patient-1',
        encounterId: 'encounter-1',
        transcriptSegment: TRANSCRIPT,
        fullTranscript: TRANSCRIPT
      })
    ]);
    expect(screen.getByText('Warfarin and ibuprofen')).toBeInTheDocument();
    expect(onAlert).toHaveBeenCalledWith(expect.objectContaining({ id: 'alert-1' }));
    expect(engine.processRealTimeAlerts).not.toHaveBeenCalled();

    await act(async () => {
      rerender(<RealTimeAlertManager isActive={false} transcript={TRANSCRIPT} {...props} />);
    });
    expect(sent('end_session')).toHaveLength(1);
  });

  it('sends nothing while the consultation is not active', async () => {
    render(<RealTimeAlertManager isActive={false} patientId="patient-1" consultationId="encounter-1" transcript={TRANSCRIPT} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(engine.processRealTimeAlerts).not.toHaveBeenCalled();
  });
});

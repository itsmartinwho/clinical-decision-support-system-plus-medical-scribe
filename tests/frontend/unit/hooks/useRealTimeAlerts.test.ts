// tests/frontend/unit/hooks/useRealTimeAlerts.test.ts
// The live alert passes as the client runs them, with fetch mocked and fake
// timers: no real calls.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRealTimeAlerts } from '@/hooks/useRealTimeAlerts';
import { AlertSeverity, AlertStatus, AlertType, UnifiedAlert } from '@/types/alerts';

type Body = Record<string, any>;
type Reply = { ok: boolean; status: number; statusText: string; json: () => Promise<unknown> };

const reply = (body: unknown, ok = true): Reply => ({
  ok,
  status: ok ? 200 : 500,
  statusText: ok ? 'OK' : 'Internal Server Error',
  json: async () => body
});

const alert = (id: string, title: string): UnifiedAlert => ({
  id,
  patientId: 'patient-1',
  encounterId: 'encounter-1',
  alertType: AlertType.DRUG_INTERACTION,
  severity: AlertSeverity.WARNING,
  status: AlertStatus.ACTIVE,
  title,
  message: 'Warfarin with ibuprofen raises the risk of bleeding.',
  createdAt: '2026-10-20T10:00:00Z',
  updatedAt: '2026-10-20T10:00:00Z',
  isRealTime: true,
  isPostConsultation: false,
  acknowledged: false,
  migratedFromPatientAlerts: false
});

const FIRST = 'Patient reports chest pain on exertion.';
const SECOND = ' She takes warfarin and started ibuprofen last week.';

let processReply: (body: Body) => Promise<Reply>;
let fetchMock: ReturnType<typeof vi.fn>;

const sent = (action?: string): Body[] =>
  fetchMock.mock.calls
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)))
    .filter((body: Body) => !action || body.action === action);

// Move the clock, and let the passes it sets off finish
const elapse = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const setup = (options: { onAlert?: (a: UnifiedAlert) => void; onError?: (e: Error) => void } = {}) =>
  renderHook(() =>
    useRealTimeAlerts({
      enabled: true,
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      ...options
    })
  );

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  processReply = async () => reply({ success: true, alerts: [] });
  fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    if (body.action === 'start_session') return reply({ stats: { activeSessions: 1 } });
    if (body.action === 'end_session') return reply({ stats: { activeSessions: 0 } });
    if (body.action === 'process') return processReply(body);
    return reply({ error: 'unexpected' }, false);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useRealTimeAlerts', () => {
  it('runs no passes before a session starts', async () => {
    const { result } = setup();

    act(() => result.current.updateTranscript(FIRST + SECOND));
    await elapse(30_000);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends nothing when the transcript changes, only when a pass runs', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.startSession();
    });

    act(() => {
      result.current.updateTranscript(FIRST);
      result.current.updateTranscript(FIRST + SECOND);
    });

    expect(sent().map(body => body.action)).toEqual(['start_session']);
  });

  it('sends each new stretch every 10 s, with the whole transcript', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.startSession();
    });

    act(() => result.current.updateTranscript(FIRST));
    await elapse(9_999);
    expect(sent('process')).toHaveLength(0);

    await elapse(1);
    expect(sent('process')).toEqual([
      {
        patientId: 'patient-1',
        encounterId: 'encounter-1',
        action: 'process',
        transcriptSegment: FIRST,
        fullTranscript: FIRST
      }
    ]);
    expect(fetchMock).toHaveBeenLastCalledWith('/api/alerts/real-time', expect.objectContaining({ method: 'POST' }));

    act(() => result.current.updateTranscript(FIRST + SECOND));
    await elapse(10_000);
    expect(sent('process')[1]).toMatchObject({
      transcriptSegment: SECOND,
      fullTranscript: FIRST + SECOND
    });

    // Nothing new: nothing sent
    await elapse(30_000);
    expect(sent('process')).toHaveLength(2);
  });

  it('waits until at least 20 new characters have arrived', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.startSession();
    });

    act(() => result.current.updateTranscript('Okay.'));
    await elapse(20_000);
    expect(sent('process')).toHaveLength(0);

    act(() => result.current.updateTranscript('Okay. And the pain began two days ago.'));
    await elapse(10_000);
    expect(sent('process')).toHaveLength(1);
    expect(sent('process')[0].transcriptSegment).toBe('Okay. And the pain began two days ago.');
  });

  it('shows the alerts a pass returns through onAlert', async () => {
    const found = alert('alert-1', 'Warfarin and ibuprofen');
    processReply = async () => reply({ success: true, alerts: [found], alertCount: 1 });
    const onAlert = vi.fn();
    const { result } = setup({ onAlert });
    await act(async () => {
      await result.current.startSession();
    });

    act(() => result.current.updateTranscript(FIRST + SECOND));
    await elapse(10_000);

    expect(onAlert).toHaveBeenCalledTimes(1);
    expect(onAlert).toHaveBeenCalledWith(found);
    expect(result.current.alerts).toEqual([found]);
  });

  it('keeps a stretch whose pass failed, tries it again and reports the error once', async () => {
    let failures = 2;
    processReply = async () => (failures-- > 0 ? reply({ error: 'Internal server error' }, false) : reply({ success: true, alerts: [] }));
    const onError = vi.fn();
    const { result } = setup({ onError });
    await act(async () => {
      await result.current.startSession();
    });

    act(() => result.current.updateTranscript(FIRST));
    await elapse(10_000);
    await elapse(10_000);
    expect(result.current.error).toMatch(/Failed to process transcript/);
    await elapse(10_000);

    expect(sent('process').map(body => body.transcriptSegment)).toEqual([FIRST, FIRST, FIRST]);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  it('runs one pass at a time', async () => {
    let finish: (value: Reply) => void = () => {};
    processReply = () => new Promise(resolve => { finish = resolve; });
    const { result } = setup();
    await act(async () => {
      await result.current.startSession();
    });

    act(() => result.current.updateTranscript(FIRST));
    await elapse(10_000);
    act(() => result.current.updateTranscript(FIRST + SECOND));
    await elapse(20_000);
    expect(sent('process')).toHaveLength(1);

    await act(async () => {
      finish(reply({ success: true, alerts: [] }));
    });
    processReply = async () => reply({ success: true, alerts: [] });
    await elapse(10_000);
    expect(sent('process')[1].transcriptSegment).toBe(SECOND);
  });

  it('stops the passes when the session ends, and drops a pass still in flight', async () => {
    let finish: (value: Reply) => void = () => {};
    processReply = () => new Promise(resolve => { finish = resolve; });
    const onAlert = vi.fn();
    const { result } = setup({ onAlert });
    await act(async () => {
      await result.current.startSession();
    });

    act(() => result.current.updateTranscript(FIRST));
    await elapse(10_000);
    expect(sent('process')).toHaveLength(1);

    await act(async () => {
      await result.current.endSession();
    });
    expect(sent('end_session')).toHaveLength(1);
    expect(result.current.isSessionActive).toBe(false);

    await act(async () => {
      finish(reply({ success: true, alerts: [alert('late', 'Too late')] }));
    });
    act(() => result.current.updateTranscript(FIRST + SECOND));
    await elapse(60_000);

    expect(onAlert).not.toHaveBeenCalled();
    expect(sent('process')).toHaveLength(1);
  });

  it('ends the session from an endSession held since before the encounter existed', async () => {
    // ConsultationPanel keeps the endSession of its first render, when it had no encounter yet
    const { result, rerender } = renderHook(
      ({ encounterId }: { encounterId?: string }) =>
        useRealTimeAlerts({ enabled: true, patientId: 'patient-1', encounterId }),
      { initialProps: {} as { encounterId?: string } }
    );
    const firstEndSession = result.current.endSession;

    rerender({ encounterId: 'encounter-1' });
    await act(async () => {
      await result.current.startSession();
    });
    act(() => result.current.updateTranscript(FIRST));

    await act(async () => {
      await firstEndSession();
    });
    await elapse(60_000);

    expect(sent('end_session')).toEqual([{ patientId: 'patient-1', encounterId: 'encounter-1', action: 'end_session' }]);
    expect(sent('process')).toHaveLength(0);
  });

  it('starts the next session from the start of its transcript', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.startSession();
    });
    act(() => result.current.updateTranscript(FIRST));
    await elapse(10_000);
    await act(async () => {
      await result.current.endSession();
    });

    await act(async () => {
      await result.current.startSession();
    });
    act(() => result.current.updateTranscript(SECOND.trim()));
    await elapse(10_000);

    expect(sent('process')[1]).toMatchObject({
      transcriptSegment: SECOND.trim(),
      fullTranscript: SECOND.trim()
    });
  });

  it('runs a pass at once when forced, on whatever is new', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.startSession();
    });

    act(() => result.current.updateTranscript('Okay.'));
    await act(async () => {
      await result.current.forceProcess();
    });

    expect(sent('process')).toEqual([expect.objectContaining({ transcriptSegment: 'Okay.' })]);
  });
});

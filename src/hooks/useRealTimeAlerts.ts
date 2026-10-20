// Real-time Alert Hook
// React hook for managing real-time alert subscriptions during consultations.
//
// The passes are driven from here, not from a timer on the server: on
// serverless functions the server's memory does not last between requests. The
// hook keeps the transcript and how much of it has been sent, and every
// `intervalMs` (10 s), once at least `minNewChars` (20) new characters have
// arrived, it posts the new stretch with the whole transcript as action
// 'process'. The alerts that come back go to `onAlert`.

import { useState, useEffect, useCallback, useRef } from 'react';
import { UnifiedAlert } from '@/types/alerts';

const ENDPOINT = '/api/alerts/real-time';
const DEFAULT_INTERVAL_MS = 10_000;
const DEFAULT_MIN_NEW_CHARS = 20;

export interface UseRealTimeAlertsOptions {
  enabled: boolean;
  patientId?: string;
  encounterId?: string;
  onAlert?: (alert: UnifiedAlert) => void;
  onError?: (error: Error) => void;
  maxToasts?: number;
  intervalMs?: number; // How often to look for new transcript
  minNewChars?: number; // How much new transcript a pass waits for
}

export interface RealTimeAlertsState {
  alerts: UnifiedAlert[];
  isProcessing: boolean;
  isSessionActive: boolean;
  sessionStarted: boolean;
  error: string | null;
  stats: {
    activeSessions: number;
  } | null;
}

function post(body: Record<string, unknown>): Promise<Response> {
  return fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

export function useRealTimeAlerts(options: UseRealTimeAlertsOptions) {
  const {
    enabled = false,
    patientId,
    encounterId,
    onAlert,
    onError,
    maxToasts = 3,
    intervalMs = DEFAULT_INTERVAL_MS,
    minNewChars = DEFAULT_MIN_NEW_CHARS
  } = options;

  const [state, setState] = useState<RealTimeAlertsState>({
    alerts: [],
    isProcessing: false,
    isSessionActive: false,
    sessionStarted: false,
    error: null,
    stats: null
  });

  const sessionStartedRef = useRef(false);
  const alertsRef = useRef<UnifiedAlert[]>([]);

  // The transcript as last given, and how much of it a pass has sent
  const transcriptRef = useRef('');
  const sentLengthRef = useRef(0);
  const passInFlightRef = useRef(false);
  // Counts sessions, so a pass or a start still in flight when its session
  // ends is dropped rather than reported into the next one
  const sessionRef = useRef(0);
  // A failing pass is retried every interval; its error is reported once
  const failureReportedRef = useRef(false);
  // The ids the session started with, so that an endSession held from an
  // earlier render (before the encounter existed) still ends it
  const sessionIdsRef = useRef<{ patientId: string; encounterId: string } | null>(null);

  // Update refs when state changes
  useEffect(() => {
    alertsRef.current = state.alerts;
  }, [state.alerts]);

  // Start real-time session
  const startSession = useCallback(async () => {
    if (!patientId || !encounterId || sessionStartedRef.current) {
      console.log('[useRealTimeAlerts] Start session skipped:', {
        patientId: !!patientId,
        encounterId: !!encounterId,
        sessionAlreadyStarted: sessionStartedRef.current
      });
      return;
    }

    console.log('[useRealTimeAlerts] Starting real-time alert session:', { patientId, encounterId });
    const session = ++sessionRef.current;

    try {
      setState(prev => ({ ...prev, isProcessing: true, error: null }));

      const response = await post({ patientId, encounterId, action: 'start_session' });

      if (!response.ok) {
        throw new Error(`Failed to start session: ${response.statusText}`);
      }

      const result = await response.json();
      if (session !== sessionRef.current) {
        // Ended while it started
        setState(prev => ({ ...prev, isProcessing: false }));
        return;
      }

      sentLengthRef.current = 0;
      failureReportedRef.current = false;
      sessionIdsRef.current = { patientId, encounterId };
      sessionStartedRef.current = true;
      setState(prev => ({
        ...prev,
        isSessionActive: true,
        sessionStarted: true,
        isProcessing: false,
        stats: result.stats ?? null
      }));

      console.log('[useRealTimeAlerts] Real-time alert session started successfully:', result);

    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      console.error('[useRealTimeAlerts] Failed to start session:', err);
      setState(prev => ({ 
        ...prev, 
        error: err.message, 
        isProcessing: false 
      }));
      onError?.(err);
    }
  }, [patientId, encounterId, onError]);

  // End real-time session. The passes stop here and now, whatever the server
  // answers: it is the client that runs them.
  const endSession = useCallback(async () => {
    const ids = sessionStartedRef.current ? sessionIdsRef.current : null;
    sessionRef.current += 1;
    sessionStartedRef.current = false;
    sessionIdsRef.current = null;
    transcriptRef.current = '';
    sentLengthRef.current = 0;

    if (!ids) {
      return;
    }

    setState(prev => ({
      ...prev,
      isSessionActive: false,
      sessionStarted: false,
      isProcessing: false,
      alerts: [] // Clear alerts when session ends
    }));

    try {
      const response = await post({ ...ids, action: 'end_session' });

      if (!response.ok) {
        throw new Error(`Failed to end session: ${response.statusText}`);
      }

      const result = await response.json();
      setState(prev => ({ ...prev, stats: result.stats ?? null }));

      console.log('Real-time alert session ended');

    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      setState(prev => ({ ...prev, error: err.message }));
      onError?.(err);
    }
  }, [onError]);

  // Keep the latest transcript; the next pass sends what is new in it
  const updateTranscript = useCallback((transcript: string) => {
    transcriptRef.current = transcript;
  }, []);

  // One pass: send what has arrived since the last one, if there is enough of it
  const runPass = useCallback(async (minChars: number): Promise<UnifiedAlert[]> => {
    if (!patientId || !encounterId || passInFlightRef.current) {
      return [];
    }

    const fullTranscript = transcriptRef.current;
    if (fullTranscript.length < sentLengthRef.current) {
      sentLengthRef.current = fullTranscript.length; // Edited shorter: only text after this is new
    }
    const transcriptSegment = fullTranscript.slice(sentLengthRef.current);
    if (transcriptSegment.trim().length < minChars) {
      return [];
    }

    const session = sessionRef.current;
    passInFlightRef.current = true;

    try {
      const response = await post({
        patientId,
        encounterId,
        action: 'process',
        transcriptSegment,
        fullTranscript
      });

      if (!response.ok) {
        throw new Error(`Failed to process transcript: ${response.statusText}`);
      }

      const result = await response.json();
      if (session !== sessionRef.current) return []; // The session ended meanwhile

      sentLengthRef.current = fullTranscript.length;
      failureReportedRef.current = false;

      const newAlerts: UnifiedAlert[] = Array.isArray(result.alerts) ? result.alerts : [];
      setState(prev => {
        if (newAlerts.length === 0 && prev.error === null) return prev;
        return {
          ...prev,
          error: null,
          alerts: [...prev.alerts, ...newAlerts].slice(-maxToasts)
        };
      });
      newAlerts.forEach(alert => onAlert?.(alert));

      return newAlerts;

    } catch (error) {
      if (session !== sessionRef.current) return [];

      // The stretch stays unsent, so the next pass tries it again
      const err = error instanceof Error ? error : new Error('Unknown error');
      console.error('[useRealTimeAlerts] Alert pass failed:', err);
      setState(prev => ({ ...prev, error: err.message }));
      if (!failureReportedRef.current) {
        failureReportedRef.current = true;
        onError?.(err);
      }
      return [];

    } finally {
      passInFlightRef.current = false;
    }
  }, [patientId, encounterId, onAlert, onError, maxToasts]);

  // The interval calls the latest pass, so it is not restarted when the
  // caller's callbacks change from one render to the next
  const runPassRef = useRef(runPass);
  useEffect(() => {
    runPassRef.current = runPass;
  }, [runPass]);

  useEffect(() => {
    if (!state.sessionStarted) return;
    const id = setInterval(() => {
      void runPassRef.current(minNewChars);
    }, intervalMs);
    return () => clearInterval(id);
  }, [state.sessionStarted, intervalMs, minNewChars]);

  // Run a pass now, on whatever is new, without waiting for the interval
  const forceProcess = useCallback(async () => {
    setState(prev => ({ ...prev, isProcessing: true }));
    try {
      return await runPass(1);
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [runPass]);

  // Get session status. It reads the server's memory, which on serverless
  // functions may not hold the session, so it does not override this hook's
  // own view of whether a session is on.
  const getStatus = useCallback(async () => {
    if (!patientId || !encounterId) {
      return null;
    }

    try {
      const response = await fetch(
        `${ENDPOINT}?patientId=${patientId}&encounterId=${encounterId}&action=status`
      );

      if (!response.ok) {
        throw new Error(`Failed to get status: ${response.statusText}`);
      }

      const result = await response.json();
      
      setState(prev => ({
        ...prev,
        stats: result.processingStats ?? null
      }));

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      setState(prev => ({ ...prev, error: err.message }));
      onError?.(err);
      return null;
    }
  }, [patientId, encounterId, onError]);

  // Remove alert from display
  const removeAlert = useCallback((alertId: string) => {
    setState(prev => ({
      ...prev,
      alerts: prev.alerts.filter(alert => alert.id !== alertId)
    }));
  }, []);

  // Clear all alerts
  const clearAlerts = useCallback(() => {
    setState(prev => ({ ...prev, alerts: [] }));
  }, []);

  // Note: Manual session management is preferred over auto-start/stop
  // to avoid infinite loop issues with dependencies. Sessions should be
  // explicitly started/stopped by the consuming component.

  return {
    ...state,
    startSession,
    endSession,
    updateTranscript,
    forceProcess,
    getStatus,
    removeAlert,
    clearAlerts
  };
}

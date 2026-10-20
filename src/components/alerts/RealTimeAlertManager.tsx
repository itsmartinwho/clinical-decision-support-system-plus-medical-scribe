'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { UnifiedAlert, AlertSeverity, AlertType, AlertStatus } from '@/types/alerts';
import { useRealTimeAlerts } from '@/hooks/useRealTimeAlerts';
import AlertToast from './AlertToast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, TestTube } from '@phosphor-icons/react';

interface RealTimeAlertManagerProps {
  isActive: boolean;
  patientId?: string;
  consultationId?: string;
  transcript?: string; // The consultation's transcript so far; each pass sends what is new in it
  onAlert?: (alert: UnifiedAlert) => void;
  maxToasts?: number;
}

// Runs the consultation's live alerts through useRealTimeAlerts: while it is
// active, the hook sends what is new in the transcript to the server every 10 s
// and the alerts that come back are shown as toasts.
export const RealTimeAlertManager: React.FC<RealTimeAlertManagerProps> = ({
  isActive,
  patientId,
  consultationId,
  transcript = '',
  onAlert,
  maxToasts = 3
}) => {
  const [alerts, setAlerts] = useState<UnifiedAlert[]>([]);

  const showAlert = useCallback((alert: UnifiedAlert) => {
    setAlerts(prev => {
      const filtered = prev.slice(-(maxToasts - 1)); // Keep space for new alert
      return [...filtered, alert];
    });
    onAlert?.(alert);
  }, [onAlert, maxToasts]);

  const realTimeAlerts = useRealTimeAlerts({
    enabled: isActive,
    patientId,
    encounterId: consultationId,
    onAlert: showAlert,
    maxToasts
  });
  const { startSession, endSession, updateTranscript, forceProcess } = realTimeAlerts;

  const removeAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);

  // The session runs while the consultation does
  useEffect(() => {
    if (!isActive || !patientId || !consultationId) return;
    void startSession();
    return () => {
      void endSession();
    };
  }, [isActive, patientId, consultationId, startSession, endSession]);

  // Give the hook the transcript, again whenever a session starts (ending one clears it)
  useEffect(() => {
    if (isActive) updateTranscript(transcript);
  }, [isActive, patientId, consultationId, transcript, updateTranscript]);

  const simulateAlert = useCallback(() => {
    // Only for development/testing
    if (!consultationId) return;
    
    const mockAlert: UnifiedAlert = {
      id: `test-${Date.now()}`,
      encounterId: consultationId,
      patientId: patientId || 'test-patient',
      alertType: AlertType.DRUG_INTERACTION,
      severity: AlertSeverity.WARNING,
      status: AlertStatus.ACTIVE,
      title: 'Test Real-time Alert',
      message: 'This is a simulated alert for testing purposes.',
      suggestion: 'This is only for development testing.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isRealTime: true,
      isPostConsultation: false,
      acknowledged: false,
      migratedFromPatientAlerts: false
    };

    showAlert(mockAlert);
  }, [consultationId, patientId, showAlert]);

  // Clear alerts when inactive
  useEffect(() => {
    if (!isActive) {
      setAlerts([]);
    }
  }, [isActive]);

  return (
    <div className="space-y-4">
      {/* Development Controls */}
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Real-time Processing Controls (Development)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => void forceProcess()}
              disabled={!realTimeAlerts.isSessionActive || realTimeAlerts.isProcessing}
            >
              <Play className="h-3 w-3 mr-1" />
              Process Now
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={simulateAlert}
              disabled={!consultationId}
            >
              <TestTube className="h-3 w-3 mr-1" />
              Simulate Alert
            </Button>
          </div>

          <div className="text-xs text-gray-500 space-y-1">
            <div>Status: {isActive ? 'Active' : 'Inactive'}</div>
            <div>Session: {realTimeAlerts.isSessionActive ? 'Running, checking every 10 s' : 'Not started'}</div>
            <div>Consultation: {consultationId || 'None'}</div>
            <div>Transcript: {transcript.length} characters</div>
            <div>Active Toasts: {alerts.length}</div>
            {realTimeAlerts.error && (
              <div className="text-red-500">Error: {realTimeAlerts.error}</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
        {alerts.map((alert, index) => (
          <div
            key={alert.id}
            style={{
              transform: `translateY(${index * 8}px)`,
              zIndex: 1000 - index
            }}
          >
            <AlertToast
              alert={alert}
              duration={8000}
              onExpire={() => removeAlert(alert.id)}
              onClose={() => removeAlert(alert.id)}
              onHover={() => console.log('Toast hovered:', alert.id)}
              onLeave={() => console.log('Toast left:', alert.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default RealTimeAlertManager;

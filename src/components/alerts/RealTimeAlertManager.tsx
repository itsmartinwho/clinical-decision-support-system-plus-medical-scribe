'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { UnifiedAlert, AlertSeverity, AlertType, AlertStatus } from '@/types/alerts';
import { AlertEngine } from '@/lib/alerts/alert-engine';
import AlertToast from './AlertToast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Pause, Square, TestTube } from '@phosphor-icons/react';

interface RealTimeAlertManagerProps {
  isActive: boolean;
  consultationId?: string;
  onAlert?: (alert: UnifiedAlert) => void;
  maxToasts?: number;
}

export const RealTimeAlertManager: React.FC<RealTimeAlertManagerProps> = ({
  isActive,
  consultationId,
  onAlert,
  maxToasts = 3
}) => {
  const [alerts, setAlerts] = useState<UnifiedAlert[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingId, setProcessingId] = useState<NodeJS.Timeout | null>(null);
  const [alertEngine] = useState(() => new AlertEngine());
  const [processingError, setProcessingError] = useState<string | null>(null);

  const removeAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);

  const processRealTimeAlert = useCallback(async () => {
    if (!isActive || !consultationId) return;

    try {
      setIsProcessing(true);
      setProcessingError(null);
      
      // Mock transcript for now - in real implementation this would come from the consultation
      const mockTranscript = "Patient reports chest pain and shortness of breath. No previous cardiac history.";
      
      const newAlerts = await alertEngine.processRealTimeAlerts(consultationId, mockTranscript, 'test-patient');
      
      if (newAlerts.length > 0) {
        newAlerts.forEach(alert => {
          // Add to display queue
          setAlerts(prev => {
            const filtered = prev.slice(-(maxToasts - 1)); // Keep space for new alert
            return [...filtered, alert];
          });
          
          // Notify parent
          onAlert?.(alert);
        });
      }
    } catch (error) {
      console.error('Error processing real-time alerts:', error);
      setProcessingError(error instanceof Error ? error.message : 'Unknown error');
      // Do not create fallback mock alerts - just log the error
    } finally {
      setIsProcessing(false);
    }
  }, [isActive, consultationId, alertEngine, onAlert, maxToasts]);

  const startProcessing = useCallback(() => {
    if (!isActive || !consultationId || processingId) return;
    
    // Process immediately
    processRealTimeAlert();
    
    // Then process every minute (60000ms)
    const id = setInterval(processRealTimeAlert, 60000);
    setProcessingId(id);
  }, [isActive, consultationId, processRealTimeAlert, processingId]);

  const stopProcessing = useCallback(() => {
    if (processingId) {
      clearInterval(processingId);
      setProcessingId(null);
    }
    setIsProcessing(false);
  }, [processingId]);

  const simulateAlert = useCallback(() => {
    // Only for development/testing
    if (!consultationId) return;
    
    const mockAlert: UnifiedAlert = {
      id: `test-${Date.now()}`,
      encounterId: consultationId,
      patientId: 'test-patient',
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

    setAlerts(prev => {
      const filtered = prev.slice(-(maxToasts - 1));
      return [...filtered, mockAlert];
    });

    onAlert?.(mockAlert);
  }, [consultationId, onAlert, maxToasts]);

  // Auto-start when active and consultation ID is provided
  useEffect(() => {
    if (isActive && consultationId && !processingId) {
      startProcessing();
    } else if ((!isActive || !consultationId) && processingId) {
      stopProcessing();
    }

    return () => {
      if (processingId) {
        clearInterval(processingId);
      }
    };
  }, [isActive, consultationId, startProcessing, stopProcessing, processingId]);

  // Clear alerts when inactive
  useEffect(() => {
    if (!isActive) {
      setAlerts([]);
      setProcessingError(null);
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
              variant={processingId ? "destructive" : "default"}
              onClick={processingId ? stopProcessing : startProcessing}
              disabled={!consultationId || (!isActive && !processingId)}
            >
              {processingId ? (
                <>
                  <Square className="h-3 w-3 mr-1" />
                  Stop Processing
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 mr-1" />
                  Start Processing
                </>
              )}
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

          <div className="text-xs text-muted-foreground space-y-1">
            <div>Status: {isActive ? 'Active' : 'Inactive'}</div>
            <div>Processing: {isProcessing ? 'Running' : 'Stopped'}</div>
            <div>Consultation: {consultationId || 'None'}</div>
            <div>Active Toasts: {alerts.length}</div>
            {processingError && (
              <div className="text-critical">Error: {processingError}</div>
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
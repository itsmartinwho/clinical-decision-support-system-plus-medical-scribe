'use client';
import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabaseDataService } from "@/lib/supabaseDataService";
import type { Patient, ComplexCaseAlert, Encounter } from "@/lib/types";
import ContentSurface from '@/components/layout/ContentSurface';

// Import shared UI components
import LikelihoodBadge from "@/components/ui/LikelihoodBadge";
import SeverityBadge from "@/components/ui/SeverityBadge";
import LoadingAnimation from "@/components/LoadingAnimation";

interface AlertsScreenViewProps {
  onAlertClick: (patientId: string) => void;
  allAlerts: Array<ComplexCaseAlert & { patientName?: string }>;
}

export default function AlertsScreenView({ onAlertClick, allAlerts: rawAlerts }: AlertsScreenViewProps) {
  const [enrichedAlerts, setEnrichedAlerts] = useState<Array<ComplexCaseAlert & { patientName?: string; lastConsultation?: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'date' | 'likelihood'>('likelihood');

  useEffect(() => {
    const enrichAlertData = async () => {
      setIsLoading(true);
      try {
        await supabaseDataService.loadPatientData();
      } catch {
        // Show the alerts without their last-consultation dates.
      }

      const alertsToEnrich = rawAlerts || [];
      const processedAlerts: Array<ComplexCaseAlert & { patientName?: string; lastConsultation?: string }> = [];

      for (const alert of alertsToEnrich) {
        let lastConsultDate: string | undefined;
        const patientEncounters: Encounter[] = supabaseDataService.getPatientEncounters(alert.patientId);
        
        if (patientEncounters && patientEncounters.length > 0) {
          const sortedEncounters = [...patientEncounters].sort((a, b) => {
            const dateA = a.actualEnd || a.actualStart || a.scheduledStart;
            const dateB = b.actualEnd || b.actualStart || b.scheduledStart;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
          });
          const mostRecentEncounter = sortedEncounters[0];
          if (mostRecentEncounter) {
            const encounterDate = mostRecentEncounter.actualEnd || mostRecentEncounter.actualStart || mostRecentEncounter.scheduledStart;
            if (encounterDate) {
              lastConsultDate = new Date(encounterDate).toLocaleDateString();
            }
          }
        }
        processedAlerts.push({
          ...alert,
          lastConsultation: lastConsultDate
        });
      }
      setEnrichedAlerts(processedAlerts);
      setIsLoading(false);
    };

    enrichAlertData();
  }, [rawAlerts]);

  const sortedAlertsToDisplay = [...enrichedAlerts].sort((a, b) => {
    if (sortBy === 'date') {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    } else {
      const likelihoodA = a.likelihood !== undefined ? a.likelihood : 0;
      const likelihoodB = b.likelihood !== undefined ? b.likelihood : 0;
      return likelihoodB - likelihoodA;
    }
  });

  const highPriorityAlertsCount = (rawAlerts || []).filter(
    alert => alert.likelihood !== undefined && alert.likelihood >= 4
  ).length;

  if (isLoading && rawAlerts.length > 0) {
    return <LoadingAnimation />;
  }
  if (rawAlerts.length === 0 && !isLoading) {
    return (
      <ContentSurface fullBleed className="p-6 flex flex-col">
        <div className="flex flex-row items-center justify-between mb-6">
          <h1 className="text-step-1 font-semibold">Patient Alerts</h1>
        </div>
        <p className="text-muted-foreground">No active alerts for any patient.</p>
      </ContentSurface>
    );
  }

  return (
    <ContentSurface fullBleed className="p-6 flex flex-col">
      <div className="flex flex-row items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-step-1 font-semibold">Patient Alerts</h1>
          {highPriorityAlertsCount > 0 && (
            <div className="bg-critical text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {highPriorityAlertsCount}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <Button
            variant={sortBy === 'likelihood' ? "secondary" : "outline"}
            size="sm"
            onClick={() => setSortBy('likelihood')}
            className="text-step--1"
          >
            Priority
          </Button>
          <Button
            variant={sortBy === 'date' ? "secondary" : "outline"}
            size="sm"
            onClick={() => setSortBy('date')}
            className="text-step--1"
          >
            Date
          </Button>
        </div>
      </div>
      <div className="space-y-4 text-sm flex-1 overflow-y-auto">
        {sortedAlertsToDisplay.length === 0 && !isLoading && <p className="text-muted-foreground">No active alerts match filters or none exist.</p>} 
        {sortedAlertsToDisplay.map((alert) => (
          <div
            key={alert.id}
            className="flex items-center space-x-3 p-3 border rounded-md shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-background/50 hover:bg-foreground/5"
            onClick={() => onAlertClick(alert.patientId)}
          >
            <LikelihoodBadge likelihood={alert.likelihood} />
            <div className="flex-grow">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">{alert.patientName}</p>
                {alert.conditionType && (
                  <span className="text-xs px-2 py-0.5 bg-info-soft text-info rounded-full">
                    {alert.conditionType}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate" title={alert.msg}>{alert.msg || ""}</p>
              {alert.lastConsultation && (
                <p className="text-xs text-muted-foreground/80">
                  Last consultation: {alert.lastConsultation}
                </p>
              )}
            </div>
            <div className="text-xs text-muted-foreground/80 text-right">
              {alert.date && <div>{alert.date}</div>}
              {alert.severity && (
                <div className="mt-1">
                  <SeverityBadge severity={alert.severity} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </ContentSurface>
  );
} 
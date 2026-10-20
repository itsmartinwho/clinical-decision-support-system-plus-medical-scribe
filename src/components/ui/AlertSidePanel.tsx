'use client';
import React from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from '@phosphor-icons/react';
import LikelihoodBadge from "@/components/ui/LikelihoodBadge";
import type { ComplexCaseAlert } from "@/lib/types";

interface AlertSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: Array<ComplexCaseAlert & { patientName?: string }>;
  onAlertClick: (patientId: string) => void;
}

export default function AlertSidePanel({ isOpen, onClose, alerts, onAlertClick }: AlertSidePanelProps) {
  const highPriorityAlerts = alerts.filter(alert => alert.likelihood !== undefined && alert.likelihood >= 4);
  
  return (
    <div 
      className={`fixed top-0 right-0 h-full bg-card w-80 shadow-lg z-50 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">High Priority Alerts</h3>
        <Button size="icon" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="p-4 overflow-auto max-h-[calc(100vh-64px)]">
        {highPriorityAlerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No high-priority alerts at this time.</p>
        ) : (
          <div className="space-y-3">
            {highPriorityAlerts.map((alert) => (
              <div 
                key={alert.id} 
                className="flex items-center space-x-3 p-3 border rounded-md shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  onAlertClick(alert.patientId);
                  onClose();
                }}
              >
                <LikelihoodBadge likelihood={alert.likelihood} />
                <div className="flex-grow">
                  <p className="text-sm font-medium text-ink truncate">
                    {alert.patientName}
                  </p>
                  {alert.conditionType && (
                    <p className="text-xs text-ink-2 truncate">
                      {alert.conditionType}
                    </p>
                  )}
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {alert.date || ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 
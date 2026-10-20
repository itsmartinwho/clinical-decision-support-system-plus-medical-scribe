'use client';
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from '@phosphor-icons/react';
import AllDataViewTab from '@/components/patient-workspace-tabs/AllDataViewTab';
import { supabaseDataService } from '@/lib/supabaseDataService';
import { ErrorState, LoadingState } from '@/components/ui/states';
import type { Patient, EncounterDetailsWrapper } from '@/lib/types';

interface PatientDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
}

export default function PatientDataModal({ isOpen, onClose, patient }: PatientDataModalProps) {
  const [detailedPatientData, setDetailedPatientData] = useState<{ patient: Patient; encounters: EncounterDetailsWrapper[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isOpen && patient) {
      loadPatientData();
    }
  }, [isOpen, patient]);

  const loadPatientData = async () => {
    if (!patient) return;
    
    setIsLoading(true);
    setFailed(false);
    try {
      const detailedData = await supabaseDataService.getPatientData(patient.id);
      setDetailedPatientData(detailedData);
      setFailed(!detailedData);
    } catch (error) {
      console.error('Failed to load patient data:', error);
      setFailed(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="h-[calc(100svh-2rem)] max-w-[min(72rem,calc(100vw-1.5rem))] grid-rows-[auto_1fr]">
        <DialogHeader className="flex flex-row items-end justify-between space-y-0 border-b border-border pb-4 pr-8">
          <DialogTitle>
            Prepare for Consultation: {patient?.name || `${patient?.firstName} ${patient?.lastName}`.trim()}
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 hover:bg-muted transition-all"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <div className="min-h-0 overflow-y-auto">
          {isLoading ? (
            <LoadingState />
          ) : failed || !detailedPatientData ? (
            <ErrorState onRetry={loadPatientData} />
          ) : detailedPatientData ? (
            <AllDataViewTab 
              detailedPatientData={detailedPatientData}
              setDetailedPatientData={setDetailedPatientData}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Failed to load patient data</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 
'use client';
import React, { useState } from 'react';
import type { Patient, Encounter, Diagnosis, LabResult, EncounterDetailsWrapper } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ArrowCounterClockwise, Trash } from '@phosphor-icons/react';
import RenderDetailTable from "@/components/ui/RenderDetailTable";
import TranscriptView from "@/components/transcript/TranscriptView";
import { formatDate, formatTime } from "@/lib/format";
import { CaretRight } from '@phosphor-icons/react';
import { supabaseDataService } from "@/lib/supabaseDataService"; // For restore/delete
import { toast } from "@/hooks/use-toast";

interface AllDataViewTabProps {
  detailedPatientData: { patient: Patient; encounters: EncounterDetailsWrapper[] } | null;
  setDetailedPatientData: React.Dispatch<React.SetStateAction<{ patient: Patient; encounters: EncounterDetailsWrapper[] } | null>>;
}

export default function AllDataViewTab({ detailedPatientData, setDetailedPatientData }: AllDataViewTabProps) {
  const [restoringIds, setRestoringIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  if (!detailedPatientData || !detailedPatientData.patient) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-center text-muted-foreground">No data loaded or patient missing.</p>
      </div>
    );
  }

  const { patient, encounters } = detailedPatientData;

  const deletedEncounters = (encounters || []).filter(ew => ew.encounter.isDeleted);

  const handleRestore = async (encounterToRestore: Encounter) => {
    if (!patient) return;
    
    setRestoringIds(prev => new Set([...prev, encounterToRestore.id]));
    
    try {
      const success = await supabaseDataService.restoreEncounter(patient.id, encounterToRestore.id);
      
      if (success) {
        setDetailedPatientData((prevData) => {
          if (!prevData) return prevData;
          const newEncounters = prevData.encounters.map(ew => {
            if (ew.encounter.id === encounterToRestore.id) {
              return {
                ...ew,
                encounter: {
                  ...ew.encounter,
                  isDeleted: false,
                  deletedAt: undefined,
                },
              };
            }
            return ew;
          });
          return { ...prevData, encounters: newEncounters };
        });
        
        toast({ title: "Success", description: "Encounter restored successfully." });
      } else {
        toast({ title: "Error", description: "Failed to restore encounter. Please try again.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to restore encounter", error);
      toast({ title: "Error", description: `Failed to restore encounter: ${error instanceof Error ? error.message : "Unknown error"}`, variant: "destructive" });
    } finally {
      setRestoringIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(encounterToRestore.id);
        return newSet;
      });
    }
  };

  const handlePermanentDelete = async (encounterToDelete: Encounter) => {
    if (!patient) return;
    
    setDeletingIds(prev => new Set([...prev, encounterToDelete.id]));
    
    try {
      const success = await supabaseDataService.permanentlyDeleteEncounter(patient.id, encounterToDelete.id);
      
      if (success) {
        setDetailedPatientData((prevData) => {
          if (!prevData) return prevData;
          const newEncounters = prevData.encounters.filter(ew => ew.encounter.id !== encounterToDelete.id);
          return { ...prevData, encounters: newEncounters };
        });
        
        toast({ title: "Success", description: "Encounter permanently deleted." });
      } else {
        toast({ title: "Error", description: "Failed to permanently delete encounter. Please try again.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to permanently delete encounter", error);
      toast({ title: "Error", description: `Failed to permanently delete encounter: ${error instanceof Error ? error.message : "Unknown error"}`, variant: "destructive" });
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(encounterToDelete.id);
        return newSet;
      });
    }
  };

  const demographics = Object.entries(patient).filter(
    ([key, value]) => (typeof value !== 'object' || value === null) && value !== undefined && value !== '' && key !== 'photo',
  );
  const active = encounters
    .filter(ew => !ew.encounter.isDeleted)
    .sort((a, b) => new Date(b.encounter.scheduledStart).getTime() - new Date(a.encounter.scheduledStart).getTime());
  const MONO_KEYS = new Set(['id', 'dateOfBirth', 'nextAppointment', 'povertyPercentage']);

  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius-lg)] border border-hairline bg-card p-5 shadow-card sm:p-6">
        <h2 className="font-display text-xl text-ink">Patient Demographics</h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {demographics.map(([key, value]) => (
            <div key={key} className="min-w-0">
              <dt className="text-xs capitalize text-muted-foreground">{key.replace(/([A-Z])/g, ' $1')}</dt>
              <dd className={MONO_KEYS.has(key) ? 'data-mono mt-0.5 break-all text-sm text-ink' : 'mt-0.5 text-[0.9375rem] text-ink'}>
                {key === 'dateOfBirth' ? formatDate(String(value)) : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2.5 font-display text-xl text-ink">
          Encounters History
          <span className="data-mono inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-card px-2 text-xs font-medium text-muted-foreground ring-1 ring-hairline">{active.length}</span>
        </h2>
        <div className="rise-in-stagger space-y-4">
        {active.map((encounterWrapper: EncounterDetailsWrapper, index: number) => {
          const { encounter, diagnoses, labResults } = encounterWrapper;
          const treatments = (encounter.treatments || []) as any[];
          const terms = [
            ...(diagnoses || []).map((d) => d.description || ''),
            ...treatments.map((t) => t?.drug || ''),
            ...(labResults || []).map((l) => l.name || ''),
          ];
          return (
            <article key={encounter.id || index} className="rounded-[var(--radius-lg)] border border-hairline bg-card p-5 shadow-card sm:p-6">
              <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                <div className="min-w-0">
                  <h3 className="font-display text-[1.3rem] leading-snug text-ink">Encounter on {formatDate(encounter.scheduledStart)}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {encounter.reasonDisplayText || encounter.reasonCode || 'N/A'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {encounter.reasonCode ? <span className="data-mono rounded-md bg-iris-soft px-2 py-0.5 text-xs text-iris ring-1 ring-iris-line">{encounter.reasonCode}</span> : null}
                  <span className="data-mono rounded-md bg-well px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-hairline">{encounter.encounterIdentifier}</span>
                </div>
              </header>

              <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:max-w-md">
                <div>
                  <dt className="text-xs text-muted-foreground">Actual Start</dt>
                  <dd className="data-mono mt-0.5 text-ink">{encounter.actualStart ? `${formatDate(encounter.actualStart)} ${formatTime(encounter.actualStart)}` : 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Actual End</dt>
                  <dd className="data-mono mt-0.5 text-ink">{encounter.actualEnd ? `${formatDate(encounter.actualEnd)} ${formatTime(encounter.actualEnd)}` : 'N/A'}</dd>
                </div>
              </dl>

              {encounter.transcript ? (
                <details className="group mt-5 rounded-xl border border-hairline">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
                    <CaretRight size={13} weight="bold" className="text-muted-foreground transition-transform group-open:rotate-90" aria-hidden /> Transcript
                  </summary>
                  <TranscriptView className="max-h-[28rem] border-t border-hairline px-4 py-4" transcript={encounter.transcript} terms={terms} />
                </details>
              ) : null}

              {encounter.soapNote ? (
                <details className="group mt-3 rounded-xl border border-hairline">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
                    <CaretRight size={13} weight="bold" className="text-muted-foreground transition-transform group-open:rotate-90" aria-hidden /> SOAP Note
                  </summary>
                  <p className="max-w-[75ch] whitespace-pre-line border-t border-hairline px-4 py-4 text-[0.9375rem] leading-relaxed text-ink">{encounter.soapNote}</p>
                </details>
              ) : null}

              <RenderDetailTable title="Diagnoses" dataArray={diagnoses || []} headers={['Code', 'Description']} columnAccessors={['code', 'description']} />
              <RenderDetailTable title="Lab Results" dataArray={labResults || []} headers={['Test Name', 'Value', 'Units', 'Date/Time', 'Ref. Range', 'Flag']} columnAccessors={['name', 'value', 'units', 'dateTime', 'referenceRange', 'flag']} />
              <RenderDetailTable title="Treatments" dataArray={treatments} headers={['Drug', 'Status', 'Rationale']} columnAccessors={['drug', 'status', 'rationale']} />
            </article>
          );
        })}
        </div>
        {active.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No active encounter history for this patient</p>
        )}
      </section>

      {/* Deleted Items Section */}
      {deletedEncounters.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl text-critical">Deleted Items</h2>
          {deletedEncounters.map((encounterWrapper: EncounterDetailsWrapper, index: number) => {
            const { encounter } = encounterWrapper;
            return (
              <div key={encounter.id || index} className="rounded-md border border-critical-line bg-critical-soft/50 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-foreground">
                      Encounter • {new Date(encounter.scheduledStart).toLocaleDateString()}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Deleted at {encounter.deletedAt ? new Date(encounter.deletedAt).toLocaleString() : '—'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleRestore(encounter)}
                      disabled={restoringIds.has(encounter.id) || deletingIds.has(encounter.id)}
                    >
                      <ArrowCounterClockwise className="mr-2 h-4 w-4"/>
                      {restoringIds.has(encounter.id) ? "Restoring..." : "Restore"}
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => handlePermanentDelete(encounter)}
                      disabled={restoringIds.has(encounter.id) || deletingIds.has(encounter.id)}
                    >
                      <Trash className="mr-2 h-4 w-4"/>
                      {deletingIds.has(encounter.id) ? "Deleting..." : "Delete permanently"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
} 
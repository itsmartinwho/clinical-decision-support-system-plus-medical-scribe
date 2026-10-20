'use client';
import React, { useState } from 'react';
import type { Patient, Encounter, Diagnosis, LabResult, EncounterDetailsWrapper } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ArrowCounterClockwise, Trash } from '@phosphor-icons/react';
import RenderDetailTable from "@/components/ui/RenderDetailTable";
import TranscriptView from "@/components/transcript/TranscriptView";
import { formatDate, formatTime, sexLabel } from "@/lib/format";
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

  const facts: Array<[string, string]> = [
    ['Name', patient.name || `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim()],
    ['Born', formatDate(patient.dateOfBirth)],
    ['Sex', sexLabel(patient.gender)],
    ['Race', patient.race || '—'],
    ['Ethnicity', patient.ethnicity || '—'],
    ['Marital status', patient.maritalStatus || '—'],
    ['Language', patient.language || '—'],
    ['Below poverty line', patient.povertyPercentage !== undefined ? `${patient.povertyPercentage}% of area` : '—'],
    ['Patient ID', patient.id],
  ];
  const active = encounters
    .filter(ew => !ew.encounter.isDeleted)
    .sort((a, b) => new Date(b.encounter.scheduledStart).getTime() - new Date(a.encounter.scheduledStart).getTime());

  return (
    <div className="space-y-10">
      <section>
        <h2 className="label-caps border-b border-ink/70 pb-2 !text-ink">Demographics</h2>
        <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4 border-b border-border py-2 text-sm">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className={label === 'Patient ID' || label === 'Born' ? 'data-mono min-w-0 break-all text-right text-[0.8125rem] text-ink' : 'text-right text-ink'}>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-8">
        <h2 className="label-caps flex items-center gap-2 border-b border-ink/70 pb-2 !text-ink">
          Encounters
          <span className="data-mono rounded border border-border px-1.5 text-[0.6875rem] font-medium tracking-normal text-muted-foreground">{active.length}</span>
        </h2>
        {active.map((encounterWrapper: EncounterDetailsWrapper, index: number) => {
          const { encounter, diagnoses, labResults } = encounterWrapper;
          const treatments = (encounter.treatments || []) as any[];
          const seedShape = treatments.some((t) => t && 'treatment_name' in t);
          const terms = [
            ...(diagnoses || []).map((d) => d.description || ''),
            ...treatments.map((t) => t?.treatment_name || t?.drug || ''),
            ...(labResults || []).map((l) => l.name || ''),
          ];
          return (
            <article key={encounter.id || index} className="rounded-[var(--radius-lg)] border border-border bg-card p-4 sm:p-6">
              <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <div className="min-w-0">
                  <p className="data-mono text-xs text-muted-foreground">{formatDate(encounter.actualStart || encounter.scheduledStart)} · {formatTime(encounter.actualStart || encounter.scheduledStart)}–{formatTime(encounter.actualEnd || encounter.scheduledEnd)}</p>
                  <h3 className="mt-1 font-display text-xl leading-snug text-ink">{encounter.reasonDisplayText || encounter.reasonCode || 'Consultation'}</h3>
                </div>
                <p className="data-mono text-xs text-muted-foreground">{encounter.reasonCode ? `${encounter.reasonCode} · ` : ''}{encounter.encounterIdentifier}</p>
              </header>

              {encounter.transcript ? (
                <details className="group mt-5 border-t border-border pt-3">
                  <summary className="label-caps cursor-pointer list-none !text-ink [&::-webkit-details-marker]:hidden">
                    <span className="mr-1 inline-block transition-transform group-open:rotate-90">›</span> Transcript
                  </summary>
                  <TranscriptView className="mt-3 max-h-[28rem]" transcript={encounter.transcript} terms={terms} />
                </details>
              ) : null}

              {encounter.soapNote ? (
                <details className="group mt-3 border-t border-border pt-3">
                  <summary className="label-caps cursor-pointer list-none !text-ink [&::-webkit-details-marker]:hidden">
                    <span className="mr-1 inline-block transition-transform group-open:rotate-90">›</span> SOAP note
                  </summary>
                  <p className="mt-3 max-w-[75ch] whitespace-pre-line text-[0.9375rem] leading-relaxed text-ink">{encounter.soapNote}</p>
                </details>
              ) : null}

              <RenderDetailTable title="Diagnoses" dataArray={diagnoses || []} headers={['Code', 'Description']} columnAccessors={['code', 'description']} />
              <RenderDetailTable title="Lab results" dataArray={labResults || []} headers={['Test', 'Value', 'Units', 'Taken', 'Range', 'Flag']} columnAccessors={['name', 'value', 'units', 'dateTime', 'referenceRange', 'flag']} />
              {seedShape ? (
                <RenderDetailTable title="Treatments" dataArray={treatments} headers={['Treatment', 'Dose', 'Instructions', 'Kind']} columnAccessors={['treatment_name', 'dosage', 'instructions', 'treatment_type']} />
              ) : (
                <RenderDetailTable title="Treatments" dataArray={treatments} headers={['Drug', 'Status', 'Rationale']} columnAccessors={['drug', 'status', 'rationale']} />
              )}
            </article>
          );
        })}
        {active.length === 0 && (
          <p className="text-sm text-muted-foreground">No encounters on this chart.</p>
        )}
      </section>

      {/* Deleted Items Section */}
      {deletedEncounters.length > 0 && (
        <div className="space-y-4">
          <h2 className="label-caps border-b border-critical/60 pb-2 !text-critical">Deleted</h2>
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
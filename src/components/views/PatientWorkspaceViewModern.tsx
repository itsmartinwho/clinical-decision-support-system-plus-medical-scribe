'use client';
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { CaretLeft, Plus, ClipboardText, PaperPlaneTilt, WarningCircle } from '@phosphor-icons/react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabaseDataService } from "@/lib/supabaseDataService";
import type { Patient, Encounter, EncounterDetailsWrapper } from "@/lib/types";
import { useSearchParams, useRouter } from 'next/navigation';
import { cn } from "@/lib/utils";
import ConsolidatedConsultationTab from "@/components/patient-workspace-tabs/ConsolidatedConsultationTab";
import AllDataViewTab from "@/components/patient-workspace-tabs/AllDataViewTab";
import ErrorDisplay from "@/components/ui/ErrorDisplay";
import { ErrorState, LoadingState } from "@/components/ui/states";
import PatientAvatar from "@/components/ui/PatientAvatar";
import { ageFrom, formatDate, patientName, severityTone, sexLabel } from "@/lib/format";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertDialogCancel } from "@/components/ui/alert-dialog";
import { AlertDialogAction } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buttonVariants } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import ContentSurface from "@/components/layout/ContentSurface";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ConsultationPanel from '@/components/modals/ConsultationPanel';
import { useDemo } from '@/contexts/DemoContext';
import { useDemoWorkspace } from '@/hooks/demo/useDemoWorkspace';
import { useDemoConsultation } from '@/hooks/demo/useDemoConsultation';
import { DemoDataService } from "@/services/demo/DemoDataService";
import { DEMO_TIMING } from "@/services/demo/demoTiming";
import { useModalManager } from '@/components/ui/modal-manager';
import FormCreationModal from '@/components/modals/FormCreationModal';

interface PatientWorkspaceProps {
  patient: Patient;
  initialTab: string;
  onBack: () => void;
}

export type DetailedPatientDataType = { patient: Patient; encounters: EncounterDetailsWrapper[] } | null;

export default function PatientWorkspaceViewModern({ patient: initialPatientStub, initialTab, onBack }: PatientWorkspaceProps) {
  const [activeTab, setActiveTab] = useState("consultation");
  const [patient, setPatient] = useState<Patient>(initialPatientStub);
  const [detailedPatientData, setDetailedPatientData] = useState<{ patient: Patient; encounters: EncounterDetailsWrapper[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeEncounterDetails, setActiveEncounterDetails] = useState<EncounterDetailsWrapper[]>([]);
  const [selectedEncounterForConsultation, setSelectedEncounterForConsultation] = useState<Encounter | null>(null);
  const [showConsultationPanel, setShowConsultationPanel] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [encounterToDeleteId, setEncounterToDeleteId] = useState<string | null>(null);
  const [isPatientOverviewOpen, setIsPatientOverviewOpen] = useState(false);
  const [showPriorAuthModal, setShowPriorAuthModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  // Demo integration using proper service layer
  const demoState = useDemo();
  const demoWorkspace = useDemoWorkspace({
    patient: patient,
    isDemoActive: demoState.isDemoActive,
    demoStage: demoState.demoStage,
    demoPatient: demoState.demoPatient,
    exitDemo: demoState.exitDemo,
    advanceDemoStage: demoState.advanceDemoStage,
  });

  // Demo consultation behavior
  const demoConsultation = useDemoConsultation({
    patient,
    isDemoActive: demoState.isDemoActive,
    demoStage: demoState.demoStage,
    animatedTranscript: demoState.animatedTranscript,
    onAdvanceStage: demoState.advanceDemoStage,
  });

  // Force demo panel open when on demo route
  const isDemoRoute = searchParams.get('demo') === 'true';
  const [demoPanelForceOpen, setDemoPanelForceOpen] = useState(false);

  const isLoadingDataRef = useRef(false);
  const loadedPatientIdRef = useRef<string | null>(null);

  // Track previous consultation selection to restore on discard
  const previousEncounterRef = useRef<Encounter | null>(null);

  // Modal manager integration to detect consultation-panel restoration
  const { getModalState } = useModalManager();
  const consultationModalId = `consultation-panel-patient-${initialPatientStub.id}`;
  const pendingRestoredConsultModal = getModalState(consultationModalId);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    const encounterId = searchParams.get('encounterId');
    if (encounterId && activeEncounterDetails.length > 0) {
      const foundEncounter = activeEncounterDetails.find(ew => ew.encounter.id === encounterId)?.encounter;
      if (foundEncounter) {
        setSelectedEncounterForConsultation(foundEncounter);
        
        // Check if we should auto-start the consultation panel (for existing encounters)
        const autoStart = searchParams.get('autoStart');
        const autoStartTranscription = searchParams.get('autoStartTranscription');
        if (autoStart === 'true' || autoStartTranscription === 'true') {
          // Save current selection to restore if modal is discarded
          previousEncounterRef.current = foundEncounter;
          setShowConsultationPanel(true);
        }
        
        // For new consultations with autoStartTranscription, just set the encounter and let ConsultationTab handle it
        // The consultation tab will automatically start transcription based on the autoStartTranscription parameter
      }
    }
  }, [searchParams, activeEncounterDetails]);

  const loadPatientData = useCallback(async (force = false) => {
    if (!patient?.id) return;
    
    // Prevent multiple simultaneous loads of the same patient, unless forcing refresh
    if (isLoadingDataRef.current || (!force && loadedPatientIdRef.current === patient.id)) {
      return;
    }
    
    isLoadingDataRef.current = true;
    loadedPatientIdRef.current = patient.id;
    setLoading(true);
    setError(null);
    
    try {
      // Handle demo mode with mock data
      if (demoState.isDemoActive && patient.id === demoState.demoPatient?.id) {
        const demoPatient = DemoDataService.getPatientData();
        const demoEncounter = DemoDataService.getEncounterData();
        
        const mockEncounterWrapper: EncounterDetailsWrapper = {
          encounter: {
            id: demoEncounter.id,
            encounterIdentifier: demoEncounter.encounterIdentifier,
            patientId: demoPatient.id,
            scheduledStart: demoEncounter.actualStart,
            scheduledEnd: demoEncounter.actualEnd,
            actualStart: demoEncounter.actualStart,
            actualEnd: demoEncounter.actualEnd,
            reasonCode: demoEncounter.reasonCode,
            reasonDisplayText: demoEncounter.reasonDisplayText,
            transcript: demoEncounter.transcript,
            soapNote: demoEncounter.soapNote,
            treatments: demoEncounter.treatments.map(t => ({
              drug: t.drug,
              status: t.status,
              rationale: t.rationale
            }))
          },
          diagnoses: [{
            patientId: demoEncounter.diagnosis.patientId,
            encounterId: demoEncounter.diagnosis.encounterId,
            code: demoEncounter.diagnosis.code,
            description: demoEncounter.diagnosis.description
          }],
          labResults: []
        };

        setDetailedPatientData({
          patient: demoPatient,
          encounters: [mockEncounterWrapper]
        });
        setPatient(demoPatient);
        setActiveEncounterDetails([mockEncounterWrapper]);
        setSelectedEncounterForConsultation(mockEncounterWrapper.encounter);
      } else {
        // Normal database loading for non-demo mode
        const detailedData = await supabaseDataService.getPatientData(patient.id);
        if (!detailedData) {
          setError("This patient's record could not be loaded. The database may be unreachable, or there is no patient with this ID.");
        } else {
          setDetailedPatientData(detailedData);
          setPatient(detailedData.patient);
          
          const nonDeletedEncounters = (detailedData.encounters || []).filter(ew => !ew.encounter.isDeleted);
          setActiveEncounterDetails(nonDeletedEncounters);
          
          // Only set selected encounter if none is currently selected
          const currentlySelected = selectedEncounterForConsultation;
          if (nonDeletedEncounters.length > 0 && !currentlySelected) {
            setSelectedEncounterForConsultation(nonDeletedEncounters[0].encounter);
          }
        }
      }
    } catch (err: unknown) {
      console.error("Failed to load patient data", err);
      setError(err instanceof Error ? err.message : "Failed to load patient data");
    } finally {
      setLoading(false);
      isLoadingDataRef.current = false;
    }
  }, [patient?.id, demoState.isDemoActive, demoState.demoPatient, selectedEncounterForConsultation]);

  useEffect(() => {
    loadPatientData();
  }, [loadPatientData]);

  // Subscribe to data changes to refresh when consultation data is saved
  useEffect(() => {
    const handleDataChange = () => {
      if (patient?.id) {
        loadPatientData(true); // Force refresh
      }
    };

    const handleCustomDataChange = (event: CustomEvent) => {
      if (event.detail?.patientId === patient?.id) {
        loadPatientData(true); // Force refresh for the specific patient
      }
    };

    // Subscribe to changes
    supabaseDataService.subscribe(handleDataChange);
    
    // Also listen for custom events from the editable fields
    window.addEventListener('supabase-data-change', handleCustomDataChange as EventListener);

    // Cleanup subscription on unmount
    return () => {
      supabaseDataService.unsubscribe(handleDataChange);
      window.removeEventListener('supabase-data-change', handleCustomDataChange as EventListener);
    };
  }, [patient?.id, loadPatientData]);

  useEffect(() => {
    // Only log when there are significant changes
    if (isDemoRoute && demoState.isDemoActive && !demoPanelForceOpen) {
      console.log('[PatientWorkspace] Demo route effect triggered:', {
        isDemoRoute,
        isDemoActive: demoState.isDemoActive,
        demoPanelForceOpen,
        currentStage: demoState.demoStage
      });
    }
    
    if (isDemoRoute && demoState.isDemoActive && !demoPanelForceOpen) {
      console.log('[PatientWorkspace] Setting demo panel force open and advancing from navigatingToWorkspace');
      setDemoPanelForceOpen(true);
      if (demoState.demoStage === 'navigatingToWorkspace') {
        demoState.advanceDemoStage('consultationPanelReady');
      }
    }
  }, [isDemoRoute, demoState.isDemoActive, demoState.demoStage]); // Remove demoPanelForceOpen to prevent loops

  useEffect(() => {
    // Only log when entering consultationPanelReady stage
    if (demoState.demoStage === 'consultationPanelReady') {
      console.log('[PatientWorkspace] Demo stage advancement effect triggered:', {
        currentStage: demoState.demoStage,
        advanceDemoStage: !!demoState.advanceDemoStage,
        isDemoActive: demoState.isDemoActive,
        animatedTranscriptLength: demoState.animatedTranscript?.length || 0
      });
      
      console.log('[PatientWorkspace] Stage is consultationPanelReady, setting timer to advance to animatingTranscript');
      const timer = setTimeout(() => {
        console.log('[PatientWorkspace] Timer executed, advancing to animatingTranscript');
        demoState.advanceDemoStage('animatingTranscript');
      }, DEMO_TIMING.panelSettleMs); // Small delay to allow panel to render
      return () => {
        console.log('[PatientWorkspace] Clearing demo stage advancement timer');
        clearTimeout(timer);
      };
    }
  }, [demoState.demoStage]); // Remove extra dependencies that cause loops

  useEffect(() => {
    if (
      pendingRestoredConsultModal &&
      !pendingRestoredConsultModal.isMinimized &&
      !pendingRestoredConsultModal.isVisible
    ) {
      setShowConsultationPanel(true);
    }
  }, [pendingRestoredConsultModal]);

  const handleDeleteEncounter = async () => {
    if (!encounterToDeleteId) return;
    
    try {
      const success = await supabaseDataService.markEncounterAsDeleted(patient.id, encounterToDeleteId);
      
      if (success) {
        setDetailedPatientData((prev) => {
          if (!prev) return prev;
          const updatedEncounters = prev.encounters.map(ew => 
            ew.encounter.id === encounterToDeleteId 
              ? { ...ew, encounter: { ...ew.encounter, isDeleted: true, deletedAt: new Date().toISOString() } }
              : ew
          );
          return { ...prev, encounters: updatedEncounters };
        });

        const nonDeletedEncounters = activeEncounterDetails.filter(ew => ew.encounter.id !== encounterToDeleteId);
        setActiveEncounterDetails(nonDeletedEncounters);
        
        if (selectedEncounterForConsultation?.id === encounterToDeleteId) {
          setSelectedEncounterForConsultation(nonDeletedEncounters.length > 0 ? nonDeletedEncounters[0].encounter : null);
        }
        
        toast({ title: "Success", description: "Encounter deleted successfully." });
      } else {
        toast({ title: "Error", description: "Failed to delete encounter. Please try again.", variant: "destructive" });
      }
    } catch (err: unknown) {
      console.error("Failed to delete encounter", err);
      toast({ title: "Error", description: `Failed to delete encounter: ${err instanceof Error ? err.message : "Unknown error"}`, variant: "destructive" });
    } finally {
      setShowDeleteConfirmation(false);
      setEncounterToDeleteId(null);
    }
  };

  const handleCancelDelete = () => {
    setEncounterToDeleteId(null);
    setShowDeleteConfirmation(false);
  };

  const handleConsultationCreated = (encounter: Encounter) => {
    const newEncounterWrapper: EncounterDetailsWrapper = { 
      encounter: encounter, 
      diagnoses: [], 
      labResults: [] 
    };

    setDetailedPatientData((prev) => {
      if (!prev || !prev.patient) return { patient: patient, encounters: [newEncounterWrapper] };
      const newEncountersList = [newEncounterWrapper, ...(prev.encounters || [])];
      return { ...prev, encounters: newEncountersList };
    });

    setSelectedEncounterForConsultation(encounter);
    setActiveTab('consultation');
    
    // Navigate with autoStartTranscription=true to automatically start transcription
    const url = new URL(window.location.href);
    url.searchParams.delete('autoStart'); // Clear old autoStart parameter
    url.searchParams.set('encounterId', encounter.id);
    url.searchParams.set('tab', 'consultation');
    url.searchParams.set('autoStartTranscription', 'true'); // Add auto-start transcription
    window.history.replaceState({}, '', url.toString());
    
    // Keep the consultation panel open so the user can work within the modal
    // The modal will only close when the user explicitly closes it (Save / Discard / X)
  };

  const openDeleteConfirmation = (encounterId: string) => {
    setEncounterToDeleteId(encounterId);
    setShowDeleteConfirmation(true);
  };

  // Memoize draggableConfig objects to prevent infinite loops
  const regularConsultationConfig = useMemo(() => ({
    id: `consultation-panel-patient-${patient.id}`,
    title: "New Consultation",
    defaultPosition: { x: 150, y: 80 },
    persistent: true
  }), [patient.id]);
  
  const demoConsultationConfig = useMemo(() => ({
    id: `demo-consultation-panel-${patient.id}`,
    title: "Demo Consultation",
    defaultPosition: { x: 200, y: 120 },
    persistent: false
  }), [patient.id]);

  if (loading) {
    return <LoadingState />;
  }

  if (error || !patient) {
    return (
      <ContentSurface>
        <BackLink onBack={onBack} />
        <ErrorState message={error || 'Patient not found'} onRetry={() => loadPatientData(true)} />
      </ContentSurface>
    );
  }

  const age = ageFrom(patient.dateOfBirth);
  const facts: Array<[string, React.ReactNode, boolean?]> = [
    ['Date of Birth', formatDate(patient.dateOfBirth), true],
    ['Age', age ?? '—', true],
    ['Gender', sexLabel(patient.gender)],
    ...(patient.ethnicity ? [['Ethnicity', patient.ethnicity] as [string, React.ReactNode]] : []),
    ...(patient.race ? [['Race', patient.race] as [string, React.ReactNode]] : []),
    ['Patient ID', patient.id, true],
  ];
  const sortedEncounters = [...activeEncounterDetails].sort(
    (a, b) => new Date(b.encounter.scheduledStart).getTime() - new Date(a.encounter.scheduledStart).getTime(),
  );

  return (
    <ContentSurface className="relative">
      <BackLink onBack={onBack} />

      <section className="overflow-hidden rounded-[1.25rem] border border-hairline bg-card shadow-card">
        <div className="relative isolate flex flex-wrap items-start justify-between gap-x-8 gap-y-5 p-5 sm:p-7">
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-28 bg-gradient-to-b from-iris-soft/70 to-transparent" aria-hidden />
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <PatientAvatar patient={patient} size={64} className="ring-4 ring-card" />
            <h1 className="title-display min-w-0 text-[2rem] sm:text-[2.6rem]">{patientName(patient)}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              iconLeft={<Plus weight="bold" />}
              onClick={() => {
                // Keep the current selection to restore if the new consultation is discarded.
                previousEncounterRef.current = selectedEncounterForConsultation;
                setSelectedEncounterForConsultation(null);
                setShowConsultationPanel(true);
              }}
            >
              New Consultation
            </Button>
            <Button variant="secondary" aria-label="Prior Auth" className="max-sm:w-9 max-sm:px-0" onClick={() => setShowPriorAuthModal(true)}>
              <ClipboardText aria-hidden /><span className="max-sm:sr-only">Prior Auth</span>
            </Button>
            <Button variant="secondary" aria-label="Referral" className="max-sm:w-9 max-sm:px-0" onClick={() => setShowReferralModal(true)}>
              <PaperPlaneTilt aria-hidden /><span className="max-sm:sr-only">Referral</span>
            </Button>
          </div>
        </div>

        <dl className="flex flex-wrap gap-x-10 gap-y-4 border-t border-hairline px-5 py-4 sm:px-7">
          {facts.map(([label, value, mono]) => (
            <div key={label} className={cn('min-w-0', label === 'Patient ID' && 'basis-full sm:basis-auto')}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className={cn('mt-0.5 text-[0.9375rem] text-ink', mono && 'data-mono break-all text-sm')}>{value}</dd>
            </div>
          ))}
        </dl>

        {patient.alerts && patient.alerts.length > 0 ? (
          <ul className="space-y-px border-t border-hairline bg-well/60">
            {patient.alerts.map((alert) => {
              const tone = severityTone(alert.severity, alert.likelihood);
              return (
                <li key={alert.id} className="flex items-start gap-3 px-5 py-3 sm:px-7">
                  <WarningCircle
                    size={18}
                    weight="fill"
                    className={cn('mt-px shrink-0', tone === 'critical' ? 'text-critical' : tone === 'flag' ? 'text-flag-line' : 'text-iris')}
                    aria-label={alert.severity ?? undefined}
                  />
                  <span className="text-sm text-ink-2">{alert.msg}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Chart" className="inline-flex h-11 w-fit items-center gap-1 rounded-xl border border-hairline bg-well p-1">
          {([['consultation', 'Consultation'], ['allData', 'All Data']] as const).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={activeTab === k}
              onClick={() => setActiveTab(k)}
              className={cn(
                'h-9 rounded-lg px-4 text-sm font-medium transition-[background-color,color,box-shadow] duration-150',
                activeTab === k ? 'bg-card text-ink shadow-card' : 'text-muted-foreground hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {activeTab === 'consultation' && sortedEncounters.length > 0 ? (
          <div className="sm:w-[22rem]">
            <Select
              value={selectedEncounterForConsultation?.id || ""}
              onValueChange={(value) => {
                const found = activeEncounterDetails.find(ew => ew.encounter.id === value)?.encounter || null;
                setSelectedEncounterForConsultation(found);
              }}
              disabled={showDeleteConfirmation}
            >
              <SelectTrigger aria-label="Consultation" className="h-11 rounded-xl">
                <SelectValue placeholder="Select consultation..." />
              </SelectTrigger>
              <SelectContent className="max-w-[calc(100vw-2rem)]">
                {sortedEncounters.map((ew) => (
                  <SelectItem key={ew.encounter.id} value={ew.encounter.id}>
                    <span className="data-mono text-muted-foreground">{formatDate(ew.encounter.scheduledStart)}</span>
                    <span className="ml-2">{ew.encounter.reasonDisplayText || ew.encounter.reasonCode || 'Encounter'}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className="pt-6">
        {activeTab === "consultation" && patient && (
          <ConsolidatedConsultationTab
            patient={patient}
            selectedEncounter={selectedEncounterForConsultation}
            allEncounters={activeEncounterDetails}
            onDeleteEncounter={openDeleteConfirmation}
            autoStartTranscription={searchParams.get('autoStartTranscription') === 'true'}
          />
        )}
        {activeTab === "allData" && (
          <AllDataViewTab detailedPatientData={detailedPatientData} setDetailedPatientData={setDetailedPatientData} />
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirmation && encounterToDeleteId && (
        <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this encounter? This action cannot be undone immediately, but encounters can be restored by an admin.
                <br /> <br />
                Encounter Date: {format(activeEncounterDetails.find(ew => ew.encounter.id === encounterToDeleteId)?.encounter.scheduledStart || new Date(), 'PPP ppp')}
                <br />
                Reason: {activeEncounterDetails.find(ew => ew.encounter.id === encounterToDeleteId)?.encounter.reasonDisplayText || activeEncounterDetails.find(ew => ew.encounter.id === encounterToDeleteId)?.encounter.reasonCode || 'N/A'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancelDelete}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteEncounter} className={buttonVariants({ variant: "destructive" })}>Delete Encounter</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Regular Consultation Panel - separated from demo */}
      <ConsultationPanel
        isOpen={showConsultationPanel && !demoWorkspace.shouldRunDemoUi}
        onClose={() => {
          // Close modal and restore previous selection if discarded
          setShowConsultationPanel(false);
          setSelectedEncounterForConsultation(previousEncounterRef.current);
          previousEncounterRef.current = null;
          
          // Remove autoStartTranscription parameter from URL to prevent re-triggering
          const url = new URL(window.location.href);
          url.searchParams.delete('autoStartTranscription');
          window.history.replaceState({}, '', url.toString());
        }}
        patient={patient}
        onConsultationCreated={handleConsultationCreated}
        isDemoMode={false}
        draggable={true}
        allowDragging={false}
        draggableConfig={regularConsultationConfig}
        selectedEncounter={selectedEncounterForConsultation}
        autoStartTranscription={searchParams.get('autoStartTranscription') === 'true'}
      />

      {/* Demo Consultation Panel - separate instance for demo */}
      {(demoWorkspace.shouldRunDemoUi || (isDemoRoute && demoPanelForceOpen)) && (
        <ConsultationPanel
          isOpen={demoWorkspace.isDemoPanelOpen || demoPanelForceOpen}
          onClose={() => {
            setDemoPanelForceOpen(false);
            demoState.exitDemoStayOnPage();
          }}
          patient={patient}
          onConsultationCreated={handleConsultationCreated}
          isDemoMode={true}  // Force demo mode when on demo route
          initialDemoTranscript={demoConsultation.initialDemoTranscript}
          demoDiagnosis={demoConsultation.demoDiagnosis}
          demoTreatment={demoConsultation.demoTreatment}
          demoDifferentialDiagnoses={demoConsultation.demoDifferentialDiagnoses}
          demoSoapNote={demoConsultation.demoSoapNote}
          isDemoGeneratingPlan={demoConsultation.isDemoGeneratingPlan}
          onDemoClinicalPlanClick={demoConsultation.onDemoClinicalPlanClick}
          draggable={true}
          allowDragging={false}
          draggableConfig={demoConsultationConfig}
        />
      )}

      {/* Prior Authorization Modal */}
      <FormCreationModal
        open={showPriorAuthModal}
        onOpenChange={setShowPriorAuthModal}
        formType="priorAuth"
        patientId={patient?.id}
        encounterId={selectedEncounterForConsultation?.id}
      />

      {/* Referral Modal */}
      <FormCreationModal
        open={showReferralModal}
        onOpenChange={setShowReferralModal}
        formType="referral"
        patientId={patient?.id}
        encounterId={selectedEncounterForConsultation?.id}
      />
    </ContentSurface>
  );
}
function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      aria-label="Back to Patients"
      className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-card text-ink shadow-card transition-colors hover:bg-well"
    >
      <CaretLeft size={16} weight="bold" aria-hidden />
    </button>
  );
}

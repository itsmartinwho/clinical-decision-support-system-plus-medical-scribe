'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Patient, DifferentialDiagnosis, SoapNote, RichContent } from '@/lib/types';
import { DEMO_PATIENT_ID, DemoDataService } from '@/services/demo/DemoDataService';
import { DemoStage } from '@/services/demo/DemoStateService';
import { DEMO_TIMING } from '@/services/demo/demoTiming';
import { getDemoDifferentialDiagnoses } from '@/data/demoClinicalResults';

export interface DemoConsultationBehavior {
  isDemoMode: boolean;
  initialDemoTranscript?: string;
  demoDiagnosis?: string;
  demoTreatment?: RichContent;
  demoDifferentialDiagnoses?: DifferentialDiagnosis[];
  demoSoapNote?: SoapNote;
  isDemoGeneratingPlan?: boolean;
  onDemoClinicalPlanClick?: () => void;
}

export function useDemoConsultation({
  patient,
  isDemoActive,
  demoStage,
  animatedTranscript,
  onAdvanceStage,
}: {
  patient?: Patient | null;
  isDemoActive: boolean;
  demoStage: DemoStage;
  animatedTranscript?: string;
  onAdvanceStage?: (stage: DemoStage) => void;
}): DemoConsultationBehavior {
  const searchParams = useSearchParams();
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  
  // Check if this is the demo patient and demo is active
  // Also check URL parameter for demo mode
  const isDemoRoute = searchParams.get('demo') === 'true';
  const isDemoMode = isDemoActive && (patient?.id === DEMO_PATIENT_ID || isDemoRoute);
  
  // Demo transcript progression based on stage - use real enriched data
  const getDemoTranscript = () => {
    if (!isDemoMode) {
      return undefined;
    }
    
    // During animation stage, use the animated transcript
    if (demoStage === 'animatingTranscript' && animatedTranscript) {
      return animatedTranscript;
    }
    
    // After animation completes, use the full transcript
    if (demoStage === 'simulatingPlanGeneration' || demoStage === 'showingPlan' || demoStage === 'finished') {
      const encounterData = DemoDataService.getEncounterData();
      return encounterData.transcript || undefined;
    }
    
    // When consultation panel is ready to open, start with empty string to show the editor
    if (demoStage === 'consultationPanelReady') {
      return '';
    }
    
    // Before animation starts, return empty string to initialize the transcript area
    return '';
  };
  
  // Demo diagnosis based on stage - use real enriched data
  const getDemoDiagnosis = () => {
    if (!isDemoMode) return undefined;
    
    switch (demoStage) {
      case 'showingPlan':
      case 'finished':
        // Use the real enriched diagnosis from DemoDataService
        return DemoDataService.getDiagnosisText();
      default:
        return undefined;
    }
  };
  
  // Demo treatment based on stage - use rich content data
  const getDemoTreatment = (): RichContent | undefined => {
    if (!isDemoMode) return undefined;
    
    switch (demoStage) {
      case 'showingPlan':
      case 'finished':
        // Use the rich content from DemoDataService
        return DemoDataService.getDemoRichTreatmentContent();
      default:
        return undefined;
    }
  };

  // Demo differential diagnoses based on stage - use fresh clinical results
  const getDemoDifferentialDiagnosesForStage = (): DifferentialDiagnosis[] | undefined => {
    if (!isDemoMode) return undefined;
    
    switch (demoStage) {
      case 'showingPlan':
      case 'finished':
        // Use the imported function to get differential diagnoses
        return getDemoDifferentialDiagnoses();
      default:
        return undefined;
    }
  };

  // Demo SOAP notes based on stage
  const getDemoSoapNote = (): SoapNote | undefined => {
    if (!isDemoMode) return undefined;
    
    switch (demoStage) {
      case 'showingPlan':
      case 'finished':
        // Use the SOAP notes from DemoDataService
        return DemoDataService.getSoapNotes();
      default:
        return undefined;
    }
  };
  
  // Handle demo clinical plan generation
  const handleDemoClinicalPlan = () => {
    if (!isDemoMode || !onAdvanceStage) return;
    
    setIsGeneratingPlan(true);
    
    // A short beat for the "Analyzing..." state, from the demo's one clock
    setTimeout(() => {
      setIsGeneratingPlan(false);
      onAdvanceStage('showingPlan');
    }, DEMO_TIMING.planBeatMs);
  };
  
  // Reset generation state when stage changes
  useEffect(() => {
    if (demoStage !== 'simulatingPlanGeneration') {
      setIsGeneratingPlan(false);
    }
  }, [demoStage]);
  
  return {
    isDemoMode,
    initialDemoTranscript: getDemoTranscript(),
    demoDiagnosis: getDemoDiagnosis(),
    demoTreatment: getDemoTreatment(),
    demoDifferentialDiagnoses: getDemoDifferentialDiagnosesForStage(),
    demoSoapNote: getDemoSoapNote(),
    isDemoGeneratingPlan: isGeneratingPlan,
    onDemoClinicalPlanClick: isDemoMode ? handleDemoClinicalPlan : undefined,
  };
} 
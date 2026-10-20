'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor, RichTextEditorRef } from '@/components/ui/rich-text-editor';
import { RichTreatmentEditor } from '@/components/ui/rich-treatment-editor';
import { TreatmentRenderer } from '@/components/advisor/streaming-markdown/treatment-renderer';
import { useRichContentEditor } from '@/hooks/useRichContentEditor';
import { X, Brain, CircleNotch, PauseCircle, PlayCircle, FloppyDisk, Bell } from '@phosphor-icons/react';
import { AudioWaveform } from '@/components/ui/AudioWaveform';
import { openDeepgramSocket, TranscriptionUnavailableError } from '@/lib/deepgram';
import { DemoAudioWaveform } from '@/components/ui/DemoAudioWaveform';
import { RealTimeAlertManager } from '@/components/alerts/RealTimeAlertManager';
import { AlertToast } from '@/components/alerts/AlertToast';
import { useRealTimeAlerts } from '@/hooks/useRealTimeAlerts';
import { format } from 'date-fns';
import type { Patient, Encounter, Treatment, DifferentialDiagnosis, SoapNote, RichContent } from '@/lib/types';
import { supabaseDataService } from '@/lib/supabaseDataService';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useDemo } from '@/contexts/DemoContext';
import DifferentialDiagnosesList from '@/components/diagnosis/DifferentialDiagnosesList';
import { SOAPNotesPanel } from '@/components/soap/SOAPNotesPanel';
import { DraggableModalWrapper } from '@/components/ui/draggable-modal-wrapper';
import { ModalDragAndMinimizeConfig } from '@/types/modal';
import { saveConsultationDraft, loadConsultationDraft, clearConsultationDraft } from '@/lib/consultationDraftStore';
import { DemoDataService } from '@/services/demo/DemoDataService';
import TranscriptView from '@/components/transcript/TranscriptView';
import TranscriptModeToggle from '@/components/transcript/TranscriptModeToggle';

interface ConsultationPanelProps {
  /** Controls open state from parent */
  isOpen: boolean;
  /** Callback when panel should close */
  onClose: () => void;
  /** Patient to create consultation for */
  patient: Patient; // Remains required as per instructions, even if DB ops are skipped in demo
  /** Callback when consultation is successfully created */
  onConsultationCreated?: (encounter: Encounter) => void;
  /** If true, panel operates in demo mode, driven by external state */
  isDemoMode?: boolean;
  /** Initial transcript content for demo mode */
  initialDemoTranscript?: string;
  /** Initial diagnosis content for demo mode */
  demoDiagnosis?: string;
  /** Initial treatment content for demo mode */
  demoTreatment?: RichContent;
  /** Initial differential diagnoses for demo mode */
  demoDifferentialDiagnoses?: DifferentialDiagnosis[];
  /** Initial SOAP notes for demo mode */
  demoSoapNote?: SoapNote;
  /** Callback for when "Clinical Plan" is clicked in demo mode */
  onDemoClinicalPlanClick?: () => void;
  /** Controls loading state of Clinical Plan button externally for demo */
  isDemoGeneratingPlan?: boolean;
  /** Enable draggable functionality */
  draggable?: boolean;
  /** Allow dragging behavior (separate from modal functionality) */
  allowDragging?: boolean;
  /** Configuration for drag and minimize behavior */
  draggableConfig?: ModalDragAndMinimizeConfig;
  /** Optional existing encounter to use instead of creating a new one */
  selectedEncounter?: Encounter | null;
  /** Whether to automatically start transcription when opening with an existing encounter */
  autoStartTranscription?: boolean;
}

// Styled DatePicker component to match the design
const StyledDatePicker = React.forwardRef<any, any>(({ className, onChange, selected, ...props }, ref) => (
  <DatePicker
    ref={ref}
    selected={selected}
    onChange={onChange}
    className={cn(
      "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
StyledDatePicker.displayName = "StyledDatePicker";

export default function ConsultationPanel({
  isOpen,
  onClose,
  patient,
  onConsultationCreated,
  isDemoMode = false,
  initialDemoTranscript,
  demoDiagnosis,
  demoTreatment,
  demoDifferentialDiagnoses,
  demoSoapNote,
  onDemoClinicalPlanClick,
  isDemoGeneratingPlan = false,
  draggable = false,
  allowDragging = false,
  draggableConfig,
  selectedEncounter,
  autoStartTranscription = false,
}: ConsultationPanelProps) {
  // Debug demo mode detection - only log when demo mode actually changes
  useEffect(() => {
    if (isOpen && isDemoMode) {
      console.log('[ConsultationPanel] Demo mode detection:', {
        isDemoMode,
        patientId: patient?.id,
        hasInitialTranscript: !!initialDemoTranscript,
        hasDemoDiagnosis: !!demoDiagnosis,
        hasDemoTreatment: !!demoTreatment,
        hasOnClickHandler: !!onDemoClinicalPlanClick
      });
    }
  }, [isOpen, isDemoMode]); // Remove frequently changing dependencies
  const { toast } = useToast();
  const demoState = useDemo();
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const isCurrentlyCreatingEncounter = useRef(false);
  const [mounted, setMounted] = useState(false);
  
  // Render counting and circuit breaker - optimize for less interference
  const renderCountRef = useRef(0);
  const circuitBreakerRef = useRef(false);
  const lastResetTimeRef = useRef(Date.now());
  
  // Only count renders in development mode and implement circuit breaker
  if (process.env.NODE_ENV === 'development' && !circuitBreakerRef.current) {
    renderCountRef.current++;
    
    // Reset counter every 10 seconds to handle normal re-renders during user interactions (increased from 5s)
    const now = Date.now();
    if (now - lastResetTimeRef.current > 10000) {
      renderCountRef.current = 1;
      lastResetTimeRef.current = now;
    }
    
    // Increase threshold for demo mode since it has legitimate frequent re-renders
    const threshold = isDemoMode ? 25 : 20;
    if (renderCountRef.current > threshold) {
      console.error(`[ConsultationPanel] Excessive renders detected (>${threshold}), enabling circuit breaker!`);
      console.trace();
      circuitBreakerRef.current = true;
      
      // Reset after a shorter delay for demo mode
      setTimeout(() => {
        renderCountRef.current = 0;
        circuitBreakerRef.current = false;
        lastResetTimeRef.current = Date.now();
        console.log('[ConsultationPanel] Circuit breaker reset');
      }, isDemoMode ? 2000 : 3000);
    }
  }
  
  // Form state
  const [reason, setReason] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date>(new Date());
  const [duration, setDuration] = useState(30);
  
  // Consultation state
  const [started, setStarted] = useState(false);
  const [transcriptText, setTranscriptText] = useState('');
  const [diagnosisText, setDiagnosisText] = useState('');
  const [treatmentText, setTreatmentText] = useState('');
  const [differentialDiagnoses, setDifferentialDiagnoses] = useState<DifferentialDiagnosis[]>([]);
  const [isLoadingDifferentials, setIsLoadingDifferentials] = useState(false);
  const [activeTab, setActiveTab] = useState('transcript');
  const [transcriptMode, setTranscriptMode] = useState<'conversation' | 'edit'>('conversation');
  const [planGenerated, setPlanGenerated] = useState(false);
  const [tabBarVisible, setTabBarVisible] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // SOAP Notes state
  const [soapNote, setSoapNote] = useState<SoapNote | null>(null);
  const [isGeneratingSoap, setIsGeneratingSoap] = useState(false);
  
  // Rich content state management - stable error handlers to prevent re-renders
  const handleDiagnosisError = useCallback((error: Error) => {
    console.error('Diagnosis rich content error:', error);
    toast({ 
      title: "Error saving diagnosis", 
      description: error.message, 
      variant: "destructive" 
    });
  }, [toast]);

  const handleTreatmentError = useCallback((error: Error) => {
    console.error('Treatment rich content error:', error);
    toast({ 
      title: "Error saving treatment", 
      description: error.message, 
      variant: "destructive" 
    });
  }, [toast]);

  // Only use rich content editor in non-demo mode to prevent unnecessary state updates
  const diagnosisRichContent = useRichContentEditor({
    encounterId: isDemoMode ? '' : (encounter?.id || ''),
    contentType: 'diagnosis',
    onError: handleDiagnosisError,
    initialContent: isDemoMode ? DemoDataService.getDemoRichDiagnosisContent() : undefined
  });
  
  const treatmentRichContent = useRichContentEditor({
    encounterId: isDemoMode ? '' : (encounter?.id || ''),
    contentType: 'treatments', 
    onError: handleTreatmentError,
    initialContent: isDemoMode ? (demoTreatment || DemoDataService.getDemoRichTreatmentContent()) : undefined
  });
  
  // Transcription state and refs
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  
  // New state for confirmation dialog
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [editedWhilePaused, setEditedWhilePaused] = useState(false);
  
  // Refs
  const transcriptEditorRef = useRef<RichTextEditorRef>(null);
  const diagnosisEditorRef = useRef<RichTextEditorRef>(null);
  const treatmentEditorRef = useRef<RichTextEditorRef>(null);
  const demoInitializedRef = useRef<boolean>(false);
  const startVoiceInputRef = useRef<(() => Promise<any>) | null>(null);
  const autoStartAttemptedRef = useRef<Set<string>>(new Set());
  const autoStartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoStartSessionRef = useRef(false);
  const transcriptionActiveRef = useRef(false);

  // add refs
  const isTranscribingRef = useRef(false);
  const isPausedRef = useRef(false);
  useEffect(()=>{isTranscribingRef.current=isTranscribing;},[isTranscribing]);
  useEffect(()=>{isPausedRef.current=isPaused;},[isPaused]);

  // CRITICAL: Update both state and ref when transcription status changes
  // This ref is essential for cleanup functions that need current transcription state
  const setIsTranscribingAndRef = (val: boolean) => {
    setIsTranscribing(val);
    transcriptionActiveRef.current = val;
  };

  // CRITICAL: Store the original getUserMedia stream for complete cleanup
  const originalStreamRef = useRef<MediaStream | null>(null);

  // ---------- Real-time Alerts Integration ----------
  const [showRealTimeAlerts, setShowRealTimeAlerts] = useState(false);
  const [alertToasts, setAlertToasts] = useState<any[]>([]);
  const [demoAlertToasts, setDemoAlertToasts] = useState<any[]>([]);
  
  // Real-time alerts hook (without auto-start/stop to avoid dependency loops)
  const realTimeAlerts = useRealTimeAlerts({
    enabled: false, // Manual management only
    patientId: patient?.id,
    encounterId: encounter?.id,
    onAlert: (alert) => {
      // Add alert to toast display
      setAlertToasts(prev => [...prev.slice(-2), alert]); // Keep max 3 toasts
    },
    onError: (error) => {
      console.error('Real-time alerts error:', error);
      toast({
        title: 'Alert System Error',
        description: 'Real-time alerts temporarily unavailable',
        variant: 'destructive'
      });
    }
  });

  // Track if we should start real-time alerts  
  const shouldStartAlertsRef = useRef(false);
  
  // Note: Real-time alerts session management moved to be handled manually 
  // in specific functions to avoid dependency loops in useEffect

  // ---------- Draft persistence across page navigation ----------
  // Use stable draft ID that doesn't change during the component lifecycle
  const draftId = useMemo(() => (draggableConfig?.id) ?? `consultation-draft-${patient.id}`, [draggableConfig?.id, patient.id]);

  // Load draft on open - stable dependencies
  useEffect(() => {
    if (isOpen && !isDemoMode) {
      const draft = loadConsultationDraft(draftId);
      if (draft?.transcriptText && !transcriptText) {
        setTranscriptText(draft.transcriptText);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, draftId, isDemoMode]); // Remove transcriptText dependency to prevent loops

  // Persist transcript text whenever it changes - debounced
  useEffect(() => {
    if (!isOpen || isDemoMode) return;
    
    const timeoutId = setTimeout(() => {
      if (transcriptText) {
        saveConsultationDraft(draftId, { transcriptText });
      }
    }, 500); // Debounce saves
    
    return () => clearTimeout(timeoutId);
  }, [transcriptText, isOpen, draftId, isDemoMode]);

  // Update transcript for real-time alert processing
  useEffect(() => {
    if (started && transcriptText && shouldStartAlertsRef.current) {
      if (isDemoMode) {
        // Use demo alerts service instead of real alerts for demo mode
        import('@/services/demo/DemoAlertsService').then(({ demoAlertsService, DemoAlertsService }) => {
          const newAlerts = demoAlertsService.checkForAlerts(transcriptText);
          // Trigger alerts immediately for demo
          newAlerts.forEach(alert => {
            console.log('[Demo Alert Triggered]:', alert.title);
            const formattedAlert = DemoAlertsService.formatDemoAlert(alert);
            addDemoAlertToast(formattedAlert);
          });
        });
      } else {
        realTimeAlerts.updateTranscript(transcriptText);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcriptText, started, isDemoMode]); // realTimeAlerts intentionally excluded to prevent dependency loops

  // Helper to clear draft and perform close
  const finalizeAndClose = useCallback(() => {
    clearConsultationDraft(draftId);
    onClose();
  }, [draftId, onClose]);

  // Remove alert toast
  const removeAlertToast = useCallback((alertId: string) => {
    setAlertToasts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);

  // Demo alert toast functions
  const addDemoAlertToast = useCallback((alert: any) => {
    setDemoAlertToasts(prev => [...prev.slice(-2), alert]); // Keep max 3 toasts
  }, []);

  const removeDemoAlertToast = useCallback((alertId: string) => {
    setDemoAlertToasts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);

  // --- LIFECYCLE & SETUP ---

  useEffect(() => {
    setMounted(true);
  }, []);

  // CRITICAL: Comprehensive audio cleanup function
  // This ensures ALL audio tracks are stopped from every possible source
  const cleanupAllAudioResources = useCallback(() => {
    console.log('[ConsultationPanel] Performing comprehensive audio cleanup');
    
    // Store references to all tracks before cleanup for verification
    const allTracks: MediaStreamTrack[] = [];
    
    // Stop MediaRecorder and its stream
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch (e) {
        console.warn('Error stopping MediaRecorder:', e);
      }
      
      // Stop ALL tracks from MediaRecorder's stream
      if (mediaRecorderRef.current.stream) {
        const tracks = mediaRecorderRef.current.stream.getTracks();
        tracks.forEach(track => {
          allTracks.push(track);
          console.log(`Stopping MediaRecorder track: ${track.kind}, state: ${track.readyState}, enabled: ${track.enabled}`);
          if (track.readyState === 'live') {
            track.stop();
            console.log(`MediaRecorder track stopped: ${track.kind}, new state: ${track.readyState}`);
          }
        });
      }
      mediaRecorderRef.current = null;
    }
    
    // Stop ALL tracks from audioStreamRef
    if (audioStreamRef.current) {
      const tracks = audioStreamRef.current.getTracks();
      tracks.forEach(track => {
        allTracks.push(track);
        console.log(`Stopping audioStreamRef track: ${track.kind}, state: ${track.readyState}, enabled: ${track.enabled}`);
        if (track.readyState === 'live') {
          track.stop();
          console.log(`AudioStreamRef track stopped: ${track.kind}, new state: ${track.readyState}`);
        }
      });
      audioStreamRef.current = null;
    }
    
    // CRITICAL: Stop the original getUserMedia stream
    if (originalStreamRef.current) {
      const tracks = originalStreamRef.current.getTracks();
      tracks.forEach(track => {
        allTracks.push(track);
        console.log(`Stopping original stream track: ${track.kind}, state: ${track.readyState}, enabled: ${track.enabled}`);
        if (track.readyState === 'live') {
          track.stop();
          console.log(`Original stream track stopped: ${track.kind}, new state: ${track.readyState}`);
        }
      });
      originalStreamRef.current = null;
    }
    
    // Close WebSocket
    if (socketRef.current) {
      try {
        if (socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.close();
        }
      } catch (e) {
        console.warn('Error closing WebSocket:', e);
      }
      socketRef.current = null;
    }
    
    // Verify all tracks are actually stopped
    setTimeout(() => {
      console.log('[ConsultationPanel] Verifying track cleanup:');
      allTracks.forEach((track, index) => {
        console.log(`Track ${index}: ${track.kind}, state: ${track.readyState}, enabled: ${track.enabled}`);
      });
      
      // Final verification: Log current track count
      console.log(`[ConsultationPanel] Total tracks processed: ${allTracks.length}`);
    }, 100);
    
    // Reset transcription state
    setIsTranscribingAndRef(false);
    setIsPaused(false);
    transcriptionActiveRef.current = false;
    
    // Stop real-time alerts session if active
    if (shouldStartAlertsRef.current) {
      shouldStartAlertsRef.current = false;
      try {
        realTimeAlerts.endSession();
      } catch (error) {
        console.warn('Error stopping real-time alerts session:', error);
      }
    }
    
    console.log('[ConsultationPanel] Audio cleanup completed - all tracks stopped and streams cleared');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // realTimeAlerts is stable and doesn't need to be a dependency

  // CRITICAL PATTERN: stopTranscription is NOT in any dependency arrays
  // Including it would cause immediate start/stop cycles due to React re-renders
  const stopTranscription = useCallback((resetPaused: boolean = true)=>{
    console.log("ConsultationPanel stopTranscription called",{resetPaused,isTranscribing:isTranscribingRef.current,isPaused:isPausedRef.current});
    if(isDemoMode) return;
    cleanupAllAudioResources();
    if(resetPaused) setIsPaused(false);
  },[isDemoMode, cleanupAllAudioResources]);

  const handleSaveAndClose = useCallback(async () => {
    // Call comprehensive cleanup if transcription is active
    if (!isDemoMode && transcriptionActiveRef.current) {
      cleanupAllAudioResources();
    }
    
    if (isDemoMode || !encounter) {
      finalizeAndClose();
      return;
    }
    if (isSaving) return;
  
    setIsSaving(true);
    try {
      if (!encounter) throw new Error("Encounter not available for saving.");
  
      const updatePromises = [];
      const compositeEncounterId = `${patient.id}_${encounter.encounterIdentifier}`;
  
      const finalTranscript = transcriptText.trim();
      if (finalTranscript) {
        updatePromises.push(supabaseDataService.updateEncounterTranscript(patient.id, compositeEncounterId, finalTranscript));
      }
      
      // Save diagnosis (both text and rich content)
      const finalDiagnosis = diagnosisText.trim();
      if (finalDiagnosis) {
        updatePromises.push(supabaseDataService.savePrimaryDiagnosis(patient.id, encounter.encounterIdentifier, finalDiagnosis));
      }
      
      // Save diagnosis rich content if available
      if (diagnosisRichContent.content) {
        updatePromises.push(diagnosisRichContent.saveContent(diagnosisRichContent.content));
      }
      
      // Save treatments (both text and rich content)
      const finalTreatmentText = treatmentText.trim();
      if (finalTreatmentText) {
        const treatments: Treatment[] = [{
          drug: finalTreatmentText,
          status: 'prescribed',
          rationale: 'Physician\'s assessment during consultation.'
        }];
        updatePromises.push(supabaseDataService.updateEncounterTreatments(patient.id, compositeEncounterId, treatments));
      }
      
      // Save treatment rich content if available
      if (treatmentRichContent.content) {
        updatePromises.push(treatmentRichContent.saveContent(treatmentRichContent.content));
      }
      
      const soapNote = (finalTranscript || finalDiagnosis || finalTreatmentText) 
          ? `S: ${finalTranscript || 'See transcript'}\nO: Clinical examination performed\nA: ${finalDiagnosis || 'See diagnosis'}\nP: ${finalTreatmentText || 'See treatment plan'}`
          : undefined;
      
      if (soapNote) {
        updatePromises.push(supabaseDataService.updateEncounterSOAPNote(patient.id, compositeEncounterId, soapNote));
      }
      
      await Promise.all(updatePromises);
      
      // Trigger post-consultation analysis
      if (encounter?.id) {
        try {
          const response = await fetch('/api/alerts/post-consultation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patientId: patient.id,
              encounterId: encounter.id,
              trigger: 'consultation_save'
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            if (result.alertCount > 0) {
              toast({ 
                title: "Consultation Saved", 
                description: `${result.alertCount} post-consultation alerts generated` 
              });
            } else {
              toast({ title: "Consultation Saved" });
            }
          } else {
            console.warn('Post-consultation analysis failed:', await response.text());
            toast({ title: "Consultation Saved" });
          }
        } catch (error) {
          console.error('Post-consultation analysis error:', error);
          toast({ title: "Consultation Saved" });
        }
      } else {
        toast({ title: "Consultation Saved" });
      }
      
      finalizeAndClose();
    } catch (error) {
      console.error("Failed to save consultation:", error);
      toast({ title: "Save Failed", description: error instanceof Error ? error.message : "An unknown error occurred.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [isDemoMode, patient.id, encounter, transcriptText, diagnosisText, treatmentText, finalizeAndClose, toast, isSaving, cleanupAllAudioResources]);

  const handleDiscard = useCallback(async () => {
    // Call comprehensive cleanup if transcription is active
    if (!isDemoMode && transcriptionActiveRef.current) {
      cleanupAllAudioResources();
    }
    
    if (isDemoMode) {
      finalizeAndClose();
      return;
    }
    if (encounter) {
      await supabaseDataService.permanentlyDeleteEncounter(patient.id, encounter.id);
    }
    finalizeAndClose();
  }, [isDemoMode, encounter, patient.id, finalizeAndClose, cleanupAllAudioResources]);
  
  const handleCloseRequest = useCallback(() => {
    if (isDemoMode) {
      finalizeAndClose();
      return;
    }

    // First, handle transcription if it's running
    const isActivelyTranscribing = transcriptionActiveRef.current || isTranscribing || isPaused;
    const hasTranscriptContent = transcriptText.trim();
    const hasOtherContent = diagnosisText.trim() || treatmentText.trim();
    const hasAnyContent = hasTranscriptContent || hasOtherContent;

    // If transcription is active but no content, stop transcription and close immediately
    if (isActivelyTranscribing && !hasAnyContent) {
      console.log('[ConsultationPanel] Closing modal with active transcription but no content - stopping transcription');
      cleanupAllAudioResources();
      handleDiscard();
      return;
    }

    // If transcription is active AND there's content, ask for confirmation with transcription context
    if (isActivelyTranscribing && hasAnyContent) {
      console.log('[ConsultationPanel] Closing modal with active transcription and content - asking for confirmation');
      setShowConfirmationDialog(true);
      return;
    }

    // If no transcription is active, use the existing logic
    if (hasAnyContent) {
      setShowConfirmationDialog(true);
    } else {
      handleDiscard();
    }
  }, [isDemoMode, transcriptText, diagnosisText, treatmentText, finalizeAndClose, handleDiscard, isTranscribing, isPaused, cleanupAllAudioResources]);

  const handleConfirmSave = useCallback(() => {
    setShowConfirmationDialog(false);
    handleSaveAndClose();
  }, [handleSaveAndClose]);

  const handleConfirmDiscard = useCallback(() => {
    setShowConfirmationDialog(false);
    handleDiscard();
  }, [handleDiscard]);

  const handleTranscriptChange = useCallback((newText: string) => {
    setTranscriptText(newText);
    if (isPaused) {
      setEditedWhilePaused(true);
    }
  }, [isPaused]);

  const handleTreatmentTextChange = useCallback((newText: string) => {
    setTreatmentText(newText);
    
    // Sync treatment changes back to SOAP plan (debounced)
    const timeoutId = setTimeout(() => {
      setSoapNote(prev => prev ? { ...prev, plan: newText } : null);
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, []);

  const handleGenerateTreatments = useCallback(async () => {
    if (!encounter?.id || !diagnosisText) {
      toast({
        title: "Cannot generate treatments",
        description: "Please ensure diagnosis is completed first",
        variant: "destructive"
      });
      return;
    }

    try {
      // Get patient data for treatment generation
      const patientData = {
        patient: {
          firstName: patient.firstName,
          lastName: patient.lastName,
          age: 45, // TODO: Get from patient data when available
          gender: patient.gender || 'unknown'
        },
        conditions: [], // Could be populated from patient history
        treatments: treatmentText ? [treatmentText] : []
      };

      // Create diagnosis object
      const diagnosis = {
        diagnosisName: diagnosisText,
        confidence: 0.9,
        supportingEvidence: ["Clinical assessment completed"],
        reasoningExplanation: "Based on consultation findings"
      };

      // Call the treatments API
      const response = await fetch('/api/clinical-engine/treatments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientData,
          diagnosis,
          transcript: transcriptText
        })
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success && result.treatments) {
        // Create rich content from the API result
        const richContent = {
          content_type: 'text/markdown' as const,
          text_content: generateTreatmentTextContent(result.treatments),
          rich_elements: result.treatments.decisionTree ? [{
            id: 'decision_tree_1',
            type: 'decision_tree' as const,
            data: result.treatments.decisionTree,
            position: 1,
            editable: false
          }] : [],
          created_at: new Date().toISOString(),
          version: '1.0'
        };

        // Save the rich content
        await treatmentRichContent.saveContent(richContent);
        
        toast({
          title: "Treatment plan generated",
          description: "Structured treatment plan with decision trees created successfully"
        });
      }
    } catch (error) {
      console.error('Error generating treatments:', error);
      toast({
        title: "Error generating treatments",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    }
  }, [encounter?.id, diagnosisText, patient, treatmentText, transcriptText, treatmentRichContent.saveContent, toast]);

  // Helper function to generate text content from treatment data
  const generateTreatmentTextContent = (treatments: any) => {
    let content = '# Treatment Plan\n\n';
    
    if (treatments.treatments?.length) {
      content += '## Recommended Treatments\n\n';
      treatments.treatments.forEach((treatment: any, index: number) => {
        content += `### ${treatment.medication || `Treatment ${index + 1}`}\n`;
        content += `- **Dosage:** ${treatment.dosage || 'As prescribed'}\n`;
        content += `- **Duration:** ${treatment.duration || 'As needed'}\n`;
        content += `- **Rationale:** ${treatment.rationale || 'Clinical indication'}\n`;
        if (treatment.monitoring) {
          content += `- **Monitoring:** ${treatment.monitoring}\n`;
        }
        if (treatment.guidelines_reference) {
          content += `- **Guidelines:** ${treatment.guidelines_reference}\n`;
        }
        content += '\n';
      });
    }

    if (treatments.nonPharmacologicalTreatments?.length) {
      content += '## Non-Pharmacological Treatments\n\n';
      treatments.nonPharmacologicalTreatments.forEach((treatment: string) => {
        content += `- ${treatment}\n`;
      });
      content += '\n';
    }

    if (treatments.followUpPlan) {
      content += '## Follow-up Plan\n\n';
      content += `**Timeline:** ${treatments.followUpPlan.timeline || 'As clinically indicated'}\n\n`;
      if (treatments.followUpPlan.parameters?.length) {
        content += `**Monitoring Parameters:**\n`;
        treatments.followUpPlan.parameters.forEach((param: string) => {
          content += `- ${param}\n`;
        });
      }
    }

    return content;
  };

  const pauseTranscription = useCallback(() => {
    console.log("ConsultationPanel pauseTranscription called - current states:", { isTranscribing, isPaused });
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      console.log("ConsultationPanel: Transcription paused - mediaRecorder paused, isPaused set to true");
    } else {
      console.log("ConsultationPanel pauseTranscription: mediaRecorder not in recording state:", mediaRecorderRef.current?.state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTranscribing, isPaused]); // realTimeAlerts intentionally excluded to prevent dependency loops

  const resumeTranscription = useCallback(() => {
    console.log("ConsultationPanel resumeTranscription called - current states:", { isTranscribing, isPaused });
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      setIsTranscribing(true); // Ensure we're in transcribing state
      console.log("ConsultationPanel: Transcription resumed - mediaRecorder resumed, isPaused set to false, isTranscribing set to true");
    } else {
      console.log("ConsultationPanel resumeTranscription: mediaRecorder not in paused state:", mediaRecorderRef.current?.state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTranscribing, isPaused]); // realTimeAlerts intentionally excluded to prevent dependency loops

  // CRITICAL PATTERN: Stable callback for child components
  // No dependencies prevents re-renders that could break transcription
  const handleAudioWaveformStop = useCallback(() => {
    cleanupAllAudioResources();
  }, [cleanupAllAudioResources]);

  const startVoiceInput = useCallback(async () => {
    console.log("ConsultationPanel startVoiceInput called - current states:", { isTranscribing: isTranscribingRef.current, isPaused: isPausedRef.current });
    if (isTranscribingRef.current) {
      console.log("ConsultationPanel startVoiceInput: Already transcribing, returning early");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isOpen) return stream.getTracks().forEach(track => track.stop());

      // CRITICAL: Store the original stream for complete cleanup
      originalStreamRef.current = stream;
      audioStreamRef.current = stream; // Store the original stream for waveform
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const mediaRecorder = mediaRecorderRef.current;
      
      // Enhanced Deepgram WebSocket URL with better silence handling and speech detection
      const wsUrl = 'wss://api.deepgram.com/v1/listen?' + new URLSearchParams({
        model: 'nova-3-medical',
        punctuate: 'true',
        interim_results: 'true',
        smart_format: 'true',
        diarize: 'true',
        utterance_end_ms: '3000', // Detect utterance end after 3 seconds of silence
        endpointing: 'false', // Disable automatic endpointing to prevent premature closures
        vad_events: 'true' // Enable voice activity detection events
      }).toString();
      
      const ws = await openDeepgramSocket(wsUrl);
      socketRef.current = ws;

      // KeepAlive mechanism to prevent connection timeouts during silence
      let keepAliveInterval: NodeJS.Timeout | null = null;

      ws.onopen = () => {
        console.log("ConsultationPanel: WebSocket opened successfully");
        
        // Start KeepAlive messages every 5 seconds to prevent 10-second timeout
        keepAliveInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "KeepAlive" }));
            console.log("ConsultationPanel: Sent KeepAlive message");
          }
        }, 5000);

        mediaRecorder.addEventListener('dataavailable', event => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(event.data);
        });
        mediaRecorder.start(250);
        setIsTranscribingAndRef(true);
        setIsPaused(false); // Always reset paused state when starting new transcription
        console.log("ConsultationPanel: Transcription started - isTranscribing set to true, isPaused set to false");
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          
          // Handle UtteranceEnd events
          if (data.type === 'UtteranceEnd') {
            console.log("ConsultationPanel: Received UtteranceEnd event", data);
            return;
          }

          // Handle speech events
          if (data.type === 'SpeechStarted') {
            console.log("ConsultationPanel: Speech detected");
            return;
          }

          // Handle transcription results
          if (data && data.channel && data.is_final && data.channel.alternatives[0]?.transcript) {
            const chunk = data.channel.alternatives[0].transcript.trim();
            if (chunk) {
              const speaker = data.channel.alternatives[0]?.words?.[0]?.speaker ?? null;
              
              setTranscriptText(prevText => {
                let textToAdd = chunk;
                
                // Add speaker label if available and appropriate
                if (speaker !== null && speaker !== undefined) {
                  const lines = prevText.split('\n');
                  const lastLine = lines[lines.length - 1] || '';
                  
                  // Add speaker label if starting fresh or speaker changed
                  if (!lastLine.includes('Speaker ') || !lastLine.startsWith(`Speaker ${speaker}:`)) {
                    textToAdd = (prevText ? '\n' : '') + `Speaker ${speaker}: ` + chunk;
                  } else {
                    textToAdd = ' ' + chunk;
                  }
                } else {
                  // No speaker info, just add appropriate spacing
                  textToAdd = (prevText ? ' ' : '') + chunk;
                }
                
                const updatedText = prevText + textToAdd;
                
                // Auto-scroll to bottom after content update
                setTimeout(() => {
                  if (transcriptEditorRef.current?.editor) {
                    transcriptEditorRef.current.editor.commands.focus('end');
                  }
                }, 100);
                
                return updatedText;
              });
            }
          }
        } catch (error) {
          console.warn('[ConsultationPanel] Error processing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('[ConsultationPanel] WebSocket closed:', event.code, event.reason);
        
        // Clear KeepAlive interval
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }

        // Only attempt reconnection if the transcription is still supposed to be active
        // and it wasn't a user-initiated close (code 1000) or going away (code 1001)
        if (transcriptionActiveRef.current && !isPausedRef.current && event.code !== 1000 && event.code !== 1001) {
          console.log('[ConsultationPanel] Connection lost unexpectedly, attempting reconnection...');
          
          // Wait a short time before reconnecting to avoid rapid reconnection loops
          setTimeout(() => {
            if (transcriptionActiveRef.current && !isPausedRef.current && isOpen) {
              console.log('[ConsultationPanel] Attempting automatic reconnection...');
              startVoiceInput(); // Recursive call to restart transcription
            }
          }, 2000);
        } else {
          cleanupAllAudioResources();
        }
      };
      
      ws.onerror = (error) => {
        console.error('[ConsultationPanel] WebSocket error:', error);
        
        // Clear KeepAlive interval
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }

        toast({ title: "Error", description: "Transcription service error.", variant: "destructive" });
        cleanupAllAudioResources();
      };
    } catch (err) {
      cleanupAllAudioResources();
      if (err instanceof TranscriptionUnavailableError) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      } else {
        toast({ title: "Microphone Error", description: "Could not access microphone.", variant: "destructive" });
      }
    }
  }, [isOpen, toast, cleanupAllAudioResources]);

  // Store startVoiceInput function in ref for auto-start functionality
  startVoiceInputRef.current = startVoiceInput;

  const createEncounter = useCallback(async () => {
    if (!patient?.id || isCurrentlyCreatingEncounter.current) return;
    isCurrentlyCreatingEncounter.current = true;
    setIsCreating(true);
    try {
      const newEncounter = await supabaseDataService.createNewEncounter(patient.id, {});
      setEncounter(newEncounter);
      onConsultationCreated?.(newEncounter);
    } catch (error) {
      toast({ title: "Error", description: `Failed to create consultation: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
      finalizeAndClose();
    } finally {
      setIsCreating(false);
      isCurrentlyCreatingEncounter.current = false;
    }
  }, [patient?.id, onConsultationCreated, finalizeAndClose, toast]);

  const handleClinicalPlan = useCallback(async () => {
    setIsGeneratingPlan(true);
    setIsLoadingDifferentials(true);
    setIsGeneratingSoap(true);
    
    try {
      // Step 1: Generate differential diagnoses first
      const differentialsResponse = await fetch('/api/clinical-engine/differential-diagnoses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          patientId: patient.id, 
          encounterId: encounter?.id, 
          transcript: transcriptText 
        }),
      });
      
      if (differentialsResponse.ok) {
        const differentialsResult = await differentialsResponse.json();
        setDifferentialDiagnoses(differentialsResult.differentialDiagnoses || []);
        setIsLoadingDifferentials(false);
        setPlanGenerated(true);
        setActiveTab('differentials');
      }

      // Step 2: Generate full clinical plan (including final diagnosis)
      const response = await fetch('/api/clinical-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: patient.id, encounterId: encounter?.id, transcript: transcriptText }),
      });
      
      if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
      const result = await response.json();
      
      // Update differential diagnoses from full result if available
      if (result.diagnosticResult?.differentialDiagnoses) {
        setDifferentialDiagnoses(result.diagnosticResult.differentialDiagnoses);
      }
      
      setDiagnosisText(result.diagnosticResult?.diagnosisName || '');
      setTreatmentText(result.diagnosticResult?.recommendedTreatments?.join('\n') || '');
      
      // Set SOAP note from the result if available
      if (result.soapNote) {
        setSoapNote(result.soapNote);
        setIsGeneratingSoap(false);
      }
      
      // Switch to diagnosis tab once everything is complete
      setActiveTab('diagnosis');
    } catch (error) {
      toast({ title: "Plan Generation Failed", variant: "destructive" });
      setIsLoadingDifferentials(false);
      setIsGeneratingSoap(false);
    } finally {
      setIsGeneratingPlan(false);
    }
  }, [toast, patient.id, encounter?.id, transcriptText]);

  const handleSoapNoteChange = useCallback((section: keyof SoapNote, content: string) => {
    setSoapNote(prev => prev ? { ...prev, [section]: content } : null);
    
    // Debounced synchronization with other tabs
    const timeoutId = setTimeout(() => {
      if (section === 'assessment') {
        // Note: Bi-directional sync with differentials would be implemented here
        // For now, SOAP assessment is considered the source of truth when edited
      } else if (section === 'plan') {
        // Sync plan changes to treatment tab
        setTreatmentText(content);
      }
    }, 500); // 500ms debounce to prevent excessive updates
    
    return () => clearTimeout(timeoutId);
  }, []);

  // --- EFFECT HOOKS ---

  useEffect(() => {
    if (planGenerated) {
      const timer = setTimeout(() => setTabBarVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setTabBarVisible(false);
    }
  }, [planGenerated]);

  // Initialize modal state when opened - stable effect with minimal dependencies
  useEffect(() => {
    if (!isOpen) {
      // Cleanup when modal closes
      if (mounted && started) {
        setStarted(false);
        autoStartSessionRef.current = false;
        console.log('[ConsultationPanel] Modal closed, autoStartSessionRef reset');
      }
      return;
    }
    
    // Modal is opening - reset or set state based on whether we have a selected encounter
    if (selectedEncounter) {
      // Use existing encounter
      setEncounter(selectedEncounter);
      setReason(selectedEncounter.reasonDisplayText || selectedEncounter.reasonCode || '');
      setScheduledDate(selectedEncounter.scheduledStart ? new Date(selectedEncounter.scheduledStart) : new Date());
      setDuration(30); // Default duration
      setTranscriptText(selectedEncounter.transcript || '');
      setStarted(true); // Mark as started since we have an existing encounter
      console.log('[ConsultationPanel] Modal opened with existing encounter:', selectedEncounter.id);
    } else {
      // Creating new encounter - reset state
      setEncounter(null);
      setReason('');
      setScheduledDate(new Date());
      setDuration(30);
      setTranscriptText('');
      setStarted(false);
      console.log('[ConsultationPanel] Modal opened for new consultation');
    }
    
    // Common state resets
    setActiveTab('transcript');
    setTabBarVisible(false);
    setIsGeneratingPlan(false);
    setIsGeneratingSoap(false);
    setIsLoadingDifferentials(false);
    setShowConfirmationDialog(false);
    setEditedWhilePaused(false);
    autoStartSessionRef.current = false;
    
    // Handle demo mode initialization
    if (isDemoMode) {
      setTranscriptText(initialDemoTranscript || '');
      setDiagnosisText(demoDiagnosis || '');
      // For demo mode, we use rich content directly, not the treatmentText state
      setTreatmentText(''); // Clear text since we use rich content
      setDifferentialDiagnoses(demoDifferentialDiagnoses || []);
      setSoapNote(demoSoapNote || null);
      setPlanGenerated(!!(demoDiagnosis || demoTreatment || demoDifferentialDiagnoses));
      setStarted(true);
      
      // Start real-time alerts session for demo mode
      if (!shouldStartAlertsRef.current && patient?.id) {
        shouldStartAlertsRef.current = true;
        // Reset demo alerts when starting a new demo consultation
        setDemoAlertToasts([]);
        import('@/services/demo/DemoAlertsService').then(({ demoAlertsService }) => {
          demoAlertsService.resetAlerts();
        });
        try {
          realTimeAlerts.startSession();
        } catch (error) {
          console.warn('[ConsultationPanel] Failed to start demo real-time alerts:', error);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedEncounter]); // Include selectedEncounter dependency

  // Auto-start transcription when requested
  useEffect(() => {
    if (isOpen && autoStartTranscription && selectedEncounter && encounter && started && !isTranscribing && !autoStartSessionRef.current) {
      console.log('[ConsultationPanel] Auto-starting transcription for existing encounter:', selectedEncounter.id);
      autoStartSessionRef.current = true;
      
      // Small delay to ensure the modal is fully rendered
      const timer = setTimeout(() => {
        if (startVoiceInputRef.current) {
          startVoiceInputRef.current()
            .then(() => {
              console.log('[ConsultationPanel] Auto-start transcription successful');
            })
            .catch((error) => {
              console.error('[ConsultationPanel] Auto-start transcription failed:', error);
              toast({ 
                title: "Auto-start Failed", 
                description: "Could not automatically start transcription. You can start it manually.", 
                variant: "destructive" 
              });
            });
        }
      }, 1000); // 1 second delay to ensure full initialization
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoStartTranscription, selectedEncounter, encounter, started, isTranscribing, toast]);
  
  // Update demo content when props change (for animated transcript) - split into separate effects to prevent loops
  useEffect(() => {
    if (!isDemoMode || !isOpen) return;
    
    // Only update transcript if it has actually changed
    if (initialDemoTranscript !== undefined && initialDemoTranscript !== transcriptText) {
      setTranscriptText(initialDemoTranscript);
    }
  }, [isDemoMode, isOpen, initialDemoTranscript]); // Remove transcriptText from dependencies to prevent loops

  useEffect(() => {
    if (!isDemoMode || !isOpen) return;
    
    // Update other demo content only when they actually change
    if (demoDiagnosis !== undefined && demoDiagnosis !== diagnosisText) {
      setDiagnosisText(demoDiagnosis);
    }
    
    // Note: demoTreatment is now RichContent, handled directly by treatmentRichContent hook
    // No need to update treatmentText state for demo mode
    
    if (demoDifferentialDiagnoses !== undefined) {
      setDifferentialDiagnoses(demoDifferentialDiagnoses);
    }
    
    if (demoSoapNote !== undefined) {
      setSoapNote(demoSoapNote);
    }
    
    // Update plan generation state
    setPlanGenerated(!!(demoDiagnosis || demoTreatment || demoDifferentialDiagnoses));
  }, [isDemoMode, isOpen, demoDiagnosis, demoTreatment, demoDifferentialDiagnoses, demoSoapNote]); // Remove state variables from dependencies
  
  // Create encounter for non-demo mode - separate effect with stable dependencies
  useEffect(() => {
    if (!isDemoMode && isOpen && !encounter && !isCreating && mounted) {
      createEncounter();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode, isOpen, mounted, createEncounter]); // encounter/isCreating are state managed by this effect
  
  // Auto-start transcription for non-demo mode when encounter is ready
  useEffect(() => {
    if (isDemoMode || !isOpen || !encounter || !mounted) return;
    if (started || isTranscribingRef.current || autoStartSessionRef.current) return;
    
    const encounterId = encounter.id;
    if (autoStartAttemptedRef.current.has(encounterId)) {
      console.log('[ConsultationPanel] Auto-start already attempted for encounter:', encounterId);
      setStarted(true);
      return;
    }
    
    console.log('[ConsultationPanel] Scheduling auto-start of transcription for encounter:', encounterId);
    autoStartAttemptedRef.current.add(encounterId);
    autoStartSessionRef.current = true;
    
    // Clear any existing timeout
    if (autoStartTimeoutRef.current) {
      clearTimeout(autoStartTimeoutRef.current);
    }
    
    // Use setTimeout to break out of the render cycle
    autoStartTimeoutRef.current = setTimeout(async () => {
      console.log('[ConsultationPanel] Auto-start timeout executing - checking conditions:', {
        isOpen,
        mounted,
        isTranscribingRef: isTranscribingRef.current,
        autoStartSessionRef: autoStartSessionRef.current
      });
      
      if (!isOpen || !mounted) {
        console.log('[ConsultationPanel] Auto-start cancelled: modal not open or not mounted');
        return;
      }
      
      console.log('[ConsultationPanel] Attempting auto-start of transcription');
      try {
        if (isTranscribingRef.current) {
          console.log('[ConsultationPanel] Already transcribing, skipping auto-start');
          setStarted(true);
          return;
        }
        
        console.log('[ConsultationPanel] Starting voice input...');
        // Call startVoiceInput directly
        await startVoiceInput();
        setStarted(true);
        
        // Start real-time alerts session when transcription starts
        if (!shouldStartAlertsRef.current && patient?.id && encounter?.id) {
          shouldStartAlertsRef.current = true;
          try {
            realTimeAlerts.startSession();
          } catch (error) {
            console.warn('[ConsultationPanel] Failed to start real-time alerts:', error);
          }
        }
        
        console.log('[ConsultationPanel] Auto-start transcription successful');
      } catch (error) {
        console.error('[ConsultationPanel] Auto-start transcription failed:', error);
        toast({ title: "Auto-start Failed", description: "Could not automatically start transcription.", variant: "destructive" });
        setStarted(true); // Set started to true to prevent infinite retry
      }
    }, 200); // Slightly longer delay for stability
    
    // Cleanup timeout on unmount
    return () => {
      if (autoStartTimeoutRef.current) {
        clearTimeout(autoStartTimeoutRef.current);
        autoStartTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode, isOpen, encounter?.id, mounted, startVoiceInput, toast, patient?.id, realTimeAlerts]); // started is managed by this effect
  
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isDemoMode || (isDemoMode && !demoState.isDemoModalOpen)) {
          handleCloseRequest();
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleCloseRequest, isDemoMode, demoState.isDemoModalOpen]);
  
  useEffect(() => {
    if (!mounted) return;
    const handleVisibilityChange = () => {
      if (document.hidden && isTranscribingRef.current && !isPausedRef.current) {
        pauseTranscription();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [mounted, pauseTranscription]);

  // CRITICAL CLEANUP EFFECT: Only depends on isOpen to prevent race conditions
  // This was the key fix - dependency on stopTranscription was causing immediate cleanup
  useEffect(() => {
    // Only set up cleanup when modal is truly closing (isOpen becomes false)
    if (isOpen) return;
    
    // When modal closes, ensure transcription is stopped
    if (transcriptionActiveRef.current) {
      console.log('[ConsultationPanel] Modal closing: Stopping active transcription');
      cleanupAllAudioResources();
    }
  }, [isOpen, cleanupAllAudioResources]);

  useEffect(() => {
    return () => {
      // On unmount always persist latest text
      if (transcriptText) {
        saveConsultationDraft(draftId, { transcriptText });
      }
    };
  }, [draftId, transcriptText]);

  // Always call useMemo - even if not draggable (React hooks rule)
  // MUST be called before any conditional returns
  const mergedDraggableConfig = useMemo(() => {
    if (!draggableConfig || !draggable) return undefined;
    return {
      id: draggableConfig.id || `consultation-panel-${patient.id}`,
      title: draggableConfig.title || "New Consultation",
      persistent: draggableConfig.persistent ?? true,
      defaultPosition: draggableConfig.defaultPosition,
      icon: draggableConfig.icon,
    };
  }, [
    draggableConfig?.id, 
    draggableConfig?.title, 
    draggableConfig?.persistent,
    draggableConfig?.icon,
    patient.id, 
    draggable
    // Note: Not including defaultPosition since it can contain unstable window calculations
  ]);

  // --- Transcript auto-scroll state --
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);
  const userHasScrolledUpRef = useRef(false);
  const SCROLL_THRESHOLD = 20; // px considered "at bottom"

  // Keep ref in sync with state to avoid stale closures
  useEffect(() => {
    userHasScrolledUpRef.current = userHasScrolledUp;
  }, [userHasScrolledUp]);

  // Attach scroll listener once to detect manual scrolls
  useEffect(() => {
    const el = transcriptScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;
      setUserHasScrolledUp(distanceToBottom > SCROLL_THRESHOLD);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Auto-scroll when new transcript content arrives (unless user scrolled up)
  useEffect(() => {
    const el = transcriptScrollRef.current;
    if (!el) return;

    if (!userHasScrolledUpRef.current) {
      // Use rAF for smoother feel; smooth behaviour emulates gentle scroll
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      });
    }
  }, [transcriptText]);

  if (!mounted || !isOpen) return null;

  const modalContent = (
    <>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border px-6 pb-3 pt-2 text-sm">
        <span className="font-display text-lg text-ink">{patient.name || `${patient.firstName} ${patient.lastName}`}</span>
        {!isDemoMode && encounter?.id ? <span className="data-mono text-xs text-muted-foreground">{encounter.id}</span> : null}
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        {(!encounter && !isCreating && !isDemoMode) ? (
          <div className="flex items-center justify-center flex-1">
            <p className="text-muted-foreground">Failed to create consultation</p>
          </div>
        ) : (
          <>
            {planGenerated && (
              <div className={cn("border-b border-border/50 transition-all", tabBarVisible ? "opacity-100" : "opacity-0")}>
                <div className="flex gap-1 overflow-x-auto px-4">
                  {['transcript', 'differentials', 'diagnosis', 'treatment'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                        activeTab === tab
                          ? "border-ink text-ink"
                          : "border-transparent text-muted-foreground hover:text-ink"
                      )}
                    >
                      {tab === 'differentials' ? 'Differentials' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex-1 overflow-hidden p-4 flex flex-col min-h-0">
              {started ? (
                <>
                  {(!planGenerated || activeTab === 'transcript') && (
                    <div className={`flex-1 min-h-0 flex flex-col gap-4 ${(isGeneratingSoap || isGeneratingPlan || isDemoGeneratingPlan || !!soapNote) ? 'lg:flex-row' : ''}`}>
                      {/* Transcript Panel */}
                      <div className="flex-1 flex flex-col space-y-4 min-h-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-display text-lg text-ink">Consultation Transcript</h3>
                          <div className="flex flex-wrap items-center gap-2">
                            {!isDemoMode && !isTranscribing ? (
                              <TranscriptModeToggle mode={transcriptMode} onChange={setTranscriptMode} />
                            ) : null}
                            {/* Real-time Alerts Button */}
                            {started && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowRealTimeAlerts(!showRealTimeAlerts)}
                                className="h-8 w-8 hover:bg-muted transition-all relative"
                                title={isDemoMode ? `Demo alerts ${demoAlertToasts.length > 0 ? 'triggered' : 'ready'}` : `Real-time alerts ${realTimeAlerts.isSessionActive ? 'active' : 'inactive'}`}
                              >
                                <Bell className={cn(
                                  "h-4 w-4", 
                                  isDemoMode 
                                    ? (demoAlertToasts.length > 0 ? "text-flag" : "text-ok")
                                    : (realTimeAlerts.isSessionActive ? "text-ok" : "text-muted-foreground")
                                )} />
                                {(alertToasts.length > 0 || (isDemoMode && demoAlertToasts.length > 0)) && (
                                  <div className="absolute -top-1 -right-1 h-3 w-3 bg-critical rounded-full text-[8px] text-white flex items-center justify-center">
                                    {isDemoMode ? demoAlertToasts.length : alertToasts.length}
                                  </div>
                                )}
                              </Button>
                            )}
                            
                            {/* Save Icon Button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={handleSaveAndClose}
                              disabled={isSaving}
                              className="h-8 w-8 hover:bg-muted transition-all"
                              title="Save consultation"
                            >
                              {isSaving ? (
                                <CircleNotch className="h-4 w-4 animate-spin" />
                              ) : (
                                <FloppyDisk className="h-4 w-4" />
                              )}
                            </Button>
                            {!(isDemoMode && planGenerated) && (
                              <Button
                                variant={(isGeneratingPlan || isDemoGeneratingPlan) ? "secondary" : "default"}
                                onClick={isDemoMode ? onDemoClinicalPlanClick : handleClinicalPlan}
                                disabled={isGeneratingPlan || isDemoGeneratingPlan || transcriptText.length < 10}
                                className="gap-2"
                              >
                                {(isGeneratingPlan || isDemoGeneratingPlan) ? <><CircleNotch className="h-4 w-4 animate-spin" /> Analyzing...</> : <><Brain className="h-4 w-4" /> Clinical Plan</>}
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="relative flex-1 min-h-0 overflow-hidden">
                          {isDemoMode || isTranscribing || transcriptMode === 'conversation' ? (
                            <TranscriptView
                              className="h-full max-h-[min(58vh,40rem)] pb-16"
                              transcript={transcriptText}
                              live={isDemoMode ? !planGenerated : isTranscribing}
                              followNewest
                              emptyText="Transcription will appear here..."
                            />
                          ) : (
                          <div
                            ref={transcriptScrollRef}
                            className="h-full overflow-y-auto relative pr-2 pb-24"
                          >
                            <RichTextEditor
                              ref={transcriptEditorRef}
                              content={transcriptText}
                              onContentChange={handleTranscriptChange}
                              placeholder="Transcription will appear here..."
                              disabled={isDemoMode}
                              showToolbar={!isDemoMode}
                              minHeight="100px"
                              className=""
                            />
                          </div>
                          )}
                          {/* Always render pillbox container; AudioWaveform itself controls content visibility */}
                          {!isDemoMode && (
                            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
                              <AudioWaveform
                                isRecording={isTranscribing}
                                isPaused={isPaused}
                                mediaStream={audioStreamRef.current}
                                onPause={pauseTranscription}
                                onResume={resumeTranscription}
                                onStop={handleAudioWaveformStop}
                              />
                            </div>
                          )}
                          {isDemoMode && (
                            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
                              <DemoAudioWaveform />
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* SOAP Notes Panel - Only show when clinical engine is running */}
                      {(isGeneratingSoap || isGeneratingPlan || isDemoGeneratingPlan || !!soapNote) && (
                        <div className="flex-1 min-h-0">
                          <SOAPNotesPanel
                            soapNote={soapNote}
                            isDemoMode={isDemoMode}
                            isGenerating={isGeneratingSoap}
                            isVisible={true}
                            onSoapNoteChange={handleSoapNoteChange}
                            className="h-full"
                          />
                        </div>
                      )}
                    </div>
                  )}
                  {planGenerated && activeTab === 'differentials' && (
                    <DifferentialDiagnosesList
                      diagnoses={differentialDiagnoses}
                      isLoading={isLoadingDifferentials}
                      isEditable={!isDemoMode}
                      className="flex-1 min-h-0"
                    />
                  )}
                  {planGenerated && activeTab === 'diagnosis' && (
                    <div className="flex-1 flex flex-col space-y-4 min-h-0">
                      {diagnosisRichContent.content ? (
                        <RichTreatmentEditor
                          content={diagnosisRichContent.content}
                          onSave={diagnosisRichContent.saveContent}
                          isDemo={isDemoMode}
                          label={isDemoMode ? "" : "Diagnosis"}
                        />
                      ) : diagnosisRichContent.isLoading ? (
                        <div className="flex items-center justify-center flex-1">
                          <CircleNotch className="h-6 w-6 animate-spin text-muted-foreground" />
                          <span className="ml-2 text-muted-foreground">Loading diagnosis...</span>
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col space-y-4 min-h-0">
                          <h3 className="text-lg font-medium">Diagnosis</h3>
                          <RichTextEditor 
                            content={diagnosisText} 
                            onContentChange={setDiagnosisText} 
                            placeholder="Enter diagnosis..." 
                            disabled={isDemoMode} 
                            showToolbar={!isDemoMode} 
                            minHeight="300px" 
                            className="flex-1" 
                          />
                        </div>
                      )}
                    </div>
                  )}
                  {planGenerated && activeTab === 'treatment' && (
                    <div className="flex-1 flex flex-col space-y-4 min-h-0">
                      {treatmentRichContent.content ? (
                        <RichTreatmentEditor
                          content={treatmentRichContent.content}
                          onSave={treatmentRichContent.saveContent}
                          isDemo={isDemoMode}
                          label="Treatment Plan"
                        />
                      ) : treatmentRichContent.isLoading ? (
                        <div className="flex items-center justify-center flex-1">
                          <CircleNotch className="h-6 w-6 animate-spin text-muted-foreground" />
                          <span className="ml-2 text-muted-foreground">Loading treatment plan...</span>
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col space-y-4 min-h-0">
                                                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                              <h3 className="text-base sm:text-lg font-medium">Treatment Plan</h3>
                              {!isDemoMode && encounter?.id && (
                                <button
                                  onClick={() => handleGenerateTreatments()}
                                  className="px-3 py-1.5 bg-info-soft text-info rounded-md text-sm hover:bg-info-soft transition-colors touch-manipulation whitespace-nowrap self-start sm:self-auto"
                                >
                                  Generate Structured Plan
                                </button>
                              )}
                            </div>
                          <RichTextEditor 
                            content={treatmentText} 
                            onContentChange={handleTreatmentTextChange} 
                            placeholder="Enter treatment plan..." 
                            disabled={isDemoMode} 
                            showToolbar={!isDemoMode} 
                            minHeight="300px" 
                            className="flex-1" 
                          />
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">Setting up consultation...</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );

  const panelContent = draggable && mergedDraggableConfig ? (
    <DraggableModalWrapper
      onClose={handleCloseRequest}
      config={mergedDraggableConfig}
      allowDragging={allowDragging}
      className="w-[95%] max-w-6xl max-h-[calc(100svh-9rem)]"
      showCloseButton={!isSaving}
    >
      {modalContent}
    </DraggableModalWrapper>
  ) : (
    <div 
      className="fixed inset-0 z-[9999] glass-backdrop flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && handleCloseRequest()}
    >
      <div className="glass-dense rounded-2xl shadow-2xl relative w-[95%] max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <Button 
          variant="ghost" 
          size="icon"
          className="absolute top-4 right-4 h-8 w-8 hover:bg-destructive/20 z-10"
          onClick={handleCloseRequest}
          disabled={isSaving}
        >
          <X className="h-4 w-4" />
        </Button>
        <div className="pt-8">
          <h2 className="px-6 pb-2 font-display text-2xl">New Consultation</h2>
          {modalContent}
        </div>
      </div>
    </div>
  );

  return createPortal(
    <>
      {panelContent}
      
      {/* Real-time Alert Toasts */}
      {!isDemoMode && alertToasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[10001] space-y-2 pointer-events-none">
          {alertToasts.map((alert) => (
            <div key={alert.id} className="pointer-events-auto">
              <AlertToast
                alert={alert}
                onClose={() => removeAlertToast(alert.id)}
                duration={8000}
              />
            </div>
          ))}
        </div>
      )}
      
      {/* Demo Alert Toasts */}
      {isDemoMode && demoAlertToasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[10001] space-y-2 pointer-events-none">
          {demoAlertToasts.map((alert) => (
            <div key={alert.id} className="pointer-events-auto">
              <AlertToast
                alert={alert}
                onClose={() => removeDemoAlertToast(alert.id)}
                duration={12000}
              />
            </div>
          ))}
        </div>
      )}
      
      {showConfirmationDialog && (
                  <div className="fixed inset-0 z-[10000] modal-overlay flex items-center justify-center p-4">
            <div className="modal-glass rounded-lg shadow-lg p-6 max-w-md w-full">
            {(() => {
              const isActivelyTranscribing = transcriptionActiveRef.current || isTranscribing || isPaused;
              const hasTranscriptContent = transcriptText.trim();
              
              if (isActivelyTranscribing && hasTranscriptContent) {
                return (
                  <>
                    <h3 className="text-lg font-semibold mb-4">Stop transcription and save content?</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Transcription is currently {isPaused ? 'paused' : 'running'} and you have transcript content. 
                      Closing will stop the transcription. Would you like to save your content before closing?
                    </p>
                  </>
                );
              } else if (isActivelyTranscribing && !hasTranscriptContent) {
                return (
                  <>
                    <h3 className="text-lg font-semibold mb-4">Stop transcription?</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Transcription is currently {isPaused ? 'paused' : 'running'} but no content has been recorded yet. 
                      Closing will stop the transcription.
                    </p>
                  </>
                );
              } else {
                return (
                  <>
                    <h3 className="text-lg font-semibold mb-4">Save transcript content?</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      You have transcript content that will be lost if you don&apos;t save it. What would you like to do?
                    </p>
                  </>
                );
              }
            })()}
            <div className="flex justify-end gap-2">
              <Button variant="destructive" onClick={handleConfirmDiscard}>
                {(() => {
                  const isActivelyTranscribing = transcriptionActiveRef.current || isTranscribing || isPaused;
                  return isActivelyTranscribing ? 'Stop & Discard' : 'Delete';
                })()}
              </Button>
              <Button variant="default" onClick={handleConfirmSave}>
                {(() => {
                  const isActivelyTranscribing = transcriptionActiveRef.current || isTranscribing || isPaused;
                  return isActivelyTranscribing ? 'Stop & Save' : 'Save';
                })()}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
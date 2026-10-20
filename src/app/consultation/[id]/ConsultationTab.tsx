'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea'; // Assuming Textarea was used, or a contentEditable div
import { RichTextEditor, RichTextEditorRef } from '@/components/ui/rich-text-editor';
import { FloppyDisk as Save, PauseCircle, PlayCircle } from '@phosphor-icons/react';
import { AudioWaveform } from '@/components/ui/AudioWaveform';
import { openDeepgramSocket } from '@/lib/deepgram';
import { getSupabaseClient } from '@/lib/supabaseClient'; // Corrected import path
import { Encounter, Patient, ClinicalOutputPackage, DifferentialDiagnosis } from '@/lib/types'; // Renamed Admission to Encounter
import { supabaseDataService } from '@/lib/supabaseDataService'; // Import supabaseDataService
import AIAnalysisPanel from '@/components/AIAnalysisPanel'; // Ensure this is the correct path
import { RealtimeChannel } from '@supabase/supabase-js';
import { useToast } from "@/hooks/use-toast"; // Corrected: import useToast hook
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

function useDebouncedCallback(callback: (...args: any[]) => void, delay: number): (...args: any[]) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  };
}

interface ConsultationTabProps {
  selectedEncounter: Encounter | null;
  patientName?: string; // Made optional as it might not always be directly passed if patient object is available
  patient: Patient | null;
  // Props for new consultation UI, passed from PatientWorkspaceViewModern
  isStartingNewConsultation?: boolean;
  newConsultationReason?: string;
  onNewConsultationReasonChange?: (reason: string) => void;
  newConsultationDate?: Date | null;
  onNewConsultationDateChange?: (date: Date | null) => void;
  newConsultationDuration?: number | null;
  onNewConsultationDurationChange?: (duration: number | null) => void;
  onStartTranscriptionForNewConsult?: () => Promise<Encounter | null>; // Callback when starting transcription for a new (just created) consult
}

const ConsultationTab: React.FC<ConsultationTabProps> = ({ 
  selectedEncounter, 
  patientName, 
  patient, 
  isStartingNewConsultation,
  newConsultationReason,
  onNewConsultationReasonChange,
  newConsultationDate,
  onNewConsultationDateChange,
  newConsultationDuration,
  onNewConsultationDurationChange,
  onStartTranscriptionForNewConsult
}) => {
  const supabase = getSupabaseClient(); // Initialize supabase client
  const { toast } = useToast(); // Corrected: call useToast hook to get the toast function
  const [isLoading, setIsLoading] = useState(true);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const [editableTranscript, setEditableTranscript] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [lastSavedTranscript, setLastSavedTranscript] = useState<string>('');
  const [transcriptChanged, setTranscriptChanged] = useState<boolean>(false);
  const [transcriptionStartTime, setTranscriptionStartTime] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false); // Added isPaused state
  const [showPriorAuthModal, setShowPriorAuthModal] = useState(false);

  const transcriptAreaRef = useRef<HTMLDivElement>(null);
  const richTextEditorRef = useRef<RichTextEditorRef>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null); // Added mediaRecorderRef
  const socketRef = useRef<WebSocket | null>(null); // Added socketRef for consistency with original file
  const audioStreamRef = useRef<MediaStream | null>(null); // Store original audio stream for waveform
  const isSavingRef = useRef(false); // Track save state to prevent race conditions

  const encounterStateForAutoSaveRef = useRef<{
    patientBusinessId: string | undefined; // Business ID of the patient
    encounterSupabaseId: string | undefined; // Stores selectedEncounter.id (UUID)
    transcriptToSave: string;
    lastSaved: string;
  } | null>(null);

  // State for AI Analysis Panel
  const [aiOutput, setAiOutput] = useState<ClinicalOutputPackage | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isSavingAI, setIsSavingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [referralDetails, setReferralDetails] = useState<any>(null);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [priorAuthDetails, setPriorAuthDetails] = useState<any>(null);

  const autoStartSessionRef = useRef(false);
  const startedRef = useRef(false);

  const transcriptionActiveRef = useRef(false);

  const setIsTranscribingAndRef = (val) => {
    setIsTranscribing(val);
    transcriptionActiveRef.current = val;
  };

  const stopTranscription = useCallback((resetPaused: boolean = true) => {
    console.log("stopTranscription called with resetPaused:", resetPaused, "current states:", { isTranscribing, isPaused });
    let stopped = false;
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
          stopped = true;
          console.log("MediaRecorder stopped");
        }
      } catch (e) {
        console.log("Error stopping mediaRecorder:", e);
      }
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => {
          if (track.readyState === 'live') {
            track.stop();
          }
        });
        stopped = true;
        console.log("Media stream tracks stopped");
      }
      mediaRecorderRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => {
        if (track.readyState === 'live') {
          track.stop();
        }
      });
      audioStreamRef.current = null;
      console.log("Audio stream tracks stopped");
    }
    if (socketRef.current) {
      try {
        if (socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.close();
          console.log("WebSocket closed");
        }
      } catch (e) {
        console.log("Error closing WebSocket:", e);
      }
      socketRef.current = null;
    }
    setIsTranscribingAndRef(false);
    console.log("setIsTranscribing(false) called");
    if (resetPaused) {
      setIsPaused(false);
      console.log("setIsPaused(false) called because resetPaused is true");
    } else {
      console.log("isPaused state preserved because resetPaused is false");
    }
    if (stopped) {
      console.log('[Transcription] Cleaned up media recorder and tracks.');
    }
  }, [isTranscribing, isPaused]);

  useEffect(() => {
    if (selectedEncounter && patient) {
      const currentTranscript = selectedEncounter.transcript || '';
      setEditableTranscript(currentTranscript);
      setLastSavedTranscript(currentTranscript);
      setTranscriptChanged(false);
      if (richTextEditorRef.current) {
        richTextEditorRef.current.setContent(currentTranscript);
      }
      setAiOutput(null);
      encounterStateForAutoSaveRef.current = {
        patientBusinessId: selectedEncounter.patientId,
        encounterSupabaseId: selectedEncounter.id,
        transcriptToSave: currentTranscript,
        lastSaved: currentTranscript,
      };
      autoStartSessionRef.current = false;
      startedRef.current = false;
      console.log('[ConsultationTab] Encounter opened, autoStartSessionRef reset');
    } else {
      setEditableTranscript("");
      setLastSavedTranscript("");
      setTranscriptChanged(false);
      if (richTextEditorRef.current) {
        richTextEditorRef.current.setContent("");
      }
      setAiOutput(null);
      encounterStateForAutoSaveRef.current = null;
      autoStartSessionRef.current = false;
      startedRef.current = false;
      console.log('[ConsultationTab] Encounter closed, autoStartSessionRef reset');
      stopTranscription(true);
    }
    return () => {
      if (transcriptionActiveRef.current) {
        console.log('[ConsultationTab] Cleanup: Stopping transcription on true close/unmount');
        stopTranscription(true);
      } else {
        console.log('[ConsultationTab] Cleanup: No active transcription to stop');
      }
    };
  }, [selectedEncounter, patient, stopTranscription]);

  const getCursorPosition = (): number | null => {
    // Note: With Tiptap, cursor position management is handled internally
    // We can get the current selection position if needed using editor.state.selection
    if (richTextEditorRef.current?.editor) {
      return richTextEditorRef.current.editor.state.selection.from;
    }
    return null;
  };

  const debouncedSaveTranscript = useDebouncedCallback(async () => {
    const currentSaveState = encounterStateForAutoSaveRef.current;
    
    // Prevent multiple simultaneous saves
    if (isSavingRef.current) {
      return;
    }
    
    if (currentSaveState && selectedEncounter && currentSaveState.patientBusinessId && selectedEncounter.encounterIdentifier && currentSaveState.transcriptToSave !== currentSaveState.lastSaved) {
      console.log("Auto-saving transcript for patient (business ID):", currentSaveState.patientBusinessId, "encounter (business ID):", selectedEncounter.encounterIdentifier);
      
      isSavingRef.current = true;
      try {
        const encounterIdVal = typeof selectedEncounter.encounterIdentifier === 'string' 
          ? selectedEncounter.encounterIdentifier
          : String(selectedEncounter.encounterIdentifier);

        const compositeEncounterId = `${currentSaveState.patientBusinessId}_${encounterIdVal}`;
        
        await supabaseDataService.updateEncounterTranscript(currentSaveState.patientBusinessId, compositeEncounterId, currentSaveState.transcriptToSave);
        console.log("Transcript auto-saved for encounter (business ID):", encounterIdVal);
        if (encounterStateForAutoSaveRef.current && encounterStateForAutoSaveRef.current.encounterSupabaseId === selectedEncounter.id) {
          encounterStateForAutoSaveRef.current.lastSaved = currentSaveState.transcriptToSave;
        }
        setLastSavedTranscript(currentSaveState.transcriptToSave);
        setTranscriptChanged(false);
        toast({ title: "Transcript Auto-Saved", description: "Changes to the transcript have been saved automatically." });
      } catch (error) {
        console.error("Error auto-saving transcript:", error);
        toast({ title: "Save Error", description: "Could not auto-save transcript.", variant: "destructive" });
      } finally {
        isSavingRef.current = false;
      }
    }
  }, 1000);

  const handleTranscriptChange = (newTranscript: string) => {
    setEditableTranscript(newTranscript);
    const changed = newTranscript !== (encounterStateForAutoSaveRef.current?.lastSaved || "");
    setTranscriptChanged(changed);
    if (encounterStateForAutoSaveRef.current) {
      encounterStateForAutoSaveRef.current.transcriptToSave = newTranscript;
    }
    if (changed) {
      debouncedSaveTranscript();
    }
  };
  
  const handleDivFocus = () => {
    // Intentionally left blank - Tiptap handles focus internally
  };

  const handleDivKeyUpOrMouseUp = () => {
    // Intentionally left blank - Tiptap handles cursor position internally
  };

  const startTranscription = useCallback(async () => {
    if (isTranscribing && !isPaused) return;

    const currentCursor = getCursorPosition();
    console.log("Starting transcription, cursor at:", currentCursor);

    let encounterToUse = selectedEncounter;

    // Only create new encounter if we're starting a new consultation AND no encounter exists
    if (!encounterToUse && isStartingNewConsultation && onStartTranscriptionForNewConsult) {
        // Add guard to prevent multiple creation attempts
        if (isTranscribing) {
          console.log("Already transcribing, skipping encounter creation");
          return;
        }
        
        try {
          // Don't set isTranscribing here - let it be set when transcription actually starts
          encounterToUse = await onStartTranscriptionForNewConsult();
          if (!encounterToUse) {
            alert("Failed to create new consultation. Cannot start transcription.");
            return;
          }
        } catch (error) {
          console.error("Error creating new consultation:", error);
          alert("Failed to create new consultation. Cannot start transcription.");
          return;
        }
    }

    if (!encounterToUse) {
        alert("No active consultation selected. Cannot start transcription.");
        return;
    }
    
    // Don't handle resume here - that's handled by resumeTranscription function
    // Only check isTranscribing if we're not auto-starting a new consultation
    if (!isStartingNewConsultation && (isPaused || isTranscribing)) {
      console.log("startTranscription: Already transcribing or paused, ignoring start request");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream; // Store original stream for waveform
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
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
      
      const wsInstance = await openDeepgramSocket(wsUrl);
      socketRef.current = wsInstance;
      mediaRecorderRef.current = mediaRecorder;

      // KeepAlive mechanism to prevent connection timeouts during silence
      let keepAliveInterval: NodeJS.Timeout | null = null;

      wsInstance.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          
          // Handle UtteranceEnd events
          if (data.type === 'UtteranceEnd') {
            console.log("ConsultationTab: Received UtteranceEnd event", data);
            return;
          }

          // Handle speech events
          if (data.type === 'SpeechStarted') {
            console.log("ConsultationTab: Speech detected");
            return;
          }

          // Handle transcription results
          if (data && data.channel && data.is_final && data.channel.alternatives[0]?.transcript) {
            const newTextChunk = data.channel.alternatives[0].transcript.trim();
            const speaker = data.channel.alternatives[0]?.words?.[0]?.speaker ?? null;
            
            if (newTextChunk !== '') {
              let textToAdd = newTextChunk;
              
              // Add speaker label if available
              if (speaker !== null && speaker !== undefined) {
                const speakerLabel = `Speaker ${speaker}: `;
                // Get current content from state to avoid ref/state sync issues
                const currentContent = editableTranscript;
                const lines = currentContent.split('\n');
                const lastLine = lines[lines.length - 1] || '';
                
                // Add speaker label if starting fresh or speaker changed
                if (!lastLine.includes('Speaker ') || !lastLine.startsWith(`Speaker ${speaker}:`)) {
                  textToAdd = (currentContent ? '\n' : '') + speakerLabel + newTextChunk;
                } else {
                  textToAdd = ' ' + newTextChunk;
                }
              } else {
                // No speaker info, just add appropriate spacing
                textToAdd = (editableTranscript ? ' ' : '') + newTextChunk;
              }
              
              // Only update state to trigger single change event
              setEditableTranscript((prevText) => {
                const updatedText = prevText + textToAdd;
                // Update the ref state tracker for auto-save
                if (encounterStateForAutoSaveRef.current) {
                  encounterStateForAutoSaveRef.current.transcriptToSave = updatedText;
                }
                
                // Auto-scroll to bottom after content update
                setTimeout(() => {
                  if (richTextEditorRef.current?.editor) {
                    richTextEditorRef.current.editor.commands.focus('end');
                  }
                }, 100);
                
                return updatedText;
              });
            }
          }
        } catch (error) {
          console.warn('[ConsultationTab] Error processing WebSocket message:', error);
        }
      };

      wsInstance.onopen = () => {
        // Start KeepAlive messages every 5 seconds to prevent 10-second timeout
        keepAliveInterval = setInterval(() => {
          if (wsInstance.readyState === WebSocket.OPEN) {
            wsInstance.send(JSON.stringify({ type: "KeepAlive" }));
            console.log("ConsultationTab: Sent KeepAlive message");
          }
        }, 5000);

        mediaRecorder.addEventListener('dataavailable', (event) => {
          if (event.data.size > 0 && wsInstance.readyState === WebSocket.OPEN) {
            wsInstance.send(event.data);
          }
        });
        mediaRecorder.start(250);
        setIsTranscribingAndRef(true);
        setIsPaused(false); // Always reset paused state when starting new transcription
        console.log("Transcription started via WebSocket.");
      };

      wsInstance.onclose = (event) => {
        console.log("WebSocket closed", event.code, event.reason);
        
        // Clear KeepAlive interval
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }

        // Only attempt reconnection if the transcription is still supposed to be active
        // and it wasn't a user-initiated close (code 1000) or going away (code 1001)
        if (transcriptionActiveRef.current && !isPaused && event.code !== 1000 && event.code !== 1001) {
          console.log('[ConsultationTab] Connection lost unexpectedly, attempting reconnection...');
          
          // Wait a short time before reconnecting to avoid rapid reconnection loops
          setTimeout(() => {
            if (transcriptionActiveRef.current && !isPaused) {
              console.log('[ConsultationTab] Attempting automatic reconnection...');
              startTranscription(); // Recursive call to restart transcription
            }
          }, 2000);
        } else {
          stopTranscription(false); // Don't reset paused state on normal connection close
        }
      };

      wsInstance.onerror = (error) => {
        console.error("WebSocket error:", error);
        
        // Clear KeepAlive interval
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }
        
        stopTranscription(false); // Don't reset paused state on connection issues
      }

    } catch (err: unknown) {
      console.error('Error starting transcription system', err);
      alert(`Error starting transcription system: ${err instanceof Error ? err.message : String(err)}`);
      stopTranscription(true); // Reset paused state on startup errors
    }
  }, [isTranscribing, isPaused, selectedEncounter, isStartingNewConsultation, onStartTranscriptionForNewConsult, editableTranscript, stopTranscription]);

  const pauseTranscription = () => {
    console.log("pauseTranscription called - current states:", { isTranscribing, isPaused });
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      console.log("Transcription paused - mediaRecorder paused, isPaused set to true");
    } else {
      console.log("pauseTranscription: mediaRecorder not in recording state:", mediaRecorderRef.current?.state);
    }
  };

  const resumeTranscription = () => {
    console.log("resumeTranscription called - current states:", { isTranscribing, isPaused });
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      setIsTranscribingAndRef(true); // Ensure we're in transcribing state
      console.log("Transcription resumed - mediaRecorder resumed, isPaused set to false, isTranscribing set to true");
    } else {
      console.log("resumeTranscription: mediaRecorder not in paused state:", mediaRecorderRef.current?.state);
    }
  };

  const stopTranscriptionAndSave = () => {
    console.log("Stop & Save initiated.");
    stopTranscription(true); // Reset paused state when explicitly stopping
    
    setTimeout(() => {
      handleSaveTranscript();
    }, 250); // Delay to allow final transcript processing
  };

  const handleAIResultsSave = async () => {
    if (!aiOutput || !aiOutput.diagnosticResult || !selectedEncounter || !patient) {
      toast({ title: "Error", description: "No AI analysis results to save or patient/encounter not available.", variant: "destructive" });
      return;
    }
    setIsSavingAI(true);
    try {
      let soapNoteString: string | null = null;
      if (aiOutput.soapNote) {
        soapNoteString = typeof aiOutput.soapNote === 'string' ? aiOutput.soapNote : JSON.stringify(aiOutput.soapNote);
      }

      if (aiOutput.diagnosticResult.differentialDiagnoses && selectedEncounter.encounterIdentifier) {
        await supabaseDataService.saveDifferentialDiagnoses(
          selectedEncounter.patientId, // patient business ID
          selectedEncounter.encounterIdentifier, // encounter business ID
          aiOutput.diagnosticResult.differentialDiagnoses as DifferentialDiagnosis[] // Type assertion
        );
      }
      
      if (soapNoteString && selectedEncounter.patientId && selectedEncounter.encounterIdentifier) {
          const compositeEncounterId = `${selectedEncounter.patientId}_${selectedEncounter.encounterIdentifier}`;
          await supabaseDataService.updateEncounterSOAPNote(selectedEncounter.patientId, compositeEncounterId, soapNoteString);
          // Update local encounter state if necessary
          if(selectedEncounter.soapNote !== soapNoteString) {
            // This would typically involve re-fetching or updating the selectedEncounter object in parent state
            console.log("SOAP note updated, UI refresh might be needed for selectedEncounter");
          }
      }

      toast({ title: "Success", description: "AI Analysis (Differentials & SOAP) saved." });
    } catch (error) {
      console.error("Error saving AI Analysis to encounter:", error);
      toast({ title: "Error", description: `Failed to save AI Analysis: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setIsSavingAI(false);
    }
  };

  const openReferralModal = () => {
    if (aiOutput?.referralDocument?.generatedContent) {
      setReferralDetails(aiOutput.referralDocument.generatedContent);
      setShowReferralModal(true);
    } else {
      toast({title: "No Referral Document", description: "AI analysis did not generate a referral document.", variant: "default"})
    }
  }

  const openPriorAuthModal = () => {
    if (aiOutput?.priorAuthDocument?.generatedContent) {
      setPriorAuthDetails(aiOutput.priorAuthDocument.generatedContent);
      setShowPriorAuthModal(true);
    }
     else {
      toast({title: "No Prior Auth Document", description: "AI analysis did not generate a prior authorization document.", variant: "default"})
    }
  }

  const handleSaveTranscript = async () => {
    const currentSaveState = encounterStateForAutoSaveRef.current;
    if (currentSaveState && selectedEncounter && currentSaveState.patientBusinessId && selectedEncounter.encounterIdentifier && currentSaveState.transcriptToSave !== currentSaveState.lastSaved) {
      setIsLoading(true); // Indicate loading state
      console.log("Manually saving transcript for patient (business ID):", currentSaveState.patientBusinessId, "encounter (business ID):", selectedEncounter.encounterIdentifier);
      try {
        const encounterIdVal = typeof selectedEncounter.encounterIdentifier === 'string' 
        ? selectedEncounter.encounterIdentifier
        : String(selectedEncounter.encounterIdentifier); // Or handle error/default

        const compositeEncounterId = `${currentSaveState.patientBusinessId}_${encounterIdVal}`;
        await supabaseDataService.updateEncounterTranscript(currentSaveState.patientBusinessId, compositeEncounterId, currentSaveState.transcriptToSave);
        console.log("Transcript manually saved for encounter (business ID):", selectedEncounter.encounterIdentifier);
        if (encounterStateForAutoSaveRef.current && encounterStateForAutoSaveRef.current.encounterSupabaseId === selectedEncounter.id) {
          encounterStateForAutoSaveRef.current.lastSaved = currentSaveState.transcriptToSave;
        }
        setLastSavedTranscript(currentSaveState.transcriptToSave);
        setTranscriptChanged(false);
        toast({ title: "Transcript Saved", description: "The transcript has been successfully saved." });
      } catch (error) {
        console.error("Error manually saving transcript:", error);
        toast({ title: "Save Error", description: `Failed to save transcript: ${(error as Error).message}`, variant: "destructive" });
      } finally {
        setIsLoading(false); // Reset loading state
      }
    } else if (currentSaveState && currentSaveState.transcriptToSave === currentSaveState.lastSaved) {
      toast({ title: "No Changes", description: "No changes to save in the transcript.", variant: "default" });
    } else {
      toast({ title: "Save Error", description: "Cannot save transcript. Patient or encounter context is missing.", variant: "destructive" });
    }
  };
  
  const handleManualSave = handleSaveTranscript; // Alias for JSX

  // Auto-start transcription for new consultations
  useEffect(() => {
    if (isStartingNewConsultation && !isTranscribing && !selectedEncounter && !autoStartSessionRef.current) {
      console.log('[ConsultationTab] Auto-start: Conditions met for new consultation transcription');
      autoStartSessionRef.current = true;
      const timer = setTimeout(() => {
        console.log('[ConsultationTab] Auto-start: Calling startTranscription after delay');
        startTranscription();
        startedRef.current = true;
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isStartingNewConsultation, isTranscribing, selectedEncounter, startTranscription]);

  // JSX for rendering will be added here
  return (
    <div className="space-y-4">
      {isStartingNewConsultation && (
        <Card>
          <CardHeader>
            <CardTitle>New Consultation Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Reason for consultation</label>
              <input
                type="text"
                placeholder="E.g., joint pain, generalized inflammation"
                className="w-full px-3 py-2 border rounded-md bg-background text-step--1 border-border"
                value={newConsultationReason || ''}
                onChange={(e) => onNewConsultationReasonChange?.(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Date and time</label>
              <input
                type="datetime-local"
                className="w-full px-3 py-2 border rounded-md bg-background text-step--1 border-border"
                value={newConsultationDate ? newConsultationDate.toISOString().slice(0, 16) : ''}
                onChange={(e) => onNewConsultationDateChange?.(e.target.value ? new Date(e.target.value) : null)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Duration</label>
              <select
                value={newConsultationDuration || ''}
                onChange={(e) => onNewConsultationDurationChange?.(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border rounded-md bg-background text-step--1 border-border"
              >
                <option value="" disabled>Select duration</option>
                {Array.from({ length: 24 }, (_, i) => (i + 1) * 5).map(minutes => (
                  <option key={minutes} value={minutes}>{minutes} min</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          Consultation Notes & Transcript
          <div className="flex items-center gap-2">
            {transcriptChanged && !isTranscribing && (
              <Button variant="default" size="sm" onClick={handleManualSave}>
                <Save className="h-4 w-4 mr-2" /> Save
              </Button>
            )}
          </div>
        </CardTitle>
        

      </CardHeader>
      <CardContent className="flex-grow overflow-y-auto relative">
        {(selectedEncounter || editableTranscript || isTranscribing || isStartingNewConsultation) ? (
          <>
            <RichTextEditor
              ref={richTextEditorRef}
              content={editableTranscript}
              onContentChange={handleTranscriptChange}
              placeholder="Start typing your consultation notes or transcription will appear here automatically..."
              disabled={isTranscribing}
              showToolbar={!isTranscribing}
              minHeight="300px"
              className="h-full"
            />
            {/* Always render pillbox container; AudioWaveform will render its content when active or paused */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
              <AudioWaveform
                isRecording={isTranscribing}
                isPaused={isPaused}
                mediaStream={audioStreamRef.current}
                onPause={pauseTranscription}
                onResume={resumeTranscription}
                onStop={stopTranscriptionAndSave}
              />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>
              No transcript available. Select an encounter or start a new consultation.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
    
    {/* AI Analysis Panel */}
    {selectedEncounter && patient?.id && (
      <AIAnalysisPanel
        patientId={patient.id}
        encounterId={selectedEncounter.id}
        onSave={handleAIResultsSave}
      />
    )}
    </div>
  );
};

export default ConsultationTab; 
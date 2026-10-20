'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from "react-dom";
import type { Patient, Encounter, EncounterDetailsWrapper, Treatment, LabResult, Diagnosis, ClinicalTrial } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Eye, Trash, CircleNotch, Play as PlayIcon, Stop as StopIcon } from '@phosphor-icons/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import RenderDetailTable from "@/components/ui/RenderDetailTable";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDifferentialDiagnoses } from '@/hooks/useDifferentialDiagnoses';
import DifferentialDiagnosesList from '@/components/diagnosis/DifferentialDiagnosesList';
import { 
  EditableTextField, 
  EditableDateTimeField, 
  EditableTable, 
  EditableArrayField, 
  SOAPNoteEditor, 
  TranscriptEditorModal 
} from '@/components/ui/editable';
import { RichTreatmentEditor } from '@/components/ui/rich-treatment-editor';
import { useRichContentEditor } from '@/hooks/useRichContentEditor';
import PriorAuthorizationForm from '@/components/forms/PriorAuthorizationForm';
import ReferralForm from '@/components/forms/ReferralForm';
import { useEditableEncounterFields } from '@/hooks/useEditableEncounterFields';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import { toast } from '@/hooks/use-toast';
import Section from '@/components/ui/section';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

import { cn } from '@/lib/utils';
import { supabaseDataService } from '@/lib/supabaseDataService';
import { format } from 'date-fns';
import { RichTextEditor, type RichTextEditorRef } from '@/components/ui/rich-text-editor';
import { AudioWaveform } from '@/components/ui/AudioWaveform';
import { openDeepgramSocket, TranscriptionUnavailableError } from '@/lib/deepgram';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import TranscriptView from '@/components/transcript/TranscriptView';
import TranscriptModeToggle from '@/components/transcript/TranscriptModeToggle';

interface ConsolidatedConsultationTabProps {
  patient: Patient | null;
  selectedEncounter: Encounter | null;
  allEncounters: EncounterDetailsWrapper[] | null;
  onDeleteEncounter: (encounterId: string) => void;
  autoStartTranscription?: boolean;
}

export default function ConsolidatedConsultationTab({ 
  patient, 
  selectedEncounter, 
  allEncounters, 
  onDeleteEncounter,
  autoStartTranscription = false
}: ConsolidatedConsultationTabProps) {
  const [showTranscriptPanel, setShowTranscriptPanel] = useState(false);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);

  // Initialize editable fields hook
  const { updateField, updateFields, isSaving } = useEditableEncounterFields({
    patientId: patient?.id || '',
    encounterId: selectedEncounter?.id || '',
    onSuccess: (updatedEncounter) => {
      toast({
        title: "Success",
        description: "Field updated successfully",
      });
      // Force a re-render by updating the page timestamp
      window.dispatchEvent(new CustomEvent('encounter-field-updated', { 
        detail: { 
          patientId: patient?.id, 
          encounterId: selectedEncounter?.id,
          updatedEncounter 
        } 
      }));
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update field: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Set up unsaved changes warning
  useUnsavedChangesWarning({ when: isSaving });

  // Rich content hooks for diagnosis and treatment
  const diagnosisRichContent = useRichContentEditor({
    encounterId: selectedEncounter?.id || '',
    contentType: 'diagnosis',
    onError: (error) => {
      console.error('Diagnosis rich content error:', error);
      toast({ 
        title: "Error loading diagnosis", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  const treatmentRichContent = useRichContentEditor({
    encounterId: selectedEncounter?.id || '',
    contentType: 'treatments',
    onError: (error) => {
      console.error('Treatment rich content error:', error);
      toast({ 
        title: "Error loading treatment", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  // Transcription state and functionality
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcriptText, setTranscriptText] = useState('');
  const [transcriptMode, setTranscriptMode] = useState<'conversation' | 'edit'>('conversation');
  const [lastSavedTranscript, setLastSavedTranscript] = useState('');
  
  // Refs for transcription functionality
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const originalStreamRef = useRef<MediaStream | null>(null);
  const autoStartSessionRef = useRef(false);
  const richTextEditorRef = useRef<RichTextEditorRef>(null);

  // Call hooks before any early returns to follow Rules of Hooks
  // Fixed: Use the database encounter ID (UUID) for differential diagnoses
  const {
    differentialDiagnoses,
    isLoading: isLoadingDifferentials,
    error: differentialDiagnosesError,
    addDifferentialDiagnosis,
    updateDifferentialDiagnosis,
    deleteDifferentialDiagnosis,
  } = useDifferentialDiagnoses({
    patientId: patient?.id || '',
    encounterId: selectedEncounter?.id || '', // Use the UUID, not encounterIdentifier
    autoLoad: true,
  });

  // Load existing transcript text from the encounter
  useEffect(() => {
    if (selectedEncounter?.transcript) {
      setTranscriptText(selectedEncounter.transcript);
      setLastSavedTranscript(selectedEncounter.transcript);
    } else {
      setTranscriptText('');
      setLastSavedTranscript('');
    }
  }, [selectedEncounter?.id, selectedEncounter?.transcript]);

  // Clean up audio resources
  const cleanupAllAudioResources = useCallback(() => {
    console.log('[ConsolidatedConsultationTab] Cleaning up audio resources');
    
    // Close WebSocket
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    
    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    
    // Stop all audio tracks from original stream
    if (originalStreamRef.current) {
      originalStreamRef.current.getTracks().forEach(track => track.stop());
      originalStreamRef.current = null;
    }
    
    // Clear audio stream ref
    audioStreamRef.current = null;
    
    // Reset states
    setIsTranscribing(false);
    setIsPaused(false);
  }, []);

  // Start transcription functionality
  const startTranscription = useCallback(async () => {
    console.log('[ConsolidatedConsultationTab] Starting transcription');
    
    if (isTranscribing) {
      console.log('[ConsolidatedConsultationTab] Already transcribing, ignoring start request');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      originalStreamRef.current = stream;
      audioStreamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      // Enhanced Deepgram WebSocket URL with better silence handling and speech detection
      const wsUrl = 'wss://api.deepgram.com/v1/listen?' + new URLSearchParams({
        model: 'nova-3-medical',
        punctuate: 'true',
        interim_results: 'true',
        smart_format: 'true',
        diarize: 'true',
        utterance_end_ms: '3000',
        endpointing: 'false',
        vad_events: 'true'
      }).toString();
      
      const ws = await openDeepgramSocket(wsUrl);
      socketRef.current = ws;

      // KeepAlive mechanism to prevent connection timeouts during silence
      let keepAliveInterval: NodeJS.Timeout | null = null;

      ws.onopen = () => {
        console.log('[ConsolidatedConsultationTab] WebSocket opened successfully');
        
        // Start KeepAlive messages every 5 seconds to prevent 10-second timeout
        keepAliveInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "KeepAlive" }));
            console.log('[ConsolidatedConsultationTab] Sent KeepAlive message');
          }
        }, 5000);

        mediaRecorderRef.current?.addEventListener('dataavailable', event => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(event.data);
        });
        mediaRecorderRef.current?.start(250);
        setIsTranscribing(true);
        setIsPaused(false);
        console.log('[ConsolidatedConsultationTab] Transcription started');
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          
          // Handle UtteranceEnd events
          if (data.type === 'UtteranceEnd') {
            console.log('[ConsolidatedConsultationTab] Received UtteranceEnd event', data);
            return;
          }

          // Handle speech events
          if (data.type === 'SpeechStarted') {
            console.log('[ConsolidatedConsultationTab] Speech detected');
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
                  if (richTextEditorRef.current?.editor) {
                    richTextEditorRef.current.editor.commands.focus('end');
                  }
                }, 100);
                
                return updatedText;
              });
            }
          }
        } catch (error) {
          console.warn('[ConsolidatedConsultationTab] Error processing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('[ConsolidatedConsultationTab] WebSocket closed:', event.code, event.reason);
        
        // Clear KeepAlive interval
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }

        // Only attempt reconnection if the transcription is still supposed to be active
        if (isTranscribing && !isPaused && event.code !== 1000 && event.code !== 1001) {
          console.log('[ConsolidatedConsultationTab] Connection lost unexpectedly, attempting reconnection...');
          
          setTimeout(() => {
            if (isTranscribing && !isPaused) {
              console.log('[ConsolidatedConsultationTab] Attempting automatic reconnection...');
              startTranscription();
            }
          }, 2000);
        } else {
          cleanupAllAudioResources();
        }
      };
      
      ws.onerror = (error) => {
        console.error('[ConsolidatedConsultationTab] WebSocket error:', error);
        
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
  }, [isTranscribing, isPaused, cleanupAllAudioResources]);

  // Pause transcription
  const pauseTranscription = useCallback(() => {
    console.log('[ConsolidatedConsultationTab] Pausing transcription');
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  }, []);

  // Resume transcription
  const resumeTranscription = useCallback(() => {
    console.log('[ConsolidatedConsultationTab] Resuming transcription');
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      setIsTranscribing(true);
    }
  }, []);

  // Stop transcription and save
  const stopTranscriptionAndSave = useCallback(async () => {
    console.log('[ConsolidatedConsultationTab] Stopping transcription and saving');
    cleanupAllAudioResources();
    
    // Save transcript to database
    if (transcriptText !== lastSavedTranscript) {
      try {
        await updateField('transcript', transcriptText);
        setLastSavedTranscript(transcriptText);
        toast({ title: "Success", description: "Transcript saved successfully", variant: "default" });
      } catch (error) {
        console.error('Error saving transcript:', error);
        toast({ title: "Error", description: "Failed to save transcript", variant: "destructive" });
      }
    }
  }, [transcriptText, lastSavedTranscript, updateField, cleanupAllAudioResources]);

  // Auto-start transcription effect
  useEffect(() => {
    if (autoStartTranscription && selectedEncounter && !isTranscribing && !autoStartSessionRef.current) {
      console.log('[ConsolidatedConsultationTab] Auto-starting transcription for encounter:', selectedEncounter.id);
      autoStartSessionRef.current = true;
      
      const timer = setTimeout(() => {
        startTranscription();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [autoStartTranscription, selectedEncounter, isTranscribing, startTranscription]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAllAudioResources();
    };
  }, [cleanupAllAudioResources]);

  if (!patient) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground text-center">No patient data available.</p>
      </div>
    );
  }

  if (!selectedEncounter) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">No consultation selected.</p>
          <p className="text-sm text-muted-foreground/60">Please select a consultation from the dropdown above.</p>
        </div>
      </div>
    );
  }

  // Find the encounter details for the selected encounter
  const encounterDetails = allEncounters?.find(ew => ew.encounter.id === selectedEncounter.id);
  const { diagnoses = [], labResults = [] } = encounterDetails || {};

  // Mock trials data - same as TrialsTab
  const MOCK_TRIALS_DATA: Record<string, { id: string; title: string; distance: string; fit: number }[]> = {
    "1": [
      { id: "NCT055123", title: "Abatacept vs Placebo in Early RA", distance: "12 mi", fit: 0.82, },
      { id: "NCT061987", title: "JAK Inhibitor Tofacitinib Long-Term Safety", distance: "32 mi", fit: 0.77, },
    ],
  };
  const trialRows = MOCK_TRIALS_DATA[patient.id] || [];

  // Prior auth data - similar to PriorAuthTab logic
  const medicationForAuth = selectedEncounter.treatments?.[0]?.drug || "N/A";
  const diagnosisForAuth = diagnoses?.[0]?.description || "N/A";
  const diagnosisCodeForAuth = diagnoses?.[0]?.code || "N/A";
  const justificationForAuth = selectedEncounter.priorAuthJustification || "No specific justification provided for this encounter.";

  return (
    <div className="space-y-6">
      {/* Encounter Header */}
      <div className="rounded-[var(--radius-lg)] border border-border bg-card p-5 space-y-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-ink">
            Consultation Details
          </h2>
          <span className="data-mono break-all text-xs text-muted-foreground">
            {selectedEncounter.encounterIdentifier}
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <h3 className="label-caps">Scheduled Start</h3>
            <EditableDateTimeField
              value={selectedEncounter.scheduledStart || ''}
              onSave={(value) => updateField('scheduledStart', value)}
              displayClassName="text-sm"
            />
          </div>
          
          <div className="space-y-2">
            <h3 className="label-caps">Scheduled End</h3>
            <EditableDateTimeField
              value={selectedEncounter.scheduledEnd || ''}
              onSave={(value) => updateField('scheduledEnd', value)}
              displayClassName="text-sm"
            />
          </div>
          
          <div className="space-y-2">
            <h3 className="label-caps">Actual Start</h3>
            <EditableDateTimeField
              value={selectedEncounter.actualStart || ''}
              onSave={(value) => updateField('actualStart', value)}
              displayClassName="text-sm"
            />
          </div>
          
          <div className="space-y-2">
            <h3 className="label-caps">Actual End</h3>
            <EditableDateTimeField
              value={selectedEncounter.actualEnd || ''}
              onSave={(value) => updateField('actualEnd', value)}
              displayClassName="text-sm"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="label-caps">Reason for Visit</h3>
            <EditableTextField
              value={selectedEncounter.reasonDisplayText || selectedEncounter.reasonCode || ''}
              onSave={(value) => updateField('reasonDisplayText', value)}
              placeholder="Enter reason for consultation"
              multiline
              displayClassName="text-sm"
            />
          </div>
          
          <div className="space-y-2">
            <h3 className="label-caps">Insurance Status</h3>
            <EditableTextField
              value={selectedEncounter.insuranceStatus || ''}
              onSave={(value) => updateField('insuranceStatus', value)}
              placeholder="Enter insurance status"
              displayClassName="text-sm"
            />
          </div>
        </div>
      </div>

      {/* Transcript: a conversation to read, or text to edit */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-3">
            Live Transcription
            <div className="flex flex-wrap items-center gap-2 font-sans text-sm">
              {!isTranscribing && transcriptText ? (
                <TranscriptModeToggle mode={transcriptMode} onChange={setTranscriptMode} />
              ) : null}
              <Button
                variant={isTranscribing ? "destructive" : "default"}
                size="sm"
                onClick={isTranscribing ? stopTranscriptionAndSave : startTranscription}
                disabled={isPaused}
                iconLeft={isTranscribing ? <StopIcon /> : <PlayIcon />}
              >
                {isTranscribing ? 'Stop & Save' : 'Start Recording'}
              </Button>
              {transcriptText && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowTranscriptModal(true)}
                  iconLeft={<Eye />}
                >
                  View Full Transcript
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="relative min-h-[18rem] pb-20">
          {isTranscribing || (transcriptMode === 'conversation' && transcriptText) ? (
            <TranscriptView
              className="max-h-[32rem]"
              transcript={transcriptText}
              live={isTranscribing}
              followNewest={isTranscribing}
              terms={[
                ...diagnoses.map((d) => d.description || ''),
                ...((selectedEncounter.treatments || []) as any[]).map((t) => t?.treatment_name || t?.drug || ''),
              ]}
            />
          ) : (
            <RichTextEditor
              ref={richTextEditorRef}
              content={transcriptText}
              onContentChange={(content) => setTranscriptText(content)}
              placeholder="Start recording to begin live transcription, or type your consultation notes here..."
              disabled={isTranscribing}
              showToolbar={!isTranscribing}
              minHeight="200px"
              className="h-full"
            />
          )}

          <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
            <AudioWaveform
              isRecording={isTranscribing}
              isPaused={isPaused}
              mediaStream={audioStreamRef.current}
              onPause={pauseTranscription}
              onResume={resumeTranscription}
              onStop={stopTranscriptionAndSave}
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary Notes (SOAP Notes) */}
      <Card>
        <CardHeader>
          <CardTitle>
            Summary Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SOAPNoteEditor
            soapNote={selectedEncounter.soapNote || ''}
            onSave={(value) => updateField('soapNote', value)}
          />
        </CardContent>
      </Card>

      {/* Diagnosis - Enhanced with Rich Content */}
      <Card>
        <CardHeader>
          <CardTitle>Diagnosis</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Rich Content Diagnosis */}
          {diagnosisRichContent.content ? (
            <div className="mb-6">
              <RichTreatmentEditor
                content={diagnosisRichContent.content}
                onSave={diagnosisRichContent.saveContent}
                isDemo={false}
                label="Clinical Diagnosis"
              />
            </div>
          ) : diagnosisRichContent.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <CircleNotch className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading diagnosis...</span>
            </div>
          ) : (
            /* Fallback to Text-only Diagnosis */
            diagnoses.length > 0 ? (
              <div className="space-y-4 mb-6">
                {diagnoses.map((dx, index) => (
                  <div key={`dx-${index}-${dx.code || 'unknown'}`} className="bg-card border border-border rounded-md p-4 space-y-3">
                    {/* Full Diagnosis Description - prominently displayed */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Diagnosis</h4>
                      <p className="text-sm leading-relaxed">
                        {dx.description || "No description available"}
                      </p>
                    </div>
                    
                    {/* ICD Code - displayed below */}
                    {dx.code && (
                      <div className="pt-2 border-t border-border/30">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">ICD Code:</span>
                          <span className="text-sm text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded">
                            {dx.code}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/70 mb-6">No final diagnosis recorded for this consultation</p>
            )
          )}
          
          {/* Differential Diagnoses Section */}
          <div className="pt-6 border-t border-border/50">
             
             {differentialDiagnosesError ? (
               <div className="text-sm text-critical bg-critical-soft p-3 rounded-md mb-4">
                 Error loading differential diagnoses: {differentialDiagnosesError}
               </div>
             ) : null}
             <DifferentialDiagnosesList
                diagnoses={differentialDiagnoses || []}
                isLoading={isLoadingDifferentials}
                isEditable={true}
                onAddDiagnosis={addDifferentialDiagnosis}
                onSaveDiagnosis={(diagnosis, index) => updateDifferentialDiagnosis(index, diagnosis)}
                onDeleteDiagnosis={deleteDifferentialDiagnosis}
                className="w-full"
              />
          </div>
        </CardContent>
      </Card>

      {/* Treatment - Enhanced with Rich Content */}
      <Card>
        <CardHeader>
          <CardTitle>Treatment Plans</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Rich Content Treatment */}
          {treatmentRichContent.content ? (
            <div className="mb-6">
              <RichTreatmentEditor
                content={treatmentRichContent.content}
                onSave={treatmentRichContent.saveContent}
                isDemo={false}
                label="Treatment Plans"
              />
            </div>
          ) : treatmentRichContent.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <CircleNotch className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading treatment plans...</span>
            </div>
          ) : (
            /* Fallback to Basic Treatment Table */
            <EditableTable
              label=""
              treatments={selectedEncounter.treatments || []}
              onSave={(value) => updateField('treatments', value)}
            />
          )}
        </CardContent>
      </Card>

      {/* Labs */}
      <Card>
        <CardHeader>
          <CardTitle>Laboratory Results</CardTitle>
        </CardHeader>
        <CardContent>
          {labResults.length > 0 ? (
            <RenderDetailTable 
              title='' 
              dataArray={labResults} 
              headers={['Test Name', 'Value', 'Units', 'Date/Time', 'Ref. Range', 'Flag']} 
              columnAccessors={['name', 'value', 'units', 'dateTime', 'referenceRange', 'flag']} 
            />
          ) : (
            <p className="text-sm text-muted-foreground/70">No lab results recorded for this consultation</p>
          )}
        </CardContent>
      </Card>

      {/* Prior Authorization */}
      <Section 
        title="Prior Authorization" 
        collapsible={true} 
        defaultOpen={false}
        collapsedSummary="Generate prior authorization forms"
      >
        <PriorAuthorizationForm
          patient={patient}
          encounter={selectedEncounter}
          diagnoses={diagnoses}
          onSave={async (formData) => {
            try {
              const response = await fetch('/api/forms/prior-auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'save', formData })
              });
              
              if (!response.ok) throw new Error('Failed to save form');
              
              const result = await response.json();
              if (!result.success) throw new Error(result.message || 'Save failed');
              
              // Update the encounter with relevant form data
              await updateField('priorAuthJustification', formData.clinicalJustification);
              
            } catch (error) {
              console.error('Error saving prior auth form:', error);
              throw error;
            }
          }}
          onGeneratePDF={async (formData) => {
            try {
              const response = await fetch('/api/forms/prior-auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'generate-pdf', formData })
              });
              
              if (!response.ok) throw new Error('Failed to generate PDF');
              
              const result = await response.json();
              if (!result.success) throw new Error(result.message || 'PDF generation failed');
              
              // Download the PDF data
              if (result.pdfData) {
                const binaryString = atob(result.pdfData);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: result.mimeType || 'text/html' });
                
                // Import PDFGenerator for download function
                const { PDFGenerator } = await import('@/lib/forms/pdfGenerator');
                PDFGenerator.downloadBlob(blob, result.filename || 'prior_authorization.html');
              }
              
            } catch (error) {
              console.error('Error generating prior auth PDF:', error);
              throw error;
            }
          }}
        />
      </Section>

      {/* Referral */}
      <Section 
        title="Referral" 
        collapsible={true} 
        defaultOpen={false}
        collapsedSummary="Generate referral forms"
      >
        <ReferralForm
          patient={patient}
          encounter={selectedEncounter}
          diagnoses={diagnoses}
          labResults={labResults}
          onSave={async (formData) => {
            try {
              const response = await fetch('/api/forms/referral', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'save', formData })
              });
              
              if (!response.ok) throw new Error('Failed to save form');
              
              const result = await response.json();
              if (!result.success) throw new Error(result.message || 'Save failed');
              
            } catch (error) {
              console.error('Error saving referral form:', error);
              throw error;
            }
          }}
          onGeneratePDF={async (formData) => {
            try {
              const response = await fetch('/api/forms/referral', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'generate-pdf', formData })
              });
              
              if (!response.ok) throw new Error('Failed to generate PDF');
              
              const result = await response.json();
              if (!result.success) throw new Error(result.message || 'PDF generation failed');
              
              // Download the PDF data
              if (result.pdfData) {
                const binaryString = atob(result.pdfData);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: result.mimeType || 'text/html' });
                
                // Import PDFGenerator for download function
                const { PDFGenerator } = await import('@/lib/forms/pdfGenerator');
                PDFGenerator.downloadBlob(blob, result.filename || 'referral.html');
              }
              
            } catch (error) {
              console.error('Error generating referral PDF:', error);
              throw error;
            }
          }}
        />
      </Section>

      {/* Clinical Trials */}
      <Card>
        <CardHeader>
          <CardTitle>Clinical Trials</CardTitle>
        </CardHeader>
        <CardContent>
          {trialRows.length > 0 ? (
            <RenderDetailTable 
              title='' 
              dataArray={trialRows} 
              headers={['ID', 'Title', 'Distance', 'Fit Score']} 
              columnAccessors={['id', 'title', 'distance', 'fit']} 
            />
          ) : (
            <div className="text-center space-y-2 py-8">
              <p className="text-sm text-muted-foreground/70">No clinical trial information available for this patient</p>
              <p className="text-sm text-muted-foreground/60">Trial recommendations will appear here based on patient diagnosis and treatment history</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transcript Modal */}
      {showTranscriptModal && selectedEncounter && (
        <TranscriptEditorModal
          isOpen={showTranscriptModal}
          onClose={() => setShowTranscriptModal(false)}
          transcript={selectedEncounter.transcript || ''}
          onSave={(value) => updateField('transcript', value)}
          patientName={patient?.name || 'Patient'}
        />
      )}

      {/* Danger Zone */}
      <div className="space-y-4 pt-6 mt-6 border-t border-destructive/20">
        <h2 className="font-display text-lg text-critical">Danger Zone</h2>
        <div className="bg-destructive/10 border border-destructive/30 hover:bg-destructive/20 transition-colors rounded-lg p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="label-caps">
                Delete This Consultation
              </h3>
              <p className="text-sm text-muted-foreground">
                This will mark the consultation as deleted. It can be restored later from the &quot;All Data&quot; tab
              </p>
            </div>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => selectedEncounter && onDeleteEncounter(selectedEncounter.id)}
              disabled={!selectedEncounter}
            >
              <Trash className="mr-2 h-4 w-4"/>
              Delete Consultation
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 
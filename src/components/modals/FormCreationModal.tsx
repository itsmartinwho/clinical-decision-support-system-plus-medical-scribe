'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { MagnifyingGlass, ArrowLeft } from '@phosphor-icons/react';
import LoadingAnimation from '@/components/LoadingAnimation';
import { supabaseDataService } from '@/lib/supabaseDataService';
import ReferralForm from '@/components/forms/ReferralForm';
import PriorAuthorizationForm from '@/components/forms/PriorAuthorizationForm';
import { Patient, Encounter, Diagnosis, LabResult } from '@/lib/types';

interface FormCreationModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** 'referral' | 'priorAuth' */
  formType: 'referral' | 'priorAuth';
  /** If provided, skip patient selection step */
  patientId?: string;
  /** If provided (and patientId is provided), skip encounter selection step */
  encounterId?: string;
}

type Step = 'select' | 'form';

export default function FormCreationModal({
  open,
  onOpenChange,
  formType,
  patientId: preselectedPatientId,
  encounterId: preselectedEncounterId,
}: FormCreationModalProps) {
  /* -------------------- State -------------------- */
  const [step, setStep] = useState<Step>('select');
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientEncounters, setPatientEncounters] = useState<Encounter[]>([]);
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /* -------------------- Effects -------------------- */
  useEffect(() => {
    if (!open) return;

    const init = async () => {
      try {
        setIsLoading(true);
        setError(null);
        // Ensure patient data loaded
        if (supabaseDataService.getAllPatients().length === 0) {
          await supabaseDataService.loadPatientData();
        }
        setAllPatients(supabaseDataService.getAllPatients());
        setIsLoading(false);

        // If props provided patientId, preselect
        if (preselectedPatientId) {
          const p = supabaseDataService.getPatient(preselectedPatientId);
          if (p) {
            setSelectedPatient(p);
            const encs = supabaseDataService.getPatientEncounters(p.id);
            setPatientEncounters(encs);
            // Preselect encounter if provided
            if (preselectedEncounterId) {
              const enc = encs.find((e) => e.id === preselectedEncounterId) || null;
              setSelectedEncounter(enc);
              setStep('form');
            } else if (encs.length === 1) {
              setSelectedEncounter(encs[0]);
              setStep('form');
            }
          }
        }
      } catch (err) {
        console.error('Error initializing form modal:', err);
        setError('Failed to load patient data. Please try again.');
        setIsLoading(false);
      }
    };

    init();
  }, [open, preselectedPatientId, preselectedEncounterId]);

  // Reset internal state when closed
  useEffect(() => {
    if (!open) {
      setStep('select');
      setSearchTerm('');
      setSelectedPatient(null);
      setPatientEncounters([]);
      setSelectedEncounter(null);
      setError(null);
    }
  }, [open]);

  /* -------------------- Derived -------------------- */
  const filteredPatients = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return allPatients.filter((p) => {
      if (!term) return true;
      return (
        p.name?.toLowerCase().includes(term) ||
        p.firstName?.toLowerCase().includes(term) ||
        p.lastName?.toLowerCase().includes(term) ||
        p.id.toLowerCase().includes(term)
      );
    });
  }, [allPatients, searchTerm]);

  /* -------------------- Handlers -------------------- */
  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    const encs = supabaseDataService.getPatientEncounters(patient.id);
    setPatientEncounters(encs);
    setSelectedEncounter(null);
  };

  const handleContinueToForm = () => {
    if (selectedPatient && selectedEncounter) {
      setStep('form');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  /* -------------------- Rendering Helpers -------------------- */
  const renderSelectionStep = () => {
    if (error) {
      return (
        <div className="text-center py-8">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Reload Page
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4 w-full max-w-xl">
        {/* Search Input */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search patient..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          <MagnifyingGlass className="w-5 h-5 text-muted-foreground" />
        </div>

        {/* Patients List */}
        <div className="max-h-56 overflow-y-auto border rounded-md">
          {isLoading ? (
            <LoadingAnimation />
          ) : (
            <ul>
              {filteredPatients.map((p) => (
                <li
                  key={p.id}
                  className={`px-4 py-2 hover:bg-muted cursor-pointer ${
                    selectedPatient?.id === p.id ? 'bg-muted/50' : ''
                  }`}
                  onClick={() => handlePatientSelect(p)}
                >
                  {p.name || `${p.firstName} ${p.lastName}`.trim()}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Encounter Dropdown */}
        {selectedPatient && (
          <div>
            <label className="block mb-1 text-sm font-medium">Select Encounter</label>
            <Select
              value={selectedEncounter?.id || ''}
              onValueChange={(val) => {
                const enc = patientEncounters.find((e) => e.id === val) || null;
                setSelectedEncounter(enc);
              }}
            >
              <SelectTrigger className="w-full max-w-xl">
                <SelectValue placeholder="Choose encounter" />
              </SelectTrigger>
              <SelectContent className="w-[48rem] max-w-[48rem]">
                {patientEncounters.length > 0 ? (
                  patientEncounters
                    .sort((a, b) => new Date(b.scheduledStart).getTime() - new Date(a.scheduledStart).getTime())
                    .map((enc) => (
                      <SelectItem key={enc.id} value={enc.id} className="max-w-full">
                        <span className="truncate">
                          {new Date(enc.scheduledStart).toLocaleDateString()} - {enc.reasonDisplayText || enc.reasonCode || 'Encounter'}
                        </span>
                      </SelectItem>
                    ))
                ) : (
                  <div className="text-sm p-2 text-muted-foreground">No encounters</div>
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Continue Button */}
        <div className="flex justify-end pt-2">
          <Button
            disabled={!selectedPatient || !selectedEncounter}
            onClick={handleContinueToForm}
          >
            Continue
          </Button>
        </div>
      </div>
    );
  };

  const diagnoses: Diagnosis[] = selectedPatient && selectedEncounter ? supabaseDataService.getDiagnosesForEncounter(selectedPatient.id, selectedEncounter.id) : [];
  const labResults: LabResult[] = selectedPatient && selectedEncounter ? supabaseDataService.getLabResultsForEncounter(selectedPatient.id, selectedEncounter.id) : [];

  const renderFormStep = () => {
    if (!selectedPatient || !selectedEncounter) {
      return <p className="text-sm text-muted-foreground">Missing patient or encounter.</p>;
    }

    // Use clean encounter data (excluding rich content fields)
    const cleanEncounter = {
      ...selectedEncounter,
      // Explicitly exclude rich content fields - we want to use basic treatments and diagnosis
      diagnosis_rich_content: undefined,
      treatments_rich_content: undefined
    };

    return (
      <div className="max-h-[70vh] overflow-y-auto w-full">
        {formType === 'priorAuth' ? (
          <PriorAuthorizationForm
            patient={selectedPatient}
            encounter={cleanEncounter}
            diagnoses={diagnoses}
            onSave={async () => {}}
            onGeneratePDF={async () => {}}
          />
        ) : (
          <ReferralForm
            patient={selectedPatient}
            encounter={cleanEncounter}
            diagnoses={diagnoses}
            labResults={labResults}
            onSave={async () => {}}
            onGeneratePDF={async () => {}}
          />
        )}
      </div>
    );
  };

  /* -------------------- Render -------------------- */
  const titleText = formType === 'priorAuth' ? 'Prior Authorization' : 'Referral';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{/* hidden */}</DialogTrigger>
      <DialogContent className="min-w-[720px] max-w-3xl max-h-[calc(100vh-80px)] overflow-auto p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {titleText}
          </DialogTitle>
        </DialogHeader>
        <div className="pt-4">
          {step === 'select' ? renderSelectionStep() : renderFormStep()}
        </div>
        {step === 'form' && (
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setStep('select')} className="mr-auto">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button variant="secondary" onClick={handleClose}>
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
} 
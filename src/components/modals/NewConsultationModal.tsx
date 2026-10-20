'use client';

import React, { useEffect, useState, forwardRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogTrigger, DraggableDialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Patient } from '@/lib/types';
import { useRouter } from 'next/navigation';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { X } from '@phosphor-icons/react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { PlusCircle, UserPlus, MagnifyingGlass, PlayCircle } from "@phosphor-icons/react";
import { supabaseDataService } from '@/lib/supabaseDataService';
import type { Encounter } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ModalDragAndMinimizeConfig } from '@/types/modal';

interface Props {
  /** Controls open state from parent */
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConsultationCreated?: (patient: Patient | null, newEncounter: Encounter | null) => void;
  /** Enable draggable functionality */
  draggable?: boolean;
  /** Allow dragging behavior (separate from modal functionality) */
  allowDragging?: boolean;
  /** Configuration for drag and minimize behavior */
  draggableConfig?: ModalDragAndMinimizeConfig;
}

// Custom DatePicker wrapper component
const StyledDatePicker = forwardRef<DatePicker, any>(({ value, onClick, onChange, placeholderText, className, selected, ...props }, ref) => {
  // The input's own text (the selected date) should use text-step--1.
  // The placeholder text will be styled by global ::placeholder rules.
  const inputClassName = cn(
    "w-full px-3 py-2 border rounded-md bg-transparent text-step--1 font-sans focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shadow-sm",
    className // Allow overriding via prop
  );

  // If react-datepicker sets the value to the placeholderText when !selected,
  // we might need to style it. However, it usually uses a real placeholder attribute.
  const textStyle = selected ? {} : { 
    // Only apply if value itself is the placeholder, otherwise let ::placeholder handle it
    // This is a safety net, ideally not needed if placeholder attribute is used.
    // color: !value || value === placeholderText ? 'var(--placeholder-color)' : 'inherit',
    // opacity: !value || value === placeholderText ? 'var(--placeholder-opacity)' : 1,
  };

  return (
    // className from props is now applied to the input directly via inputClassName merge
    <div className="react-datepicker-wrapper" style={{ width: '100%' }}> 
      <DatePicker
        ref={ref}
        selected={selected}
        onChange={onChange}
        placeholderText={placeholderText}
        {...props}
        customInput={<input value={value} onClick={onClick} onChange={onChange} placeholder={placeholderText} className={inputClassName} style={textStyle} />}
      />
    </div>
  );
});
StyledDatePicker.displayName = 'StyledDatePicker';

export default function NewConsultationModal({ open, onOpenChange, onConsultationCreated, draggable, allowDragging, draggableConfig }: Props) {
  const [tab, setTab] = useState<'existing' | 'new'>('existing');
  const router = useRouter();

  // Existing patients search
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // New patient form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState<Date | null>(null);

  // Shared fields
  const [reason, setReason] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  // Validation
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      // Reset all form state
      setTab('existing');
      setSearchTerm('');
      setSelectedPatient(null);
      setFirstName('');
      setLastName('');
      setGender('');
      setDob(null);
      setReason('');
      setScheduledDate(null);
      setDuration(null);
      setErrors({});
      setShake(false);
      setIsCreating(false);
    }
  }, [open]);

  useEffect(() => {
    const loadInitialData = async () => {
      if (open) { // Only run if modal is open
        try {
          if (supabaseDataService.getAllPatients().length === 0) {
            await supabaseDataService.loadPatientData();
          }
          setAllPatients(supabaseDataService.getAllPatients());
        } catch (e) {
          setLoadError(e instanceof Error ? e.message : String(e));
        }
        // Removed the creation logic from here, it's handled by handleCreate
      }
    };
    loadInitialData();
  }, [open]); // Only dependent on 'open'

  const filteredPatients = allPatients.filter((p) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.name?.toLowerCase().includes(term) ||
      p.firstName?.toLowerCase().includes(term) ||
      p.lastName?.toLowerCase().includes(term) ||
      p.id.toLowerCase().includes(term)
    );
  });

  const handleCreate = async () => {
    // Prevent double-clicking
    if (isCreating) return;
    
    // reset errors
    const newErrors: Record<string, boolean> = {};
    if (tab === 'existing') {
      if (!selectedPatient) newErrors.selectedPatient = true;
    } else {
      if (!firstName.trim()) newErrors.firstName = true;
      if (!lastName.trim()) newErrors.lastName = true;
      if (!gender) newErrors.gender = true;
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      // trigger shake animation
      setShake(true);
      setTimeout(() => setShake(false), 600);
      return;
    }
    try {
      setIsCreating(true);
      let createdPatient: Patient | null = null;
      let createdEncounter: Encounter | null = null;

      if (tab === 'existing') {
        if (!selectedPatient) return;
        const enc = await supabaseDataService.createNewEncounter(selectedPatient.id, {
          reason: reason || undefined,
          scheduledStart: scheduledDate ? scheduledDate.toISOString() : undefined,
          duration: duration || undefined,
        });
        createdPatient = selectedPatient;
        createdEncounter = enc;
        
        // Close the modal FIRST to reset its state
        onOpenChange(false);
        
        // Navigate to the patient page with the new encounter and auto-start transcription
        router.push(`/patients/${selectedPatient.id}?tab=consultation&encounterId=${enc.id}&autoStartTranscription=true`);
        
        // Don't call onConsultationCreated after navigation to prevent double navigation
        return;
      } else {
        const { patient, encounter } = await supabaseDataService.createNewPatientWithEncounter(
          { firstName, lastName, gender, dateOfBirth: dob ? format(dob, 'yyyy-MM-dd') : undefined },
          { reason: reason || undefined, scheduledStart: scheduledDate ? scheduledDate.toISOString() : undefined, duration: duration || undefined }
        );
        createdPatient = patient;
        createdEncounter = encounter;
        
        // Close the modal FIRST to reset its state
        onOpenChange(false);
        
        // Navigate to the patient page with the new encounter and auto-start transcription
        router.push(`/patients/${patient.id}?tab=consultation&encounterId=${encounter.id}&autoStartTranscription=true`);
        
        // Don't call onConsultationCreated after navigation to prevent double navigation
        return;
      }
    } catch (e) {
      console.error('Failed to create consultation', e);
      alert('Could not start consultation. See console for details.');
    } finally {
      setIsCreating(false);
    }
  };

  // Stable draggable config to prevent infinite loops
  const stableDraggableConfig = useMemo(() => {
    if (!draggable || !draggableConfig) return undefined;
    
    // Return a stable config object
    return {
      id: draggableConfig.id,
      title: draggableConfig.title || 'New Consultation',
      icon: draggableConfig.icon,
      persistent: draggableConfig.persistent ?? false,
      defaultPosition: draggableConfig.defaultPosition,
    };
  }, [
    draggable, 
    draggableConfig?.id, 
    draggableConfig?.title, 
    draggableConfig?.persistent,
    draggableConfig?.icon,
    // Note: Not including defaultPosition since it can contain unstable window calculations
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{/* hidden trigger; open controlled externally */}</DialogTrigger>
      {draggable || stableDraggableConfig ? (
        <DraggableDialogContent
          onCloseAutoFocus={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={`max-w-2xl max-h-[calc(100svh-2rem)] overflow-auto pb-4 ${shake ? 'animate-shake' : ''}`}
          draggable={draggable && open}
          allowDragging={allowDragging}
          draggableConfig={stableDraggableConfig}
        >
          <DialogHeader>
            <DialogTitle>Start New Consultation</DialogTitle>
            {loadError ? <p role="alert" className="text-sm text-critical">{loadError}</p> : null}
          </DialogHeader>
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
            <TabsList className="mb-4 w-full justify-start">
              <TabsTrigger value="existing">Existing Patient</TabsTrigger>
              <TabsTrigger value="new">New Patient</TabsTrigger>
            </TabsList>

            {/* Existing patient tab */}
            <TabsContent value="existing">
              <div className="space-y-3">
                <label className="text-sm font-medium flex items-center">
                  Select patient <span className="text-destructive">*</span>{errors.selectedPatient && <span className="text-destructive text-xs ml-2">Required field</span>}
                </label>
                <div className="transition-all duration-200 ease-in-out">
                  {selectedPatient ? (
                    <div className="border rounded-md px-3 py-2 flex justify-between items-center bg-muted/20">
                      <span className="text-step--1">{selectedPatient.name || `${selectedPatient.firstName ?? ''} ${selectedPatient.lastName ?? ''}`.trim() || selectedPatient.id}</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-6 p-0" 
                        onClick={() => setSelectedPatient(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="border rounded-md overflow-hidden">
                      <div className="relative border-b p-1">
                        <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-text-placeholder" />
                        <Input
                          placeholder="Search patient by name or ID..."
                          className="pl-10 text-step--1"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {filteredPatients.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => setSelectedPatient(p)}
                            className="px-3 py-2 cursor-pointer hover:bg-muted/50 text-step--1 text-ink"
                          >
                            {p.name || `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || p.id}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="consultReason" className="text-sm font-medium">Reason for encounter</Label>
                  <Textarea 
                    id="consultReason"
                    placeholder="E.g., joint pain, generalized inflammation"
                    className="mt-1 text-step--1"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Date and time</label>
                  <StyledDatePicker
                    placeholderText={format(new Date(), 'Pp')}
                    selected={scheduledDate}
                    onChange={(d: Date | null) => setScheduledDate(d)}
                    showTimeSelect
                    timeInputLabel="Time:"
                    dateFormat="MM/dd/yyyy, h:mm aa"
                    className="mt-1"
                    timeIntervals={1}
                    popperClassName="z-[60]"
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Duration</label>
                  <select
                    value={duration || ''}
                    onChange={(e) => setDuration(e.target.value ? parseInt(e.target.value) : null)}
                    className={cn(
                      "w-full mt-1 px-3 py-2 border rounded-md bg-transparent text-step--1 font-sans focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shadow-sm",
                      !duration ? "text-ink" : "text-foreground opacity-100"
                    )}
                  >
                    <option value="" disabled>Select duration</option>
                    {Array.from({ length: 24 }, (_, i) => (i + 1) * 5).map(minutes => (
                      <option key={minutes} value={minutes}>{minutes} min</option>
                    ))}
                  </select>
                </div>
              </div>
            </TabsContent>

            {/* New patient tab */}
            <TabsContent value="new">
              <div className="space-y-3">
                <p className="text-sm font-medium">Patient info</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm font-medium">First name <span className="text-destructive">*</span></label>
                    <Input
                      placeholder="First name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="mt-1 text-step--1"
                    />
                    {errors.firstName && <span className="text-destructive text-xs ml-1">Required field</span>}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Last name <span className="text-destructive">*</span></label>
                    <Input
                      placeholder="Last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="mt-1 text-step--1"
                    />
                    {errors.lastName && <span className="text-destructive text-xs ml-1">Required field</span>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm font-medium">Gender <span className="text-destructive">*</span></label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className={cn(
                        "w-full mt-1 px-3 py-2 border rounded-md bg-transparent text-step--1 font-sans focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shadow-sm",
                        !gender ? "text-ink" : "text-foreground opacity-100"
                      )}
                    >
                      <option value="" disabled className="text-muted-foreground">
                        Select gender
                      </option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Date of Birth</label>
                    <StyledDatePicker
                      placeholderText="dd/mm/yyyy"
                      selected={dob}
                      onChange={(d: Date | null) => setDob(d)}
                      dateFormat="dd/MM/yyyy"
                      className="mt-1"
                      showYearDropdown
                      showMonthDropdown
                      dropdownMode="select"
                      maxDate={new Date()}
                      popperClassName="z-[60]"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="consultReasonSm" className="text-sm font-medium">Reason for encounter</Label>
                  <Textarea 
                    id="consultReasonSm"
                    placeholder="E.g., joint pain, generalized inflammation"
                    className="mt-1 text-step--1"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Date and time</label>
                  <StyledDatePicker
                    placeholderText={format(new Date(), 'Pp')}
                    selected={scheduledDate}
                    onChange={(d: Date | null) => setScheduledDate(d)}
                    showTimeSelect
                    timeInputLabel="Time:"
                    dateFormat="MM/dd/yyyy, h:mm aa"
                    className="mt-1"
                    timeIntervals={1}
                    popperClassName="z-[60]"
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Duration</label>
                  <select
                    value={duration || ''}
                    onChange={(e) => setDuration(e.target.value ? parseInt(e.target.value) : null)}
                    className={cn(
                      "w-full mt-1 px-3 py-2 border rounded-md bg-transparent text-step--1 font-sans focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shadow-sm",
                      !duration ? "text-ink" : "text-foreground opacity-100"
                    )}
                  >
                    <option value="" disabled>Select duration</option>
                    {Array.from({ length: 24 }, (_, i) => (i + 1) * 5).map(minutes => (
                      <option key={minutes} value={minutes}>{minutes} min</option>
                    ))}
                  </select>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              variant="default" 
              iconLeft={<PlayCircle />} 
              onClick={handleCreate}
              onFocus={(e) => {
                // Prevent accidental activation when focus is moved during modal close
                if (!open) {
                  e.target.blur();
                }
              }}
              disabled={isCreating}
            >
              {isCreating ? 'Creating...' : 'Start Consultation'}
            </Button>
          </div>
        </DraggableDialogContent>
      ) : (
        <DialogContent
          onCloseAutoFocus={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={`max-w-2xl max-h-[calc(100svh-2rem)] overflow-auto pb-4 ${shake ? 'animate-shake' : ''}`}
        >
          <DialogHeader>
            <DialogTitle>Start New Consultation</DialogTitle>
            {loadError ? <p role="alert" className="text-sm text-critical">{loadError}</p> : null}
          </DialogHeader>
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
            <TabsList className="mb-4 w-full justify-start">
              <TabsTrigger value="existing">Existing Patient</TabsTrigger>
              <TabsTrigger value="new">New Patient</TabsTrigger>
            </TabsList>

            {/* Existing patient tab */}
            <TabsContent value="existing">
              <div className="space-y-3">
                <label className="text-sm font-medium flex items-center">
                  Select patient <span className="text-destructive">*</span>{errors.selectedPatient && <span className="text-destructive text-xs ml-2">Required field</span>}
                </label>
                <div className="transition-all duration-200 ease-in-out">
                  {selectedPatient ? (
                    <div className="border rounded-md px-3 py-2 flex justify-between items-center bg-muted/20">
                      <span className="text-step--1">{selectedPatient.name || `${selectedPatient.firstName ?? ''} ${selectedPatient.lastName ?? ''}`.trim() || selectedPatient.id}</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-6 p-0" 
                        onClick={() => setSelectedPatient(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="border rounded-md overflow-hidden">
                      <div className="relative border-b p-1">
                        <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-text-placeholder" />
                        <Input
                          placeholder="Search patient by name or ID..."
                          className="pl-10 text-step--1"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {filteredPatients.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => setSelectedPatient(p)}
                            className="px-3 py-2 cursor-pointer hover:bg-muted/50 text-step--1 text-ink"
                          >
                            {p.name || `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || p.id}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="consultReason" className="text-sm font-medium">Reason for encounter</Label>
                  <Textarea 
                    id="consultReason"
                    placeholder="E.g., joint pain, generalized inflammation"
                    className="mt-1 text-step--1"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Date and time</label>
                  <StyledDatePicker
                    placeholderText={format(new Date(), 'Pp')}
                    selected={scheduledDate}
                    onChange={(d: Date | null) => setScheduledDate(d)}
                    showTimeSelect
                    timeInputLabel="Time:"
                    dateFormat="MM/dd/yyyy, h:mm aa"
                    className="mt-1"
                    timeIntervals={1}
                    popperClassName="z-[60]"
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Duration</label>
                  <select
                    value={duration || ''}
                    onChange={(e) => setDuration(e.target.value ? parseInt(e.target.value) : null)}
                    className={cn(
                      "w-full mt-1 px-3 py-2 border rounded-md bg-transparent text-step--1 font-sans focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shadow-sm",
                      !duration ? "text-ink" : "text-foreground opacity-100"
                    )}
                  >
                    <option value="" disabled>Select duration</option>
                    {Array.from({ length: 24 }, (_, i) => (i + 1) * 5).map(minutes => (
                      <option key={minutes} value={minutes}>{minutes} min</option>
                    ))}
                  </select>
                </div>
              </div>
            </TabsContent>

            {/* New patient tab */}
            <TabsContent value="new">
              <div className="space-y-3">
                <p className="text-sm font-medium">Patient info</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm font-medium">First name <span className="text-destructive">*</span></label>
                    <Input
                      placeholder="First name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="mt-1 text-step--1"
                    />
                    {errors.firstName && <span className="text-destructive text-xs ml-1">Required field</span>}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Last name <span className="text-destructive">*</span></label>
                    <Input
                      placeholder="Last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="mt-1 text-step--1"
                    />
                    {errors.lastName && <span className="text-destructive text-xs ml-1">Required field</span>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm font-medium">Gender <span className="text-destructive">*</span></label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className={cn(
                        "w-full mt-1 px-3 py-2 border rounded-md bg-transparent text-step--1 font-sans focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shadow-sm",
                        !gender ? "text-ink" : "text-foreground opacity-100"
                      )}
                    >
                      <option value="" disabled className="text-muted-foreground">
                        Select gender
                      </option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Date of Birth</label>
                    <StyledDatePicker
                      placeholderText="dd/mm/yyyy"
                      selected={dob}
                      onChange={(d: Date | null) => setDob(d)}
                      dateFormat="dd/MM/yyyy"
                      className="mt-1"
                      showYearDropdown
                      showMonthDropdown
                      dropdownMode="select"
                      maxDate={new Date()}
                      popperClassName="z-[60]"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="consultReasonSm" className="text-sm font-medium">Reason for encounter</Label>
                  <Textarea 
                    id="consultReasonSm"
                    placeholder="E.g., joint pain, generalized inflammation"
                    className="mt-1 text-step--1"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Date and time</label>
                  <StyledDatePicker
                    placeholderText={format(new Date(), 'Pp')}
                    selected={scheduledDate}
                    onChange={(d: Date | null) => setScheduledDate(d)}
                    showTimeSelect
                    timeInputLabel="Time:"
                    dateFormat="MM/dd/yyyy, h:mm aa"
                    className="mt-1"
                    timeIntervals={1}
                    popperClassName="z-[60]"
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Duration</label>
                  <select
                    value={duration || ''}
                    onChange={(e) => setDuration(e.target.value ? parseInt(e.target.value) : null)}
                    className={cn(
                      "w-full mt-1 px-3 py-2 border rounded-md bg-transparent text-step--1 font-sans focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shadow-sm",
                      !duration ? "text-ink" : "text-foreground opacity-100"
                    )}
                  >
                    <option value="" disabled>Select duration</option>
                    {Array.from({ length: 24 }, (_, i) => (i + 1) * 5).map(minutes => (
                      <option key={minutes} value={minutes}>{minutes} min</option>
                    ))}
                  </select>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              variant="default" 
              iconLeft={<PlayCircle />} 
              onClick={handleCreate}
              onFocus={(e) => {
                // Prevent accidental activation when focus is moved during modal close
                if (!open) {
                  e.target.blur();
                }
              }}
              disabled={isCreating}
            >
              {isCreating ? 'Creating...' : 'Start Consultation'}
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
} 
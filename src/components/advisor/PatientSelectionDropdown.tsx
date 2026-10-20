'use client';

import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Patient } from '@/lib/types';
import { supabaseDataService } from '@/lib/supabaseDataService';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { X, Upload } from '@phosphor-icons/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  onPatientSelect: (patient: Patient) => void;
  onFileUpload: () => void;
}

export default function PatientSelectionDropdown({ onPatientSelect, onFileUpload }: Props) {
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  useEffect(() => {
    const loadPatients = async () => {
      try {
        if (supabaseDataService.getAllPatients().length === 0) {
          await supabaseDataService.loadPatientData();
        }
        setAllPatients(supabaseDataService.getAllPatients());
      } catch {
        setAllPatients([]); // the list shows its empty state
      }
    };
    loadPatients();
  }, []);

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

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    onPatientSelect(patient);
  };

  return (
    <DropdownMenuContent className="w-72" side="top" align="end">
      {selectedPatient ? (
        <div className="border rounded-md px-3 py-2 flex justify-between items-center bg-muted/20 m-1">
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
        <div className="border rounded-md overflow-hidden m-1">
          <div className="border-b p-1">
            <Input
              placeholder="Search patient by name or ID..."
              className="text-step--1"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="max-h-40 overflow-y-auto">
            {filteredPatients.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => handleSelectPatient(p)}
                className="px-3 py-2 cursor-pointer hover:bg-muted/50 text-step--1 text-[var(--placeholder-color)] opacity-[var(--placeholder-opacity)]"
              >
                {p.name || `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || p.id}
              </DropdownMenuItem>
            ))}
          </div>
        </div>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onFileUpload} className="cursor-pointer">
        <Upload className="mr-2 h-4 w-4" />
        Upload a photo or file
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
} 
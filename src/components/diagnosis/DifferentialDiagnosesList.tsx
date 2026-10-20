'use client';

import React, { useState } from 'react';
import { DifferentialDiagnosis } from '@/lib/types';
import DifferentialDiagnosisCard from './DifferentialDiagnosisCard';
import EditableDifferentialDiagnosisCard from './EditableDifferentialDiagnosisCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CircleNotch, Stethoscope, Plus, Check, X } from '@phosphor-icons/react';
import { getDecimalForCategory, LikelihoodCategory } from '@/lib/likelihood';

interface DifferentialDiagnosesListProps {
  diagnoses: DifferentialDiagnosis[];
  isLoading?: boolean;
  isEditable?: boolean;
  onEditDiagnosis?: (diagnosis: DifferentialDiagnosis, index: number) => void;
  onSaveDiagnosis?: (
    diagnosis: DifferentialDiagnosis,
    index: number,
  ) => Promise<void>;
  onDeleteDiagnosis?: (index: number) => Promise<void>;
  onAddDiagnosis?: (
    diagnosis: Omit<DifferentialDiagnosis, 'rank'>,
  ) => Promise<void>;
  maxCount?: number;
  className?: string;
}

export default function DifferentialDiagnosesList({
  diagnoses,
  isLoading = false,
  isEditable = false,
  onEditDiagnosis,
  onSaveDiagnosis,
  onDeleteDiagnosis,
  onAddDiagnosis,
  maxCount = 5,
  className = '',
}: DifferentialDiagnosesListProps) {
  // State for adding new diagnosis
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newDiagnosisName, setNewDiagnosisName] = useState('');
  const [newDiagnosisLikelihood, setNewDiagnosisLikelihood] =
    useState<LikelihoodCategory>('Moderate');
  const [newDiagnosisKeyFactors, setNewDiagnosisKeyFactors] = useState('');

  // Handler for adding new diagnosis
  const handleAddNew = async () => {
    if (!newDiagnosisName.trim() || !onAddDiagnosis) return;

    const probabilityDecimal = getDecimalForCategory(newDiagnosisLikelihood);

    const newDiagnosis: Omit<DifferentialDiagnosis, 'rank'> = {
      name: newDiagnosisName.trim(),
      qualitativeRisk: newDiagnosisLikelihood,
      probabilityDecimal,
      keyFactors: newDiagnosisKeyFactors.trim(),
      explanation: '',
      supportingEvidence: [],
      icdCodes: [],
      // For backward compatibility
      likelihood: newDiagnosisLikelihood,
      likelihoodPercentage: probabilityDecimal,
    };

    try {
      await onAddDiagnosis(newDiagnosis);
      // Reset form
      setNewDiagnosisName('');
      setNewDiagnosisLikelihood('Moderate');
      setNewDiagnosisKeyFactors('');
      setIsAddingNew(false);
    } catch (error) {
      console.error('Error adding new diagnosis:', error);
    }
  };

  const handleCancelAdd = () => {
    setNewDiagnosisName('');
    setNewDiagnosisLikelihood('Moderate');
    setNewDiagnosisKeyFactors('');
    setIsAddingNew(false);
  };

  if (isLoading) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${className}`}>
        <div className="flex items-center space-x-2">
          <CircleNotch className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Generating differential diagnoses...</span>
        </div>
      </div>
    );
  }

  if (!diagnoses || diagnoses.length === 0) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${className}`}>
        <div className="flex flex-col items-center space-y-3">
          <Stethoscope className="h-8 w-8 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm text-muted-foreground/70">No differential diagnoses recorded for this consultation</p>
            <p className="text-xs text-muted-foreground mt-1">
              Differential diagnoses will appear here once the clinical engine processes the consultation
            </p>
          </div>
          {isEditable && onAddDiagnosis && (
            <Button
              onClick={() => setIsAddingNew(true)}
              variant="outline"
              className="mt-4"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Diagnosis
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Limit the number of diagnoses displayed
  const displayedDiagnoses = diagnoses.slice(0, maxCount);

  return (
    <div className={`w-full flex flex-col ${className}`}>
      {/* Header - Fixed at top */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Differential Diagnoses</h3>
          <p className="text-sm text-muted-foreground">
            {diagnoses.length} diagnos{diagnoses.length === 1 ? 'is' : 'es'} ranked by likelihood
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isEditable && onAddDiagnosis && !isAddingNew && (
            <Button
              onClick={() => setIsAddingNew(true)}
              variant="outline"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Diagnosis
            </Button>
          )}
          {diagnoses.length > maxCount && (
            <span className="text-xs text-muted-foreground">
              Showing top {maxCount} of {diagnoses.length}
            </span>
          )}
        </div>
      </div>

      {/* Diagnoses Grid - Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="space-y-4 pr-2">
          {/* Add new diagnosis form */}
          {isAddingNew && (
            <Card className="w-full border-l-4 border-l-green-500 bg-ok-soft/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-ok-soft text-ok rounded-full text-sm font-semibold">
                    +
                  </div>
                  <h4 className="text-lg font-semibold text-ink">New Differential Diagnosis</h4>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-ink-2 block mb-1">
                    Diagnosis Name
                  </label>
                  <Input
                    value={newDiagnosisName}
                    onChange={(e) => setNewDiagnosisName(e.target.value)}
                    placeholder="Enter diagnosis name"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-2 block mb-1">
                    Likelihood
                  </label>
                  <Select
                    value={newDiagnosisLikelihood}
                    onValueChange={(value) =>
                      setNewDiagnosisLikelihood(value as LikelihoodCategory)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select likelihood" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Certain">Certain</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Moderate">Moderate</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Negligible">Negligible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-ink-2 block mb-1">
                    Key Factors
                  </label>
                  <Textarea
                    value={newDiagnosisKeyFactors}
                    onChange={(e) => setNewDiagnosisKeyFactors(e.target.value)}
                    placeholder="Key factors supporting this diagnosis"
                    rows={2}
                    className="w-full"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleAddNew}
                    disabled={!newDiagnosisName.trim()}
                    size="sm"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Add Diagnosis
                  </Button>
                  <Button
                    onClick={handleCancelAdd}
                    variant="outline"
                    size="sm"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Existing diagnoses */}
          {displayedDiagnoses.map((diagnosis, index) => {
            // Use editable cards if we have the new editing props, otherwise fall back to original cards
            if (isEditable && onSaveDiagnosis && onDeleteDiagnosis) {
              return (
                <EditableDifferentialDiagnosisCard
                  key={`${diagnosis.name}-${index}`}
                  diagnosis={diagnosis}
                  onSave={(updatedDiagnosis) =>
                    onSaveDiagnosis(updatedDiagnosis, index)
                  }
                  onDelete={() => onDeleteDiagnosis(index)}
                />
              );
            } else {
              // Fall back to original component for backward compatibility
              return (
                <DifferentialDiagnosisCard
                  key={`${diagnosis.name}-${index}`}
                  diagnosis={diagnosis}
                  isEditable={isEditable}
                  onEdit={
                    onEditDiagnosis
                      ? (d) => onEditDiagnosis(d, index)
                      : undefined
                  }
                />
              );
            }
          })}
        </div>
      </div>

      {/* Footer info for truncated list - Fixed at bottom */}
      {diagnoses.length > maxCount && (
        <div className="flex-shrink-0 text-center pt-4 mt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            {diagnoses.length - maxCount} additional diagnos{diagnoses.length - maxCount === 1 ? 'is' : 'es'} not shown
          </p>
        </div>
      )}
    </div>
  );
} 
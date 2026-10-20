'use client';

import React, { useState, useEffect } from 'react';
import { DifferentialDiagnosis } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowCounterClockwise, 
  ArrowClockwise, 
  FloppyDisk, 
  X, 
  PencilSimple 
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { getDecimalForCategory, LikelihoodCategory } from '@/lib/likelihood';
import LikelihoodIndicator from './LikelihoodIndicator';

interface EditableDifferentialDiagnosisCardProps {
  diagnosis: DifferentialDiagnosis;
  onSave?: (updatedDiagnosis: DifferentialDiagnosis) => Promise<void>;
  onDelete?: () => Promise<void>;
  className?: string;
}

interface FieldHistory {
  past: string[];
  present: string;
  future: string[];
}

const createFieldHistory = (initialValue: string): FieldHistory => ({
  past: [],
  present: initialValue,
  future: []
});

export default function EditableDifferentialDiagnosisCard({
  diagnosis,
  onSave,
  onDelete,
  className = '',
}: EditableDifferentialDiagnosisCardProps) {
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Field histories for undo/redo functionality
  const [nameHistory, setNameHistory] = useState(() => createFieldHistory(diagnosis.name));
  const [likelihoodHistory, setLikelihoodHistory] = useState(() => createFieldHistory(diagnosis.qualitativeRisk));
  const [keyFactorsHistory, setKeyFactorsHistory] = useState(() => createFieldHistory(diagnosis.keyFactors));

  // Update histories when diagnosis changes
  useEffect(() => {
    setNameHistory(createFieldHistory(diagnosis.name));
    setLikelihoodHistory(createFieldHistory(diagnosis.qualitativeRisk));
    setKeyFactorsHistory(createFieldHistory(diagnosis.keyFactors));
  }, [diagnosis.name, diagnosis.qualitativeRisk, diagnosis.keyFactors]);

  // Helper functions for history management
  const updateHistory = (
    currentHistory: FieldHistory,
    newValue: string,
    setHistory: React.Dispatch<React.SetStateAction<FieldHistory>>
  ) => {
    if (newValue !== currentHistory.present) {
      setHistory({
        past: [...currentHistory.past, currentHistory.present],
        present: newValue,
        future: []
      });
    }
  };

  const undo = (
    currentHistory: FieldHistory,
    setHistory: React.Dispatch<React.SetStateAction<FieldHistory>>
  ) => {
    if (currentHistory.past.length > 0) {
      const previous = currentHistory.past[currentHistory.past.length - 1];
      setHistory({
        past: currentHistory.past.slice(0, -1),
        present: previous,
        future: [currentHistory.present, ...currentHistory.future]
      });
    }
  };

  const redo = (
    currentHistory: FieldHistory,
    setHistory: React.Dispatch<React.SetStateAction<FieldHistory>>
  ) => {
    if (currentHistory.future.length > 0) {
      const next = currentHistory.future[0];
      setHistory({
        past: [...currentHistory.past, currentHistory.present],
        present: next,
        future: currentHistory.future.slice(1)
      });
    }
  };

  // Save handler
  const handleSave = async () => {
    if (!onSave) return;
    
    setIsSaving(true);
    try {
      const qualitativeRisk =
        likelihoodHistory.present as LikelihoodCategory;
      const probabilityDecimal = getDecimalForCategory(qualitativeRisk);

      const updatedDiagnosis: DifferentialDiagnosis = {
        ...diagnosis,
        name: nameHistory.present,
        qualitativeRisk,
        probabilityDecimal,
        keyFactors: keyFactorsHistory.present,
        // For backward compatibility
        likelihood: qualitativeRisk,
        likelihoodPercentage: probabilityDecimal,
      };
      
      await onSave(updatedDiagnosis);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving diagnosis:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!onDelete) return;
    
    if (window.confirm('Are you sure you want to delete this differential diagnosis?')) {
      try {
        await onDelete();
      } catch (error) {
        console.error('Error deleting diagnosis:', error);
      }
    }
  };

  // Field editor component
  const FieldEditor = ({ 
    value, 
    onChange, 
    history, 
    setHistory, 
    type = 'text',
    placeholder = '',
    className: fieldClassName = ''
  }: {
    value: string;
    onChange: (value: string) => void;
    history: FieldHistory;
    setHistory: React.Dispatch<React.SetStateAction<FieldHistory>>;
    type?: 'text' | 'textarea' | 'select';
    placeholder?: string;
    className?: string;
  }) => (
    <div className={cn("flex items-center gap-1", fieldClassName)}>
      {type === 'text' && (
        <Input
          value={value}
          onChange={(e) => {
            const newValue = e.target.value;
            onChange(newValue);
            updateHistory(history, newValue, setHistory);
          }}
          placeholder={placeholder}
          className="flex-1"
        />
      )}
      
      {type === 'textarea' && (
        <Textarea
          value={value}
          onChange={(e) => {
            const newValue = e.target.value;
            onChange(newValue);
            updateHistory(history, newValue, setHistory);
          }}
          placeholder={placeholder}
          className="flex-1 min-h-[60px]"
          rows={2}
        />
      )}
      
      {type === 'select' && (
        <Select
          value={value}
          onValueChange={(newValue) => {
            onChange(newValue);
            updateHistory(history, newValue, setHistory);
          }}
        >
          <SelectTrigger className="flex-1">
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
      )}
      
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => undo(history, setHistory)}
          disabled={history.past.length === 0}
          title="Undo"
        >
          <ArrowCounterClockwise className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => redo(history, setHistory)}
          disabled={history.future.length === 0}
          title="Redo"
        >
          <ArrowClockwise className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );

  return (
    <Card className={cn("w-full border-l-4 border-l-blue-500", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center justify-center w-8 h-8 bg-info-soft text-info rounded-full text-sm font-semibold">
              #{diagnosis.rank}
            </div>
            
            {isEditing ? (
              <div className="flex-1">
                <FieldEditor
                  value={nameHistory.present}
                  onChange={() => {}} // onChange is handled in FieldEditor
                  history={nameHistory}
                  setHistory={setNameHistory}
                  type="text"
                  placeholder="Diagnosis name"
                  className="mb-2"
                />
              </div>
            ) : (
              <div className="flex-1">
                <CardTitle className="text-lg font-semibold text-ink">
                  {diagnosis.name}
                </CardTitle>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 ml-3">
            {isEditing ? (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  title="Save"
                >
                  <FloppyDisk className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  title="Delete"
                  className="text-critical hover:text-critical"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                title="Edit"
              >
                <PencilSimple className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Likelihood */}
        <div>
          <label className="text-sm font-medium text-ink-2 block mb-1">
            Likelihood
          </label>
          {isEditing ? (
            <FieldEditor
              value={likelihoodHistory.present}
              onChange={() => {}} // onChange is handled in FieldEditor
              history={likelihoodHistory}
              setHistory={setLikelihoodHistory}
              type="select"
            />
          ) : (
            <LikelihoodIndicator
              probabilityDecimal={diagnosis.probabilityDecimal}
              size="sm"
              showProgressBar={false}
            />
          )}
        </div>

        {/* Key Factors */}
        <div>
          <label className="text-sm font-medium text-ink-2 block mb-1">
            Key Factors
          </label>
          {isEditing ? (
            <FieldEditor
              value={keyFactorsHistory.present}
              onChange={() => {}} // onChange is handled in FieldEditor
              history={keyFactorsHistory}
              setHistory={setKeyFactorsHistory}
              type="textarea"
              placeholder="Key factors supporting this diagnosis"
            />
          ) : (
            <p className="text-sm text-ink">
              {diagnosis.keyFactors || 'No key factors recorded'}
            </p>
          )}
        </div>

        {/* Additional fields (if they exist in the diagnosis) */}
        {diagnosis.explanation && !isEditing && (
          <div>
            <label className="text-sm font-medium text-ink-2 block mb-1">
              Explanation
            </label>
            <p className="text-sm text-ink">{diagnosis.explanation}</p>
          </div>
        )}

        {Array.isArray(diagnosis.supportingEvidence) && diagnosis.supportingEvidence.length > 0 && !isEditing && (
          <div>
            <label className="text-sm font-medium text-ink-2 block mb-1">
              Supporting Evidence
            </label>
            <ul className="text-sm text-ink list-disc list-inside space-y-1">
              {(diagnosis.supportingEvidence || []).map((evidence, index) => (
                <li key={index}>{evidence}</li>
              ))}
            </ul>
          </div>
        )}

        {Array.isArray(diagnosis.icdCodes) && diagnosis.icdCodes.length > 0 && !isEditing && (
          <div>
            <label className="text-sm font-medium text-ink-2 block mb-1">
              ICD Codes
            </label>
            <div className="flex flex-wrap gap-2">
              {(diagnosis.icdCodes || []).map((icd, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {icd.code}: {icd.description}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 
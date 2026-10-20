'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Plus, 
  Trash, 
  FloppyDisk as Save, 
  X,
  PencilSimple as Edit
} from '@phosphor-icons/react';

interface Treatment {
  drug: string;
  status: string;
  rationale: string;
}

interface EditableTableProps {
  label: string;
  treatments: Treatment[] | null | undefined;
  onSave: (treatments: Treatment[]) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function EditableTable({
  label,
  treatments = [],
  onSave,
  disabled = false,
  className = '',
}: EditableTableProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTreatments, setEditingTreatments] = useState<Treatment[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Convert treatments to array format for editing
  const normalizedTreatments = useMemo(() => Array.isArray(treatments) ? treatments : [], [treatments]);

  // Initialize editing state when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setEditingTreatments([...normalizedTreatments]);
    }
  }, [isEditing, normalizedTreatments]);

  const handleEdit = () => {
    if (disabled) return;
    setIsEditing(true);
    setError(null);
  };

  const handleSave = useCallback(async () => {
    // Validate treatments
    const validTreatments = editingTreatments.filter(
      treatment => treatment.drug.trim() || treatment.status.trim() || treatment.rationale.trim()
    );

    setIsSaving(true);
    setError(null);

    try {
      await onSave(validTreatments);
      setIsEditing(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save treatments');
    } finally {
      setIsSaving(false);
    }
  }, [editingTreatments, onSave]);

  const handleCancel = useCallback(() => {
    setEditingTreatments([...normalizedTreatments]);
    setIsEditing(false);
    setError(null);
  }, [normalizedTreatments]);

  const addTreatment = () => {
    setEditingTreatments(prev => [...prev, { drug: '', status: '', rationale: '' }]);
  };

  const removeTreatment = (index: number) => {
    setEditingTreatments(prev => prev.filter((_, i) => i !== index));
  };

  const updateTreatment = (index: number, field: keyof Treatment, value: string) => {
    setEditingTreatments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'discontinued', label: 'Discontinued' },
    { value: 'on-hold', label: 'On Hold' },
    { value: 'entered-in-error', label: 'Entered in Error' },
  ];

  // Handle click outside to close editing
  const hasUnsavedChanges = JSON.stringify(editingTreatments) !== JSON.stringify(normalizedTreatments);

  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Don't close if clicking on select dropdown or modal content
      if (target.closest('[role="listbox"]') || 
          target.closest('[data-radix-popper-content-wrapper]') ||
          target.closest('.editing-table-container')) {
        return;
      }

      if (hasUnsavedChanges) {
        const shouldSave = window.confirm(
          'You have unsaved changes. Would you like to save them before closing?'
        );
        if (shouldSave) {
          handleSave();
        } else {
          handleCancel();
        }
      } else {
        handleCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [isEditing, hasUnsavedChanges, handleSave, handleCancel]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-foreground flex items-center justify-between">
          {label}
          {!isEditing && !disabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
              className="flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="editing-table-container space-y-4">
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 font-medium text-sm text-muted-foreground">
              <div className="col-span-4">Drug/Medication</div>
              <div className="col-span-3">Status</div>
              <div className="col-span-4">Rationale</div>
              <div className="col-span-1">Actions</div>
            </div>

            {/* Treatment Rows */}
            {editingTreatments.map((treatment, index) => (
              <div key={index} className="grid grid-cols-12 gap-4 items-start">
                <div className="col-span-4">
                  <Input
                    value={treatment.drug}
                    onChange={(e) => updateTreatment(index, 'drug', e.target.value)}
                    placeholder="Enter medication name"
                    className="w-full"
                  />
                </div>
                <div className="col-span-3">
                  <Select
                    value={treatment.status}
                    onValueChange={(value) => updateTreatment(index, 'status', value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4">
                  <Textarea
                    value={treatment.rationale}
                    onChange={(e) => updateTreatment(index, 'rationale', e.target.value)}
                    placeholder="Enter clinical rationale"
                    className="w-full min-h-[80px]"
                    rows={2}
                  />
                </div>
                <div className="col-span-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTreatment(index)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    title="Remove treatment"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Add Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={addTreatment}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Treatment
            </Button>

            {/* Error Display */}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/30">
              <Button
                variant="ghost"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            {normalizedTreatments.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-4 font-medium text-sm text-muted-foreground border-b border-border/30 pb-2">
                  <div className="col-span-4">Drug/Medication</div>
                  <div className="col-span-3">Status</div>
                  <div className="col-span-5">Rationale</div>
                </div>
                {normalizedTreatments.map((treatment, index) => (
                  <div key={index} className="grid grid-cols-12 gap-4 text-sm">
                    <div className="col-span-4 font-medium">
                      {treatment.drug || 'No medication specified'}
                    </div>
                    <div className="col-span-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        treatment.status === 'active' ? 'bg-ok-soft text-ok' :
                        treatment.status === 'completed' ? 'bg-info-soft text-info' :
                        treatment.status === 'discontinued' ? 'bg-critical-soft text-critical' :
                        treatment.status === 'on-hold' ? 'bg-flag-soft text-flag' :
                        'bg-well text-ink'
                      }`}>
                        {statusOptions.find(opt => opt.value === treatment.status)?.label || treatment.status || 'Unknown'}
                      </span>
                    </div>
                    <div className="col-span-5 text-muted-foreground">
                      {treatment.rationale || 'No rationale provided'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/70 text-center py-8">
                No treatments recorded
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 
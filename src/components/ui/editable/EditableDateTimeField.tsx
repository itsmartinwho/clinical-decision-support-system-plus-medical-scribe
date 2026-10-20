'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import EditableSection, { 
  createFieldHistory, 
  updateFieldHistory, 
  undoFieldHistory, 
  redoFieldHistory 
} from './EditableSection';

interface EditableDateTimeFieldProps {
  value: string; // ISO string
  onSave: (newValue: string) => Promise<void>;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  displayClassName?: string;
  showTime?: boolean;
  allowFuture?: boolean;
  allowPast?: boolean;
}

export default function EditableDateTimeField({
  value,
  onSave,
  label = 'Date and Time',
  required = true,
  disabled = false,
  className = '',
  displayClassName = '',
  showTime = true,
  allowFuture = true,
  allowPast = true,
}: EditableDateTimeFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState(() => createFieldHistory(value));
  const [error, setError] = useState<string | null>(null);
  
  const dateInputRef = useRef<HTMLInputElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);

  // Convert ISO string to local date/time inputs
  const getDateTimeValues = (isoString: string) => {
    if (!isoString) return { date: '', time: '' };
    
    const date = new Date(isoString);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    
    return {
      date: localDate.toISOString().split('T')[0],
      time: localDate.toISOString().split('T')[1].slice(0, 5)
    };
  };

  // Convert local date/time inputs to ISO string
  const createISOString = (date: string, time: string) => {
    if (!date) return '';
    
    const timeValue = time || '09:00'; // Default to 9 AM if no time provided
    const localDateTime = `${date}T${timeValue}`;
    return new Date(localDateTime).toISOString();
  };

  // Update history when value prop changes
  useEffect(() => {
    if (!isEditing) {
      setHistory(createFieldHistory(value));
    }
  }, [value, isEditing]);

  // Focus date input when entering edit mode
  useEffect(() => {
    if (isEditing && dateInputRef.current) {
      dateInputRef.current.focus();
    }
  }, [isEditing]);

  const handleEdit = () => {
    if (disabled) return;
    setIsEditing(true);
    setError(null);
  };

  const handleSave = async () => {
    const currentValue = history.present;
    
    // Validate required field
    if (required && !currentValue) {
      setError('Date and time are required');
      return;
    }

    // Validate date constraints
    if (currentValue) {
      const selectedDate = new Date(currentValue);
      const now = new Date();
      
      if (!allowPast && selectedDate < now) {
        setError('Future dates only are allowed');
        return;
      }
      
      if (!allowFuture && selectedDate > now) {
        setError('Past dates only are allowed');
        return;
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(currentValue);
      setIsEditing(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setHistory(createFieldHistory(value));
    setIsEditing(false);
    setError(null);
  };

  const handleDateTimeChange = (date: string, time: string) => {
    const newValue = createISOString(date, time);
    setHistory(currentHistory => updateFieldHistory(currentHistory, newValue));
    setError(null);
  };

  const handleUndo = () => {
    setHistory(currentHistory => undoFieldHistory(currentHistory));
  };

  const handleRedo = () => {
    setHistory(currentHistory => redoFieldHistory(currentHistory));
  };

  // Format display value
  const formatDisplayValue = (isoString: string) => {
    if (!isoString) return 'No date set';
    
    const date = new Date(isoString);
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };
    
    if (showTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }
    
    return date.toLocaleDateString(undefined, options);
  };

  const { date: currentDate, time: currentTime } = getDateTimeValues(history.present);
  const hasUnsavedChanges = history.present !== value;

  return (
    <EditableSection
      isEditing={isEditing}
      onEdit={handleEdit}
      onSave={handleSave}
      onCancel={handleCancel}
      onUndo={handleUndo}
      onRedo={handleRedo}
      canUndo={history.past.length > 0}
      canRedo={history.future.length > 0}
      isSaving={isSaving}
      disabled={disabled}
      className={className}
      hasUnsavedChanges={hasUnsavedChanges}
      onRequestClose={handleCancel}
    >
      {isEditing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date-input">Date</Label>
              <Input
                id="date-input"
                ref={dateInputRef}
                type="date"
                value={currentDate}
                onChange={(e) => handleDateTimeChange(e.target.value, currentTime)}
                required={required}
              />
            </div>
            
            {showTime && (
              <div className="space-y-2">
                <Label htmlFor="time-input">Time</Label>
                <Input
                  id="time-input"
                  ref={timeInputRef}
                  type="time"
                  value={currentTime}
                  onChange={(e) => handleDateTimeChange(currentDate, e.target.value)}
                />
              </div>
            )}
          </div>
          
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          
          <div className="text-xs text-muted-foreground">
            {!allowPast && allowFuture && 'Only future dates are allowed'}
            {allowPast && !allowFuture && 'Only past dates are allowed'}
            {allowPast && allowFuture && 'Any date is allowed'}
          </div>
        </div>
      ) : (
        <div className={displayClassName}>
          <span className="sr-only">{label}: </span>
          <span className={!value ? 'text-muted-foreground italic' : 'data-mono text-ink'}>
            {formatDisplayValue(value)}
          </span>
        </div>
      )}
    </EditableSection>
  );
} 
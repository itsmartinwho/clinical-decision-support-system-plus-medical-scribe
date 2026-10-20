import React, { useState } from 'react';
import { Button } from '../button';
import { Textarea } from '../textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../card';
import { PencilSimple as Edit, FloppyDisk as Save, X, Code, WarningCircle as AlertCircle } from '@phosphor-icons/react';

interface EditableJSONFieldProps {
  label: string;
  value: any;
  onSave: (value: any) => Promise<void>;
  placeholder?: string;
  maxHeight?: string;
  readOnly?: boolean;
}

export function EditableJSONField({
  label,
  value,
  onSave,
  placeholder = "Enter JSON data...",
  maxHeight = "200px",
  readOnly = false
}: EditableJSONFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const formatJSON = (obj: any): string => {
    if (obj === null || obj === undefined) {
      return '';
    }
    try {
      return JSON.stringify(obj, null, 2);
    } catch (error) {
      return String(obj);
    }
  };

  const parseJSON = (text: string): any => {
    if (!text.trim()) {
      return null;
    }
    return JSON.parse(text);
  };

  const validateJSON = (text: string): string | null => {
    if (!text.trim()) {
      return null; // Empty is valid (will be stored as null)
    }
    try {
      JSON.parse(text);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Invalid JSON format';
    }
  };

  const handleEdit = () => {
    setJsonText(formatJSON(value));
    setValidationError(null);
    setIsEditing(true);
  };

  const handleSave = async () => {
    const error = validateJSON(jsonText);
    if (error) {
      setValidationError(error);
      return;
    }

    try {
      setIsLoading(true);
      const parsedValue = parseJSON(jsonText);
      await onSave(parsedValue);
      setIsEditing(false);
      setValidationError(null);
    } catch (error) {
      console.error('Failed to save JSON field:', error);
      setValidationError('Failed to save changes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setJsonText('');
    setValidationError(null);
  };

  const handleTextChange = (newText: string) => {
    setJsonText(newText);
    // Clear validation error when user starts typing
    if (validationError) {
      const error = validateJSON(newText);
      if (!error) {
        setValidationError(null);
      }
    }
  };

  const displayValue = value ? formatJSON(value) : '';
  const isEmpty = !displayValue.trim();

  if (!isEditing) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Code className="w-4 h-4" />
              {label}
            </CardTitle>
            {!readOnly && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEdit}
                className="h-8 w-8 p-0"
              >
                <Edit className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isEmpty ? (
            <div className="text-sm text-muted-foreground italic">
              No data
            </div>
          ) : (
            <pre 
              className="text-sm bg-muted p-3 rounded-md overflow-auto whitespace-pre-wrap break-words"
              style={{ maxHeight }}
            >
              {displayValue}
            </pre>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Code className="w-4 h-4" />
            {label}
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              disabled={isLoading || !!validationError}
              className="h-8 w-8 p-0"
            >
              <Save className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isLoading}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <Textarea
            value={jsonText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={placeholder}
            className={`font-mono text-sm resize-none ${
              validationError ? 'border-critical-line focus:border-critical-line' : ''
            }`}
            style={{ minHeight: '120px', maxHeight }}
            disabled={isLoading}
          />
          {validationError && (
            <div className="flex items-center gap-2 text-sm text-critical">
              <AlertCircle className="w-4 h-4" />
              {validationError}
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            Enter valid JSON format. Leave empty for null value.
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 
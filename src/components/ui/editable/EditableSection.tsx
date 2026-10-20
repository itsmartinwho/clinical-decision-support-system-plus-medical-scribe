'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  PencilSimple, 
  FloppyDisk, 
  X, 
  ArrowCounterClockwise, 
  ArrowClockwise 
} from '@phosphor-icons/react';

interface FieldHistory {
  past: string[];
  present: string;
  future: string[];
}

interface EditableSectionProps {
  children: React.ReactNode;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  isSaving?: boolean;
  className?: string;
  editClassName?: string;
  disabled?: boolean;
  showEditButton?: boolean;
  hasUnsavedChanges?: boolean;
  onRequestClose?: () => void; // Called when user clicks outside
}

export default function EditableSection({
  children,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  isSaving = false,
  className = '',
  editClassName = '',
  disabled = false,
  showEditButton = true,
  hasUnsavedChanges = false,
  onRequestClose,
}: EditableSectionProps) {
  const [isHovered, setIsHovered] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isEditing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onSave();
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey && onUndo) {
        e.preventDefault();
        onUndo();
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey && onRedo) {
        e.preventDefault();
        onRedo();
      } else if (e.key === 'y' && (e.ctrlKey || e.metaKey) && onRedo) {
        e.preventDefault();
        onRedo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, onSave, onCancel, onUndo, onRedo]);

  // Handle click outside to close editing
  useEffect(() => {
    if (!isEditing || !onRequestClose) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (sectionRef.current && !sectionRef.current.contains(e.target as Node)) {
        e.preventDefault();
        e.stopPropagation();
        
        if (hasUnsavedChanges) {
          const shouldSave = window.confirm(
            'You have unsaved changes. Would you like to save them before closing?'
          );
          if (shouldSave) {
            onSave();
          } else {
            onCancel();
          }
        } else {
          onRequestClose();
        }
      }
    };

    // Use capture phase to handle this before other click handlers
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [isEditing, onRequestClose, hasUnsavedChanges, onSave, onCancel]);

  return (
    <div
      ref={sectionRef}
      className={cn(
        "relative group transition-all duration-200",
        isEditing && "ring-1 ring-primary/50 rounded-lg",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Edit Button (appears on hover when not editing) */}
      {!isEditing && !disabled && showEditButton && isHovered && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="absolute top-2 right-2 z-10 h-8 w-8 p-0 opacity-80 hover:opacity-100 bg-card border border-border"
          title="Edit"
        >
          <PencilSimple className="h-4 w-4" />
        </Button>
      )}

      {/* Content */}
      <div className={cn(isEditing && editClassName)}>
        {children}
      </div>

      {/* Edit Controls (appears when editing) */}
      {isEditing && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
          {/* Undo/Redo Controls */}
          <div className="flex items-center gap-1">
            {onUndo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onUndo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
                className="h-8 w-8 p-0"
              >
                <ArrowCounterClockwise className="h-3 w-3" />
              </Button>
            )}
            {onRedo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRedo}
                disabled={!canRedo}
                title="Redo (Ctrl+Shift+Z)"
                className="h-8 w-8 p-0"
              >
                <ArrowClockwise className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Save/Cancel Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isSaving}
              className="h-8"
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={onSave}
              disabled={isSaving}
              className="h-8"
            >
              {isSaving ? (
                <>
                  <div className="h-4 w-4 mr-1 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <FloppyDisk className="h-4 w-4 mr-1" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      {isEditing && (
        <div className="mt-2">
          <p className="text-xs text-muted-foreground">
            Press Ctrl+Enter to save, Escape to cancel
            {(onUndo || onRedo) && ', Ctrl+Z to undo, Ctrl+Shift+Z to redo'}
          </p>
        </div>
      )}
    </div>
  );
}

// Helper function to create field history for undo/redo functionality
export function createFieldHistory(initialValue: string): FieldHistory {
  return {
    past: [],
    present: initialValue,
    future: []
  };
}

// Helper function to update field history
export function updateFieldHistory(
  currentHistory: FieldHistory,
  newValue: string
): FieldHistory {
  if (newValue !== currentHistory.present) {
    return {
      past: [...currentHistory.past, currentHistory.present],
      present: newValue,
      future: []
    };
  }
  return currentHistory;
}

// Helper function to undo in field history
export function undoFieldHistory(currentHistory: FieldHistory): FieldHistory {
  if (currentHistory.past.length > 0) {
    const previous = currentHistory.past[currentHistory.past.length - 1];
    return {
      past: currentHistory.past.slice(0, -1),
      present: previous,
      future: [currentHistory.present, ...currentHistory.future]
    };
  }
  return currentHistory;
}

// Helper function to redo in field history
export function redoFieldHistory(currentHistory: FieldHistory): FieldHistory {
  if (currentHistory.future.length > 0) {
    const next = currentHistory.future[0];
    return {
      past: [...currentHistory.past, currentHistory.present],
      present: next,
      future: currentHistory.future.slice(1)
    };
  }
  return currentHistory;
} 